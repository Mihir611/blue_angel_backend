const GITHUB_AI_TOKEN = process.env.OPENAI_API_KEY;
const https = require('https');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = false;
const extractTextFromBuffer = async (buffer) => {
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
    });
    const pdf = await loadingTask.promise;

    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 10);

    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
};

const makeRequest = (requestData, requestOptions) => {
    return new Promise((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (err) {
                    reject(new Error('Failed to parse AI response: ' + data));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(requestData);
        req.end();
    });
};

exports.validatePDFWithAI = async (buffer, { manufacturer, model, variant, yearStart, yearEnd }) => {
    let pdfText = '';
    try {
        const rawText = await extractTextFromBuffer(buffer);
        pdfText = rawText
            .replace(/\s+/g, ' ')  // collapse multiple spaces into one
            .trim();
    } catch (err) {
        throw new Error('Failed to extract text from PDF: ' + err.message);
    }

    if (!pdfText || pdfText.length < 50) {
        return { isValid: false, score: 0, reason: 'PDF appears to be scanned or image-only; no text layer found.' };
    }

    const truncatedText = pdfText.slice(0, 4000);

    const messages = [
        {
            role: 'system',
            content: 'You are a vehicle manual verification system. Always respond with valid JSON only, no markdown, no extra text.'
        },
        {
            role: 'user',
            content: `You are a vehicle manual verification system.
Here is the extracted text from a PDF document (extracted via PDF parser, may have spacing artifacts):
"""
${truncatedText}
"""
Check if this document is a legitimate owner's manual or service manual for:
- Manufacturer: ${manufacturer}
- Model: ${model}
- Variant: ${variant}
- Year range: ${yearStart} to ${yearEnd}

IMPORTANT: The text may have extra spaces between letters (e.g. "R O Y A L" or "ROYAL  ENFIELD"). 
Match loosely — ignore spacing artifacts when checking for manufacturer/model names.

Respond ONLY with a JSON object:
{
  "isValid": true or false,
  "score": a number from 0 to 100,
  "reason": "brief explanation"
}
Scoring guide:
- 40 points if manufacturer name is found and matches (fuzzy match, ignore spaces)
- 40 points if model name is found and matches (fuzzy match, ignore spaces)  
- 20 points if it appears to be an owner/service/workshop manual
- Deduct points if it looks fake, unrelated, or not a manual`
        }
    ];

    const requestBody = {
        model: 'openai/gpt-4o',
        messages,
        max_tokens: 500,
        temperature: 0.1,
        top_p: 0.8
    }

    const requestData = JSON.stringify(requestBody);

    const requestOptions = {
        hostname: 'models.github.ai',
        port: 443,
        path: '/inference/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GITHUB_AI_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestData)
        }
    };

    const response = await makeRequest(requestData, requestOptions);

    if (!response.choices || response.choices.length === 0) {
        throw new Error('Invalid response from AI');
    }

    const rawText = response.choices[0].message.content.trim();
    console.log('AI validation response:', rawText);

    // Strip markdown if AI wraps response in ```json
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned);

    return result; // { isValid, score, reason }
};

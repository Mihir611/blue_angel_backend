/**
 * debug-gemini.js
 * Run with: GEMINI_API_KEY=your_key node debug-gemini.js
 * Shows exactly what Gemini returns for a minimal JSON request.
 */

require('dotenv').config();
const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';

function callGemini(prompt) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 500, temperature: 0.1 },
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        };

        const req = https.request(options, (res) => {
            let raw = '';
            res.on('data', (c) => { raw += c; });
            res.on('end', () => {
                console.log('\n=== FULL HTTP RESPONSE ===');
                console.log(raw);
                try {
                    const parsed = JSON.parse(raw);
                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                    console.log('\n=== EXTRACTED TEXT ===');
                    console.log(text || '(no text found)');
                    console.log('\n=== FINISH REASON ===');
                    console.log(parsed.candidates?.[0]?.finishReason);
                    resolve(text);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// Test 1: minimal JSON request
callGemini(`Return ONLY this JSON, no other text:
{"test": "hello", "works": true}`)
    .then(() => console.log('\n✅ Test complete'))
    .catch((e) => console.error('\n❌ Error:', e.message));
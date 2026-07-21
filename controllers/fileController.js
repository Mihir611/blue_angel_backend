const axios = require('axios');
const FormData = require('form-data');
const Manual = require('../models/filesMaster');
const { getUserByEmail } = require('../utils/getUserDetailsHelper');
const { validatePDFWithAI } = require('../utils/pdfValidtor');

exports.createManual = async (req, res) => {
    try {
        const { title, manufacturer, model, variant, yearStart, yearEnd, description, userEmail } = req.body;
        const uploadedFile = req.files?.file?.[0];

        if (!uploadedFile) {
            return res.status(400).json({ success: false, message: 'Manual PDF is required' });
        }

        if (uploadedFile.mimetype !== 'application/pdf') {
            return res.status(400).json({ success: false, message: "Only PDF files are accepted" });
        }

        if (!userEmail) {
            return res.status(400).json({ success: false, message: 'User email is required' });
        }

        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        let validationResult;
        try {
            validationResult = await validatePDFWithAI(uploadedFile.buffer, {
                manufacturer, model, variant, yearStart, yearEnd
            });
        } catch (err) {
            console.log('AI validation error:', err.message);
            return res.status(400).json({ success: false, message: 'Unable to validate PDF contents' });
        }

        if (!validationResult.isValid || validationResult.score < 60) {
            return res.status(400).json({
                success: false,
                message: `PDF validation failed: ${validationResult.reason}`,
                validationScore: validationResult.score
            });
        }

        // Upload to IPFS service
        const form = new FormData();

        form.append('file', uploadedFile.buffer, uploadedFile.originalname);
        const uploadResponse = await axios.post(process.env.SUPPORTING_FILE_APU_URL + 'upload?tag=manual', form, {
            headers: {
                ...form.getHeaders(),
                'X-API-KEY': process.env.IPFS_API_KEY
            },
            maxBodyLength: Infinity
        });

        const file = uploadResponse.data;

        //save the metadata
        const manual = await Manual.create({
            title,
            manufacturer,
            model,
            variant,
            yearStart,
            yearEnd,
            description,

            fileId: file.cid,
            fileUrl: file.gateway_url,
            mimeType: file.mime_type,
            fileTag: file.tags || 'manual',

            uploadedBy: user.userId
        });

        return res.status(201).json({ success: true, validationScore: validationResult.score, data: manual, message: 'File uploaded successfully' });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.response?.data?.detail || err.response?.data || err.message });
    }
}

exports.getUserManual = async (req, res) => {
    try {
        const { manufacturer, model, variant, yearStart, yearEnd } = req.query;

        if (!manufacturer || !model) {
            return res.status(400).json({ success: false, message: 'manufacturer and model are required' });
        }

        const query = { manufacturer, model }
        if (variant) query.variant = variant;
        if (yearStart) query.yearStart = Number(yearStart);
        if (yearEnd) query.yearEnd = Number(yearEnd);

        const manual = await Manual.findOne(query);
        if (!manual) {
            return res.status(404).json({ success: false, message: 'No manual found for the given filters' });
        }

        const response = await axios.get(manual.fileUrl, { responseType: "stream", timeout: 15_000 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${manual.title}.pdf"`);
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        response.data.pipe(res);

        response.data.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: "Stream error" });
            } else {
                res.end();
            }
        })

        req.on("close", () => {
            response.data.destroy();
        });

    } catch (error) {
        console.error('Error fetching PDF:', error.message);
        if (error.code === "ECONNABORTED") {
            return res.status(504).json({
                success: false,
                message: "Timed out fetching the PDF from storage",
            });
        }

        if (error.response?.status === 404) {
            return res.status(404).json({ success: false, message: 'PDF file not found at stored URL' });
        }

        res.status(500).json({ success: false, message: 'Failed to fetch PDF' });
    }
}
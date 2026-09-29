const axios = require('axios');
const FormData = require('form-data');

exports.validatePDFWithAI = async (pdfBuffer, originalName, make, model) => {
    try {
        const form = new FormData();

        form.append("pdf", pdfBuffer, {
            filename: originalName || "manual.pdf",
            contentType: "application/pdf",
        });
        form.append("make", make);
        form.append("model", model);

        const response = await axios.post(process.env.SUPPORTING_FILE_APU_URL + 'pdf-validator', form, {
            headers: {
                ...form.getHeaders(),
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 60000,
            maxRedirects: 5,
        })

        const data = response.data;

        return {
            isValid: data.status === "PASS",
            validPdf: data.valid_pdf,
            makeFound: data.make_found,
            modelFound: data.model_found,
            pages: data.pages,
            score: data.score,                    // ← new field
            scoreDetails: data.score_details,     // ← new field
            message: data.message,
            raw: data,
        }
    } catch (error) {
        console.error("PDF Validator Service Error:", error.message);

        // If FastAPI returned a proper error response
        if (error.response?.data) {
            return {
                isValid: false,
                validPdf: false,
                makeFound: false,
                modelFound: false,
                pages: 0,
                score: 0,
                scoreDetails: {},
                message: error.response.data.message || "Validation failed",
                raw: error.response.data,
            };
        }

        // Network / unexpected error
        throw new Error("Unable to connect to PDF validation service");
    }
}
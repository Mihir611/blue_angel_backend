const mongoose = require('mongoose');

const manualSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    fileId: { type: String, required: true, trim: true, unique: true, index: true },
    fileUrl: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    fileTag: { type: String, required: true, trim: true },
    manufacturer: { type: String, required: true, index: true },
    model: { type: String, required: true, index: true },
    variant: String,
    yearStart: Number,
    yearEnd: Number,
    description: String,
    uploadedBy: { type: String, ref: 'User', required: true },
}, {
    timestamps: true
});

manualSchema.index({
    manufacturer: 1,
    model: 1
});

manualSchema.index({
    manufacturer: 'text',
    model: 'text',
    title: 'text',
    description: 'text'
});

module.exports = mongoose.model('Manual', manualSchema);

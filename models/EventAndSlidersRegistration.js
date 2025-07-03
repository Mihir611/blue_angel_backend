const mongoose = require('mongoose');

const eventsSlidersRegistrationSchema = new mongoose.Schema({
    userEmail: { type: String, required: true, trim: true, lowercase: true },
    registrationType: { type: String, enum: ['event', 'slider'], required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Events', required: function () { return this.registrationType === 'event'; } },
    sliderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sliders', required: function () { return this.registrationType === 'slider'; } },
    registrationDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
    notes: { type: String, trim: true },
    contactInfo: { phone: { type: String, trim: true } },
    isActive: { type: Boolean, default: true },
    createAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
eventsSlidersRegistrationSchema.index({ userEmail: 1, registrationType: 1 });
eventsSlidersRegistrationSchema.index({ eventId: 1 });
eventsSlidersRegistrationSchema.index({ sliderId: 1 });
eventsSlidersRegistrationSchema.index({ registrationDate: 1 });
eventsSlidersRegistrationSchema.index({ status: 1 });

// unique registration per user event/slider
eventsSlidersRegistrationSchema.index({
    userEmail: 1, eventId: 1, sliderId: 1
}, { unique: true, sparse: true });

//pre save middleware to update updatedAt field
eventsSlidersRegistrationSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Method to get the registration details with populated references
eventsSlidersRegistrationSchema.methods.getFullRegistrationDetails = function () {
    const populateFields = [
        {
            path: 'userEmail',
            select: 'email username firstname lastname profilePicture'
        }
    ];

    if (this.registrationType === 'event') {
        populateFields.push('eventId');
    } else if (this.registrationType === "slider") {
        populateFields.push('sliderId');
    }

    return this.populate(populateFields);
};

// method to find registration by event
eventsSlidersRegistrationSchema.statics.findByUserEmail = function (userEmail, type = null) {
    const query = { userEmail, isActive: true };
    if (query) {
        query.registrationType = type;
    }
    return this.find(query);
};

// find registration by event
eventsSlidersRegistrationSchema.statics.findByEvent = function (eventId) {
    return this.find({ eventId, isActive: true });
};

// find registration by slider
eventsSlidersRegistrationSchema.statics.findBySlider = function (sliderId) {
    return this.find({ sliderId, isActive: true });
};

module.exports = mongoose.model('EventsSliderRegistration', eventsSlidersRegistrationSchema);
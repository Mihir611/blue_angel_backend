const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
    },
    registrationType: {
      type: String,
      enum: ['event', 'slider'],
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Events',
      required: function () {
        return this.registrationType === 'event';
      },
    },
    sliderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sliders',
      required: function () {
        return this.registrationType === 'slider';
      },
    },
    registrationDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
    },
    notes: {
      type: String,
      trim: true,
    },
    contactInfo: {
      phone: { type: String, trim: true },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // auto-manages createdAt and updatedAt
  }
);

// --- Indexes ---
registrationSchema.index({ userId: 1, registrationType: 1 });
registrationSchema.index({ eventId: 1 });
registrationSchema.index({ sliderId: 1 });
registrationSchema.index({ registrationDate: 1 });
registrationSchema.index({ status: 1 });

// Prevents duplicate registrations for the same user + event/slider combo
registrationSchema.index(
  { userId: 1, eventId: 1, sliderId: 1 },
  { unique: true, sparse: true }
);

// --- Instance Methods ---

// Returns the document populated with user + event or slider details
registrationSchema.methods.getFullDetails = function () {
  const populate = [
    { path: 'userId', select: 'email username firstname lastname profilePicture' },
  ];

  if (this.registrationType === 'event') {
    populate.push({ path: 'eventId' });
  } else {
    populate.push({ path: 'sliderId' });
  }

  return this.populate(populate);
};

// --- Static Methods ---

// Find all active registrations for a user, optionally filtered by type
registrationSchema.statics.findByUserId = function (userId, type = null) {
  const query = { userId, isActive: true };
  if (type) query.registrationType = type;
  return this.find(query);
};

// Find all active registrations for a specific event
registrationSchema.statics.findByEvent = function (eventId) {
  return this.find({ eventId, isActive: true });
};

// Find all active registrations for a specific slider
registrationSchema.statics.findBySlider = function (sliderId) {
  return this.find({ sliderId, isActive: true });
};

module.exports = mongoose.model('EventsSliderRegistration', registrationSchema);
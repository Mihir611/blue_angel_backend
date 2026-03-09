const mongoose = require('mongoose');

const CoordSchema = new mongoose.Schema(
    { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
    { _id: false }
);

const StopSchema = new mongoose.Schema({
    stopNumber: Number,
    name: { type: String, required: true },
    coordinates: { type: CoordSchema, required: true },
    type: { type: String, enum: ['start', 'fuel_station', 'food_dhaba', 'break', 'mechanic', 'attraction', 'overnight', 'end', 'critical_fuel'] },
    distanceFromPrevKm: Number,
    estimatedArrival: String,
    estimatedDeparture: String,
    durationMinutes: Number,
    description: String,
    whyThisStop: String,
    facilities: [String],
    fuelAvailable: { type: Boolean, default: false },
    mechanicAvailable: { type: Boolean, default: false },
    foodAvailable: { type: Boolean, default: false },
    bikerFriendly: { type: Boolean, default: false },
    mapPinColor: { type: String, default: 'grey' },
}, { _id: false });

const DayPlanSchema = new mongoose.Schema({
    dayNumber: Number,
    phase: { type: String, enum: ['forward', 'return', 'rest_at_destination'] },
    date: String,
    startLocation: String,
    startCoordinates: CoordSchema,
    endLocation: String,
    endCoordinates: CoordSchema,
    totalDistanceKm: Number,
    estimatedRidingTimeHours: Number,
    recommendedDepartureTime: String,
    estimatedArrivalTime: String,
    roadCondition: String,
    altitudeRange: String,
    weatherAdvisory: String,
    highlights: [String],
    vibeOfTheDay: String,
    stops: [StopSchema],
    dayNotes: [String],
    emergencyContacts: {
        nearestHospital: String,
        policeStation: String,
        bikeRescueNumber: String,
    },
}, { _id: false });

// ─── SINGLE VARIANT ITINERARY ─────────────────────────────────────────────────
const VariantSchema = new mongoose.Schema({
    variantId: { type: String, required: true },
    variantLabel: String,
    difficulty: String,
    tagline: String,
    emoji: String,
    palette: mongoose.Schema.Types.Mixed,
    routeSummary: mongoose.Schema.Types.Mixed,
    dayPlans: [DayPlanSchema],
    recommendations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    criticalFuelStops: { type: [mongoose.Schema.Types.Mixed], default: [] },
    emergencyMechanics: { type: [mongoose.Schema.Types.Mixed], default: [] },
    overnightStays: { type: [mongoose.Schema.Types.Mixed], default: [] },
    ridingTips: [String],
    packingChecklist: [String],
    mapPins: { type: [mongoose.Schema.Types.Mixed], default: [] },
    geoJSON: mongoose.Schema.Types.Mixed,
    mapPolyline: {
        forward: [{ lat: Number, lng: Number, label: String }],
        return: [{ lat: Number, lng: Number, label: String }],
    },
    style: String,
    aiProvider: String,
}, { _id: false });

// ─── TRIP BUNDLE (parent — holds all 3 variants) ──────────────────────────────
const TripBundleSchema = new mongoose.Schema({
    bundleId: { type: String, unique: true, required: true },

    // Request params
    source: { type: String, required: true },
    destination: { type: String, required: true },
    numberOfDays: { type: Number, required: true, min: 2, max: 30 },
    tripType: { type: String, enum: ['solo', 'group'], required: true },
    bikeType: {
        type: String,
        enum: ['adventure', 'cruiser', 'sports', 'touring', 'dirt_bike', 'naked', 'scooter'],
        required: true,
    },
    bikeModel: String,
    engineCC: Number,
    fuelTankCapacity: { type: Number, default: 15 },
    startDate: String,
    groupDetails: mongoose.Schema.Types.Mixed,

    // Resolved style and variants
    resolvedStyle: { type: String, enum: ['adventure', 'cruise', 'relax'] },
    variantIds: [String],   // e.g. ['adventure_easy', 'adventure_moderate', 'adventure_extreme']

    // The 3 itinerary variants — stored as a flexible map
    itineraries: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Generation metadata
    generatedVariants: [String],
    failedVariants: [String],
    generationErrors: mongoose.Schema.Types.Mixed,

    status: { type: String, enum: ['generating', 'ready', 'partial', 'failed'], default: 'ready' },
    createdBy: String,
    notes: String,
    aiModel: { type: String, default: 'gemini-1.5-flash' },
    aiGeneratedAt: { type: Date, default: Date.now },
}, { timestamps: true });

TripBundleSchema.index({ bundleId: 1 });
TripBundleSchema.index({ bikeType: 1, resolvedStyle: 1, status: 1 });
TripBundleSchema.index({ source: 1, destination: 1 });

module.exports = mongoose.model('TripBundle', TripBundleSchema);
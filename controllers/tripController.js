// const { v4: uuidv4 } = require('uuid');
// const TripBundle = require('../models/TripBundle');
// const { generateAllItineraries, enrichPlan, TRIP_STYLES } = require('../services/aiTripService');

// const BIKE_PROFILES = {
//     adventure: { avgSpeed: 60, recommendedDailyKm: 300, fuelEfficiency: 25, fuelTankCapacity: 20 },
//     cruiser: { avgSpeed: 65, recommendedDailyKm: 350, fuelEfficiency: 20, fuelTankCapacity: 15 },
//     sports: { avgSpeed: 80, recommendedDailyKm: 400, fuelEfficiency: 18, fuelTankCapacity: 14 },
//     touring: { avgSpeed: 70, recommendedDailyKm: 380, fuelEfficiency: 22, fuelTankCapacity: 20 },
//     dirt_bike: { avgSpeed: 40, recommendedDailyKm: 150, fuelEfficiency: 30, fuelTankCapacity: 10 },
//     naked: { avgSpeed: 70, recommendedDailyKm: 280, fuelEfficiency: 22, fuelTankCapacity: 13 },
//     scooter: { avgSpeed: 50, recommendedDailyKm: 120, fuelEfficiency: 45, fuelTankCapacity: 7 },
// };

// // ─── CREATE TRIP BUNDLE (all 3 itineraries) ───────────────────────────────────
// exports.createTripBundle = async (req, res) => {
//     try {
//         const { source, destination, numberOfDays, tripType, bikeType, bikeModel, engineCC, fuelTankCapacity, startDate, groupDetails, createdBy, notes } = req.body;
//         const tankCapacity = fuelTankCapacity || BIKE_PROFILES[bikeType]?.fuelTankCapacity || 15;

//         console.log(`\n🏍️  BUNDLE REQUEST: ${source} → ${destination}`);
//         console.log(`   ${numberOfDays} days | ${bikeType} | ${tripType} | 3 styles in parallel\n`);

//         // ── GENERATE ALL 3 IN PARALLEL ───────────────────────────────────────────
//         const { results, errors, successCount } = await generateAllItineraries({
//             source, destination, numberOfDays, tripType, bikeType,
//             bikeModel, engineCC, fuelTankCapacity: tankCapacity,
//             startDate, groupDetails,
//         });

//         // ── ENRICH EACH WITH MAP DATA ────────────────────────────────────────────
//         const enriched = {};
//         for (const [style, plan] of Object.entries(results)) {
//             enriched[style] = enrichPlan(plan, style);
//         }

//         // ── BUILD MONGO DOCUMENT ─────────────────────────────────────────────────
//         const bundleDoc = {
//             bundleId: uuidv4(),
//             source, destination, numberOfDays, tripType, bikeType,
//             bikeModel: bikeModel || null,
//             engineCC: engineCC || null,
//             fuelTankCapacity: tankCapacity,
//             startDate: startDate || null,
//             groupDetails: tripType === 'group'
//                 ? {
//                     totalRiders: groupDetails?.totalRiders || 5,
//                     leadRider: groupDetails?.leadRider,
//                     sweepRider: groupDetails?.sweepRider,
//                     communicationChannel: groupDetails?.communicationChannel,
//                     rideFormation: 'staggered',
//                     maxSpeedLimit: 80,
//                 }
//                 : { totalRiders: 1 },
//             itineraries: enriched,
//             generatedStyles: Object.keys(results),
//             failedStyles: Object.keys(errors),
//             generationErrors: Object.keys(errors).length > 0 ? errors : undefined,
//             status: successCount === 3 ? 'ready' : successCount > 0 ? 'partial' : 'failed',
//             createdBy: createdBy || 'anonymous',
//             notes: notes || '',
//         };

//         const bundle = await TripBundle.create(bundleDoc);

//         // ── SUMMARY RESPONSE ─────────────────────────────────────────────────────
//         const summary = buildBundleSummary(bundle);
//         return res.status(201).json({
//             success: true,
//             message: `${successCount}/3 itineraries generated successfully`,
//             bundleId: bundle.bundleId,
//             generatedStyles: bundle.generatedStyles,
//             failedStyles: bundle.failedStyles.length ? bundle.failedStyles : undefined,
//             summary,           // quick-compare view of all 3
//             data: bundle,      // full data
//         });
//     } catch (err) {
//         console.error('createTripBundle error:', err);
//         return res.status(500).json({ success: false, message: err.message });
//     }
// }

// // ─── BUILD QUICK-COMPARE SUMMARY ─────────────────────────────────────────────
// const buildBundleSummary = (bundle) => {
//     const summary = {};
//     for (const [style, itin] of Object.entries(bundle.itineraries || {})) {
//         if (!itin) continue;
//         const styleConfig = TRIP_STYLES[style];
//         summary[style] = {
//             style,
//             emoji: styleConfig?.emoji,
//             label: itin.styleLabel,
//             tagline: itin.tagline,
//             difficultyRating: itin.routeSummary?.difficultyRating,
//             terrainType: itin.routeSummary?.terrainType,
//             totalRoundTripKm: itin.routeSummary?.totalRoundTripKm,
//             estimatedFuelCostINR: itin.routeSummary?.estimatedFuelCostINR,
//             estimatedTollCostINR: itin.routeSummary?.estimatedTollCostINR,
//             estimatedTotalBudgetINR: itin.routeSummary?.estimatedTotalBudgetINR,
//             totalMapPins: itin.mapPins?.length || 0,
//             totalFuelStops: (itin.mapPins || []).filter(p => p.type === 'fuel_station').length,
//             totalMechanicStops: (itin.mapPins || []).filter(p => p.type === 'mechanic').length,
//             daysForward: (itin.dayPlans || []).filter(d => d.phase === 'forward').length,
//             daysReturn: (itin.dayPlans || []).filter(d => d.phase === 'return').length,
//             palette: itin.palette,
//         };
//     }
//     return summary;
// };

// // ─── GET ALL BUNDLES (list) ───────────────────────────────────────────────────
// exports.getAllBundles = async (req, res) => {
//     try {
//         const { page = 1, limit = 10, tripType, bikeType, status } = req.query;
//         const filter = {};
//         if (tripType) filter.tripType = tripType;
//         if (bikeType) filter.bikeType = bikeType;
//         if (status) filter.status = status;

//         const bundles = await TripBundle.find(filter)
//             .select('bundleId source destination numberOfDays tripType bikeType bikeModel status generatedStyles startDate createdAt')
//             .sort({ createdAt: -1 })
//             .skip((page - 1) * limit)
//             .limit(Number(limit));

//         const total = await TripBundle.countDocuments(filter);

//         return res.json({
//             success: true,
//             data: bundles,
//             pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
//         });
//     } catch (err) {
//         return res.status(500).json({ success: false, message: err.message });
//     }
// };

// // ─── GET FULL BUNDLE ──────────────────────────────────────────────────────────
// exports.getBundleById = async (req, res) => {
//     try {
//         const bundle = await TripBundle.findOne({ bundleId: req.params.id });
//         if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });
//         return res.json({ success: true, data: bundle });
//     } catch (err) {
//         return res.status(500).json({ success: false, message: err.message });
//     }
// };

// // ─── GET BUNDLE SUMMARY (compare all 3) ──────────────────────────────────────
// exports.getBundleSummary = async (req, res) => {
//     try {
//         const bundle = await TripBundle.findOne({ bundleId: req.params.id });
//         if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });

//         return res.json({
//             success: true,
//             bundleId: bundle.bundleId,
//             source: bundle.source,
//             destination: bundle.destination,
//             numberOfDays: bundle.numberOfDays,
//             bikeType: bundle.bikeType,
//             summary: buildBundleSummary(bundle),
//         });
//     } catch (err) {
//         return res.status(500).json({ success: false, message: err.message });
//     }
// };

// // ─── GET SINGLE STYLE FROM BUNDLE ─────────────────────────────────────────────
// exports.getBundleStyle = async (req, res) => {
//     try {
//         const { id, style } = req.params;
//         const validStyles = ['adventure', 'cruise', 'relax'];
//         if (!validStyles.includes(style)) {
//             return res.status(400).json({ success: false, message: `Style must be one of: ${validStyles.join(', ')}` });
//         }

//         const bundle = await TripBundle.findOne({ bundleId: id });
//         if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });

//         const itinerary = bundle.itineraries?.[style];
//         if (!itinerary) {
//             return res.status(404).json({
//                 success: false,
//                 message: `Style "${style}" was not generated for this bundle`,
//                 availableStyles: bundle.generatedStyles,
//             });
//         }

//         return res.json({ success: true, style, data: itinerary });
//     } catch (err) {
//         return res.status(500).json({ success: false, message: err.message });
//     }
// };

// // ─── GET MAP DATA FOR ONE STYLE ───────────────────────────────────────────────
// exports.getStyleMapData = async (req, res) => {
//     try {
//         const { id, style } = req.params;
//         const bundle = await TripBundle.findOne({ bundleId: id })
//             .select(`itineraries.${style}.mapPins itineraries.${style}.geoJSON itineraries.${style}.mapPolyline itineraries.${style}.routeSummary itineraries.${style}.palette itineraries.${style}.styleLabel source destination`);

//         if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });

//         const itin = bundle.itineraries?.[style];
//         if (!itin) return res.status(404).json({ success: false, message: `Style "${style}" not found` });

//         return res.json({
//             success: true,
//             style,
//             source: bundle.source,
//             destination: bundle.destination,
//             sourceCoords: itin.routeSummary?.sourceCoordinates,
//             destinationCoords: itin.routeSummary?.destinationCoordinates,
//             palette: itin.palette,
//             mapPins: itin.mapPins,
//             geoJSON: itin.geoJSON,
//             polyline: itin.mapPolyline,
//         });
//     } catch (err) {
//         return res.status(500).json({ success: false, message: err.message });
//     }
// };

// // ─── GET ALL 3 MAP DATA (for combined view) ───────────────────────────────────
// exports.getAllStylesMapData = async (req, res) => {
//     try {
//         const bundle = await TripBundle.findOne({ bundleId: req.params.id })
//             .select('source destination itineraries.adventure.mapPins itineraries.adventure.geoJSON itineraries.adventure.mapPolyline itineraries.adventure.palette itineraries.cruise.mapPins itineraries.cruise.geoJSON itineraries.cruise.mapPolyline itineraries.cruise.palette itineraries.relax.mapPins itineraries.relax.geoJSON itineraries.relax.mapPolyline itineraries.relax.palette');

//         if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });

//         const mapData = {};
//         for (const style of ['adventure', 'cruise', 'relax']) {
//             const itin = bundle.itineraries?.[style];
//             if (itin) {
//                 mapData[style] = {
//                     palette: itin.palette,
//                     mapPins: itin.mapPins,
//                     geoJSON: itin.geoJSON,
//                     polyline: itin.mapPolyline,
//                 };
//             }
//         }

//         return res.json({ success: true, source: bundle.source, destination: bundle.destination, mapData });
//     } catch (err) {
//         return res.status(500).json({ success: false, message: err.message });
//     }
// };

// // ─── GET DAY PLAN FOR A STYLE ─────────────────────────────────────────────────
// exports.getStyleDayPlan = async (req, res) => {
//     try {
//         const { id, style, day } = req.params;
//         const bundle = await TripBundle.findOne({ bundleId: id });
//         if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });

//         const itin = bundle.itineraries?.[style];
//         if (!itin) return res.status(404).json({ success: false, message: `Style "${style}" not found` });

//         const dayPlan = itin.dayPlans?.find(d => d.dayNumber === Number(day));
//         if (!dayPlan) return res.status(404).json({ success: false, message: `Day ${day} not found` });

//         const dayPins = (itin.mapPins || []).filter(p => p.dayNumber === Number(day));

//         return res.json({ success: true, style, dayNumber: Number(day), data: dayPlan, mapPins: dayPins });
//     } catch (err) {
//         return res.status(500).json({ success: false, message: err.message });
//     }
// };

// // ─── GET CHECKLISTS FOR A STYLE ───────────────────────────────────────────────
// exports.getStyleChecklist = async (req, res) => {
//     try {
//         const { id, style } = req.params;
//         const bundle = await TripBundle.findOne({ bundleId: id })
//             .select(`itineraries.${style}.ridingTips itineraries.${style}.packingChecklist itineraries.${style}.styleLabel itineraries.${style}.tagline`);
//         if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });

//         const itin = bundle.itineraries?.[style];
//         if (!itin) return res.status(404).json({ success: false, message: `Style "${style}" not found` });

//         return res.json({
//             success: true,
//             style,
//             styleLabel: itin.styleLabel,
//             tagline: itin.tagline,
//             ridingTips: itin.ridingTips,
//             packingChecklist: itin.packingChecklist,
//         });
//     } catch (err) {
//         return res.status(500).json({ success: false, message: err.message });
//     }
// };

// // ─── DELETE BUNDLE ────────────────────────────────────────────────────────────
// exports.deleteBundle = async (req, res) => {
//     try {
//         const bundle = await TripBundle.findOneAndDelete({ bundleId: req.params.id });
//         if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });
//         return res.json({ success: true, message: 'Bundle deleted' });
//     } catch (err) {
//         return res.status(500).json({ success: false, message: err.message });
//     }
// };

// // ─── GET TRIP STYLES INFO ─────────────────────────────────────────────────────
// exports.getTripStyles = (req, res) => {
//     return res.json({
//         success: true,
//         data: Object.values(TRIP_STYLES).map(({ id, label, emoji, tagline, description, palette, departureTime, dailyKmModifier }) => ({
//             id, label, emoji, tagline, description, palette, departureTime, dailyKmModifier,
//         })),
//     });
// };

// // ─── GET BIKE PROFILES ────────────────────────────────────────────────────────
// exports.getBikeProfiles = (req, res) => {
//     return res.json({
//         success: true,
//         data: Object.entries(BIKE_PROFILES).map(([type, p]) => ({ bikeType: type, ...p })),
//     });
// };

const { v4: uuidv4 } = require('uuid');
const TripBundle = require('../models/TripBundle');
const { generateAllItineraries, enrichPlan, getStyleFromBikeType } = require('../services/aiTripService');
const { BIKE_TYPE_TO_STYLE, STYLE_VARIANTS, getVariantsForStyle } = require('../config/tripStyles');

const BIKE_PROFILES = {
    adventure: { avgSpeed: 60, recommendedDailyKm: 300, fuelEfficiency: 25, fuelTankCapacity: 20 },
    cruiser: { avgSpeed: 65, recommendedDailyKm: 350, fuelEfficiency: 20, fuelTankCapacity: 15 },
    sports: { avgSpeed: 80, recommendedDailyKm: 400, fuelEfficiency: 18, fuelTankCapacity: 14 },
    touring: { avgSpeed: 70, recommendedDailyKm: 380, fuelEfficiency: 22, fuelTankCapacity: 20 },
    dirt_bike: { avgSpeed: 40, recommendedDailyKm: 150, fuelEfficiency: 30, fuelTankCapacity: 10 },
    naked: { avgSpeed: 70, recommendedDailyKm: 280, fuelEfficiency: 22, fuelTankCapacity: 13 },
    scooter: { avgSpeed: 50, recommendedDailyKm: 120, fuelEfficiency: 45, fuelTankCapacity: 7 },
};

// ─── CREATE BUNDLE ────────────────────────────────────────────────────────────
exports.createTripBundle = async (req, res) => {
    try {
        const {
            source, destination, numberOfDays, tripType, bikeType,
            bikeModel, engineCC, fuelTankCapacity, startDate,
            groupDetails, createdBy, notes,
        } = req.body;

        const tankCapacity = fuelTankCapacity || BIKE_PROFILES[bikeType]?.fuelTankCapacity || 15;
        const resolvedStyle = getStyleFromBikeType(bikeType);
        const variants = getVariantsForStyle(resolvedStyle);

        console.log(`\n🏍️  BUNDLE: ${source} → ${destination}`);
        console.log(`   bikeType: ${bikeType} → style: ${resolvedStyle}`);
        console.log(`   variants: ${variants.map(v => v.variantId).join(', ')}\n`);

        // Generate all 3 variants in parallel
        const { style, results, errors, successCount } = await generateAllItineraries({
            source, destination, numberOfDays, tripType, bikeType,
            bikeModel, engineCC, fuelTankCapacity: tankCapacity,
            startDate, groupDetails,
        });

        // Enrich each variant with map data
        const enriched = {};
        for (const [variantId, plan] of Object.entries(results)) {
            enriched[variantId] = enrichPlan(plan, style);
        }

        const bundleDoc = {
            bundleId: uuidv4(),
            source, destination, numberOfDays, tripType, bikeType,
            bikeModel: bikeModel || null,
            engineCC: engineCC || null,
            fuelTankCapacity: tankCapacity,
            startDate: startDate || null,
            groupDetails: tripType === 'group'
                ? { totalRiders: groupDetails?.totalRiders || 5, leadRider: groupDetails?.leadRider, sweepRider: groupDetails?.sweepRider }
                : { totalRiders: 1 },
            resolvedStyle,
            variantIds: variants.map(v => v.variantId),
            itineraries: enriched,
            generatedVariants: Object.keys(results),
            failedVariants: Object.keys(errors),
            generationErrors: Object.keys(errors).length > 0 ? errors : undefined,
            status: successCount === 3 ? 'ready' : successCount > 0 ? 'partial' : 'failed',
            createdBy: createdBy || 'anonymous',
            notes: notes || '',
        };

        const bundle = await TripBundle.create(bundleDoc);
        const summary = buildSummary(bundle);

        return res.status(201).json({
            success: true,
            message: `${successCount}/3 variants generated for bikeType "${bikeType}" (${resolvedStyle} style)`,
            bundleId: bundle.bundleId,
            bikeType,
            resolvedStyle,
            generatedVariants: bundle.generatedVariants,
            failedVariants: bundle.failedVariants.length ? bundle.failedVariants : undefined,
            summary,
            data: bundle,
        });
    } catch (err) {
        console.error('createTripBundle error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── SUMMARY BUILDER ──────────────────────────────────────────────────────────
const buildSummary = (bundle) => {
    const summary = {};
    for (const [variantId, itin] of Object.entries(bundle.itineraries || {})) {
        summary[variantId] = {
            variantId,
            variantLabel: itin.variantLabel,
            difficulty: itin.difficulty,
            tagline: itin.tagline,
            emoji: itin.emoji,
            palette: itin.palette,
            totalRoundTripKm: itin.routeSummary?.totalRoundTripKm,
            estimatedFuelCostINR: itin.routeSummary?.estimatedFuelCostINR,
            estimatedTollCostINR: itin.routeSummary?.estimatedTollCostINR,
            estimatedTotalBudgetINR: itin.routeSummary?.estimatedTotalBudgetINR,
            difficultyRating: itin.routeSummary?.difficultyRating,
            terrainType: itin.routeSummary?.terrainType,
            totalMapPins: (itin.mapPins || []).length,
            totalFuelStops: (itin.mapPins || []).filter(p => p.type === 'fuel_station').length,
            daysForward: (itin.dayPlans || []).filter(d => d.phase === 'forward').length,
            daysReturn: (itin.dayPlans || []).filter(d => d.phase === 'return').length,
        };
    }
    return summary;
};

// ─── LIST BUNDLES ─────────────────────────────────────────────────────────────
exports.getAllBundles = async (req, res) => {
    try {
        const { page = 1, limit = 10, tripType, bikeType, resolvedStyle, status } = req.query;
        const filter = {};
        if (tripType) filter.tripType = tripType;
        if (bikeType) filter.bikeType = bikeType;
        if (resolvedStyle) filter.resolvedStyle = resolvedStyle;
        if (status) filter.status = status;

        const bundles = await TripBundle.find(filter)
            .select('bundleId source destination numberOfDays tripType bikeType resolvedStyle variantIds status startDate createdAt')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await TripBundle.countDocuments(filter);

        return res.json({
            success: true, data: bundles,
            pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET FULL BUNDLE ──────────────────────────────────────────────────────────
exports.getBundleById = async (req, res) => {
    try {
        const bundle = await TripBundle.findOne({ bundleId: req.query.tripId });
        if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });
        return res.json({ success: true, data: bundle });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET SUMMARY ──────────────────────────────────────────────────────────────
exports.getBundleSummary = async (req, res) => {
    try {
        const bundle = await TripBundle.findOne({ bundleId: req.query.tripId });
        if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });

        return res.json({
            success: true,
            bundleId: bundle.bundleId,
            source: bundle.source,
            destination: bundle.destination,
            numberOfDays: bundle.numberOfDays,
            bikeType: bundle.bikeType,
            resolvedStyle: bundle.resolvedStyle,
            variantIds: bundle.variantIds,
            summary: buildSummary(bundle),
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET ONE VARIANT — ?tripId=&variantId= ────────────────────────────────────
exports.getVariant = async (req, res) => {
    try {
        const { tripId, variantId } = req.query;
        const bundle = await TripBundle.findOne({ bundleId: tripId });
        if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });

        const itin = bundle.itineraries && bundle.itineraries[variantId];
        if (!itin) {
            return res.status(404).json({
                success: false,
                message: `Variant "${variantId}" not found in this bundle`,
                availableVariants: bundle.generatedVariants,
            });
        }

        return res.json({ success: true, variantId, data: itin });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET ALL MAP DATA ─────────────────────────────────────────────────────────
exports.getAllStylesMapData = async (req, res) => {
    try {
        const bundle = await TripBundle.findOne({ bundleId: req.query.tripId });
        if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });

        const mapData = {};
        for (const [variantId, itin] of Object.entries(bundle.itineraries || {})) {
            mapData[variantId] = {
                variantLabel: itin.variantLabel,
                difficulty: itin.difficulty,
                palette: itin.palette,
                mapPins: itin.mapPins,
                geoJSON: itin.geoJSON,
                polyline: itin.mapPolyline,
            };
        }

        return res.json({ success: true, source: bundle.source, destination: bundle.destination, resolvedStyle: bundle.resolvedStyle, mapData });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET MAP DATA FOR ONE VARIANT — ?tripId=&variantId= ──────────────────────
exports.getVariantMapData = async (req, res) => {
    try {
        const { tripId, variantId } = req.query;
        const bundle = await TripBundle.findOne({ bundleId: tripId });
        if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });

        const itin = bundle.itineraries && bundle.itineraries[variantId];
        if (!itin) return res.status(404).json({ success: false, message: `Variant "${variantId}" not found` });

        return res.json({
            success: true, variantId,
            source: bundle.source, destination: bundle.destination,
            palette: itin.palette, mapPins: itin.mapPins, geoJSON: itin.geoJSON, polyline: itin.mapPolyline,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET DAY PLAN — ?tripId=&variantId=&day= ─────────────────────────────────
exports.getVariantDayPlan = async (req, res) => {
    try {
        const { tripId, variantId, day } = req.query;
        const bundle = await TripBundle.findOne({ bundleId: tripId });
        if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });

        const itin = bundle.itineraries && bundle.itineraries[variantId];
        if (!itin) return res.status(404).json({ success: false, message: `Variant "${variantId}" not found` });

        const dayPlan = (itin.dayPlans || []).find(d => d.dayNumber === Number(day));
        if (!dayPlan) return res.status(404).json({ success: false, message: `Day ${day} not found` });

        const dayPins = (itin.mapPins || []).filter(p => p.dayNumber === Number(day));
        return res.json({ success: true, variantId, dayNumber: Number(day), data: dayPlan, mapPins: dayPins });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET CHECKLIST — ?tripId=&variantId= ─────────────────────────────────────
exports.getVariantChecklist = async (req, res) => {
    try {
        const { tripId, variantId } = req.query;
        const bundle = await TripBundle.findOne({ bundleId: tripId });
        if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });

        const itin = bundle.itineraries && bundle.itineraries[variantId];
        if (!itin) return res.status(404).json({ success: false, message: `Variant "${variantId}" not found` });

        return res.json({
            success: true, variantId,
            variantLabel: itin.variantLabel,
            difficulty: itin.difficulty,
            ridingTips: itin.ridingTips,
            packingChecklist: itin.packingChecklist,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
exports.deleteBundle = async (req, res) => {
    try {
        const bundle = await TripBundle.findOneAndDelete({ bundleId: req.query.tripId });
        if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found' });
        return res.json({ success: true, message: 'Bundle deleted' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── META ─────────────────────────────────────────────────────────────────────
exports.getBikeTypeMapping = (req, res) => {
    const mapping = Object.entries(BIKE_TYPE_TO_STYLE).map(([bikeType, style]) => ({
        bikeType,
        resolvedStyle: style,
        variants: (STYLE_VARIANTS[style] || []).map(v => ({
            variantId: v.variantId,
            variantLabel: v.variantLabel,
            difficulty: v.difficulty,
            emoji: v.emoji,
            tagline: v.tagline,
        })),
    }));
    return res.json({ success: true, data: mapping });
};

exports.getBikeProfiles = (req, res) => {
    return res.json({
        success: true,
        data: Object.entries(BIKE_PROFILES).map(([type, p]) => ({ bikeType: type, ...p })),
    });
};
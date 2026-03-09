const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const authMiddleware = require('../middleware/authMiddleware');
const ctrl = require('../controllers/tripController');

const createBundleRules = [
    body('source').notEmpty().trim().withMessage('source is required'),
    body('destination').notEmpty().trim().withMessage('destination is required'),
    body('numberOfDays').isInt({ min: 2, max: 30 }).withMessage('numberOfDays must be 2-30'),
    body('tripType').isIn(['solo', 'group']).withMessage('tripType: solo | group'),
    body('bikeType')
        .isIn(['adventure', 'cruiser', 'sports', 'touring', 'dirt_bike', 'naked', 'scooter'])
        .withMessage('bikeType must be one of: adventure, cruiser, sports, touring, dirt_bike, naked, scooter'),
    body('engineCC').optional().isInt({ min: 50, max: 2500 }),
    body('fuelTankCapacity').optional().isFloat({ min: 3, max: 40 }),
    body('startDate').optional().isISO8601().withMessage('startDate: use YYYY-MM-DD'),
    body('groupDetails.totalRiders').optional().isInt({ min: 2, max: 100 }),
];

const requireTripId = query('tripId').notEmpty().withMessage('tripId query param is required');
const requireVariantId = query('variantId').notEmpty().withMessage('variantId query param is required');
const requireDay = query('day').isInt({ min: 1 }).withMessage('day must be a positive integer');

// ─── META ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/trips/bike-mapping
 * Shows bikeType → resolvedStyle → 3 variantIds.
 * Use this on frontend to know what variantIds a given bikeType will produce.
 */
router.get('/bike-mapping', ctrl.getBikeTypeMapping);

// ─── BUNDLE CRUD ──────────────────────────────────────────────────────────────

/**
 * POST /api/trips
 * Generates 3 itinerary variants based on bikeType.
 *
 *   adventure / dirt_bike              → adventure_easy, adventure_moderate, adventure_extreme
 *   cruiser / touring / sports / naked → cruise_scenic, cruise_express, cruise_coastal
 *   scooter                            → relax_countryside, relax_heritage, relax_nature
 *
 * Body: { source, destination, numberOfDays, tripType, bikeType,
 *         bikeModel?, engineCC?, fuelTankCapacity?, startDate?, groupDetails? }
 */
router.post('/request', createBundleRules, validate, ctrl.createTripBundle);

/**
 * GET /api/trips
 * List all bundles. Filter: ?tripType=&bikeType=&resolvedStyle=&status=
 */
router.get('/', ctrl.getAllBundles);

/**
 * GET /api/trips/bundle?tripId=<bundleId>
 * Full bundle with all 3 variant itineraries.
 */
router.get('/bundle', [requireTripId], validate, ctrl.getBundleById);

/**
 * GET /api/trips/summary?tripId=<bundleId>
 * Side-by-side comparison of all 3 variants (difficulty, km, budget, pins).
 */
router.get('/summary', [requireTripId], validate, ctrl.getBundleSummary);

/**
 * GET /api/trips/map?tripId=<bundleId>
 * Map data for all 3 variants — pins, GeoJSON, polylines, palettes.
 */
router.get('/map', [requireTripId], validate, ctrl.getAllStylesMapData);

/**
 * DELETE /api/trips/delete?tripId=<bundleId>
 */
router.delete('/delete', [requireTripId], validate, ctrl.deleteBundle);

// ─── VARIANT-SPECIFIC ROUTES ──────────────────────────────────────────────────

/**
 * GET /api/trips/variant?tripId=<bundleId>&variantId=<variantId>
 * Full itinerary for one variant.
 *
 * variantId values:
 *   adventure → adventure_easy | adventure_moderate | adventure_extreme
 *   cruise    → cruise_scenic  | cruise_express     | cruise_coastal
 *   relax     → relax_countryside | relax_heritage  | relax_nature
 */
router.get('/variant', [requireTripId, requireVariantId], validate, ctrl.getVariant);

/**
 * GET /api/trips/variant/map?tripId=<bundleId>&variantId=<variantId>
 * Map pins + GeoJSON + polyline for one variant.
 */
router.get('/variant/map', [requireTripId, requireVariantId], validate, ctrl.getVariantMapData);

/**
 * GET /api/trips/variant/day?tripId=<bundleId>&variantId=<variantId>&day=<number>
 * Single day plan + map pins for that day.
 */
router.get('/variant/day', [requireTripId, requireVariantId, requireDay], validate, ctrl.getVariantDayPlan);

/**
 * GET /api/trips/variant/checklist?tripId=<bundleId>&variantId=<variantId>
 * Packing checklist + riding tips for one variant.
 */
router.get('/variant/checklist', [requireTripId, requireVariantId], validate, ctrl.getVariantChecklist);

module.exports = router;
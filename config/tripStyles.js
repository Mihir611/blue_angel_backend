/**
 * tripStyles.js
 * Maps bikeType → trip style, and defines 3 variants per style.
 *
 * BIKE TYPE → STYLE MAP:
 *   adventure, dirt_bike              → adventure style
 *   cruiser, touring, sports, naked   → cruise style
 *   scooter                           → relax style
 *
 * Each style has 3 VARIANTS (easy / moderate / extreme) so the API
 * always returns 3 distinct itineraries regardless of bikeType.
 */

// ─── BIKE TYPE → STYLE MAPPING ────────────────────────────────────────────────
const BIKE_TYPE_TO_STYLE = {
    adventure: 'adventure',
    dirt_bike: 'adventure',
    cruiser: 'cruise',
    touring: 'cruise',
    sports: 'cruise',
    naked: 'cruise',
    scooter: 'relax',
};

// ─── STYLE VARIANTS (3 per style) ────────────────────────────────────────────
const STYLE_VARIANTS = {
    adventure: [
        {
            variantId: 'adventure_easy',
            variantLabel: 'Adventure — Easy',
            emoji: '🟢',
            difficulty: 'Easy',
            tagline: 'First gravel. First hills. First taste of the wild.',
            description: 'Beginner-friendly adventure — good gravel roads, mild off-road, reachable campsites.',
            palette: { primary: '#e67e22', mapPinAccent: 'orange', routeColor: '#d35400' },
            dailyKmModifier: 0.9,
            departureTime: '06:00 AM',
            routingBias: [
                'Prefer well-maintained gravel and forest roads over extreme off-road',
                'Avoid river crossings and very steep switchbacks',
                'Include popular biker-friendly campsites and dhabas near the route',
                'Keep daily distance under 200km — comfort matters on the first adventure',
                'Stick to routes with mobile network coverage where possible',
                'Include easy viewpoints and scenic stops with safe parking',
            ],
            stopBias: [
                'Include fuel stops every 100km — do not stretch the tank',
                'Add mechanic stops in larger towns along the route',
                'Emphasize food stops with proper meals — not just snacks',
                'Include one easy off-road or trail section per day as a highlight',
            ],
        },
        {
            variantId: 'adventure_moderate',
            variantLabel: 'Adventure — Moderate',
            emoji: '🟡',
            difficulty: 'Moderate',
            tagline: 'Real roads. Real dirt. Real riding.',
            description: 'Mixed terrain — highway approach, gravel climbs, moderate passes, river crossings.',
            palette: { primary: '#e74c3c', mapPinAccent: 'crimson', routeColor: '#c0392b' },
            dailyKmModifier: 0.75,
            departureTime: '05:45 AM',
            routingBias: [
                'Mix of highway approach and off-road sections each day',
                'Include mountain passes of moderate difficulty (1500m–3000m)',
                'Plan for unpaved sections of 20-50km per day',
                'Include river crossings where safe and manageable',
                'Allow detours on forest trails and lesser-known tracks',
                'Overnight at dhabas, basic guesthouses, or campsites depending on terrain',
            ],
            stopBias: [
                'Include mechanic stops — one per forward day minimum',
                'Show critical fuel stops — remote stretches likely',
                'Add river crossing waypoints as attraction stops',
                'Balance food dhabas with quick energy-bar breaks on off-road sections',
            ],
        },
        {
            variantId: 'adventure_extreme',
            variantLabel: 'Adventure — Extreme',
            emoji: '🔴',
            difficulty: 'Extreme',
            tagline: 'Push limits. Conquer terrain. Earn the view.',
            description: 'High-altitude passes, remote off-road trails, technical river crossings. Maximum challenge.',
            palette: { primary: '#922b21', mapPinAccent: 'darkred', routeColor: '#7b241c' },
            dailyKmModifier: 0.6,
            departureTime: '05:00 AM',
            routingBias: [
                'Prefer high-altitude passes above 3500m — the harder the better',
                'Include serious off-road: rocky tracks, sand, deep mud, loose gravel',
                'Plan for technical river crossings — scout on foot first',
                'Use remote forest trails and barely-marked jeep tracks',
                'Overnight at remote campsites — no hotels unless no alternative',
                'Include sections where fuel is 150+ km apart — carry extra',
                'Flag every extreme section clearly so rider can prepare',
            ],
            stopBias: [
                'Mechanic stops are critical — include in every major town before remote stretch',
                'Mark every fuel pump — gaps of 150-200km are expected',
                'Include technical off-road attraction stops: boulder fields, sand dunes, passes',
                'Minimal food comfort — energy bars, basic dhabas, self-cooked camping meals',
            ],
        },
    ],

    cruise: [
        {
            variantId: 'cruise_scenic',
            variantLabel: 'Cruise — Scenic Highway',
            emoji: '🌅',
            difficulty: 'Easy',
            tagline: 'Golden roads. Open skies. Just ride.',
            description: 'Scenic highway cruise — coastal roads, expressways, popular biker cafes, great hotels.',
            palette: { primary: '#f39c12', mapPinAccent: 'goldenrod', routeColor: '#d68910' },
            dailyKmModifier: 1.1,
            departureTime: '06:30 AM',
            routingBias: [
                'Choose the most scenic national highways and coastal roads',
                'Prioritize roads with great views, wide lanes, and minimal traffic',
                'Include famous highway biker cafe stops and popular dhabas',
                'Aim for 300-380 km per day — steady and comfortable',
                'Avoid industrial zones and congested city roads',
                'Recommend quality highway hotels and resorts for overnight stays',
            ],
            stopBias: [
                'Include popular biker cafes with Instagram-worthy views',
                'Show highway fuel plazas with food courts',
                'Add scenic overlooks and photo stops as attraction waypoints',
                'Recommend hotels with secure bike parking',
            ],
        },
        {
            variantId: 'cruise_express',
            variantLabel: 'Cruise — Express Run',
            emoji: '⚡',
            difficulty: 'Moderate',
            tagline: 'Max miles. Max speed. Max freedom.',
            description: 'Long-distance expressway blitz — cover serious ground, minimal stops, top highway hotels.',
            palette: { primary: '#e67e22', mapPinAccent: 'darkorange', routeColor: '#d35400' },
            dailyKmModifier: 1.3,
            departureTime: '05:30 AM',
            routingBias: [
                'Use expressways and 4-lane national highways exclusively',
                'Aim for 400-500 km per day — this is an express run',
                'Minimise city riding — bypass all major cities using ring roads',
                'Choose toll roads for speed and road quality',
                'Include only essential stops — fuel, food, stretch',
                'Plan overnight at highway highway hotels or business hotels near the road',
            ],
            stopBias: [
                'Fuel stops only at highway fuel plazas — no deviation',
                'Quick food stops at highway food courts — 30 min max',
                'Minimal attraction stops — this is about the ride not the sights',
                'Toll plaza waypoints for budget tracking',
            ],
        },
        {
            variantId: 'cruise_coastal',
            variantLabel: 'Cruise — Coastal & Offbeat',
            emoji: '🌊',
            difficulty: 'Moderate',
            tagline: 'Salt air. Winding roads. Hidden coves.',
            description: 'Coastal highway cruise mixed with offbeat inland roads — beaches, viewpoints, seafood stops.',
            palette: { primary: '#1a5276', mapPinAccent: 'steelblue', routeColor: '#154360' },
            dailyKmModifier: 1.0,
            departureTime: '06:30 AM',
            routingBias: [
                'Follow coastal highways and state roads hugging the shoreline',
                'Include offbeat coastal village roads and beach approach tracks',
                'Mix beach town overnight stays with highway stretches',
                'Aim for 250-350 km per day — scenic pace',
                'Include lighthouse stops, fishing village detours, cliff viewpoints',
                'Avoid inland industrial highways — keep it coastal',
            ],
            stopBias: [
                'Seafood restaurants and beach shacks as food stops',
                'Fuel stops in coastal towns — note remote coastal stretches',
                'Beach viewpoints and fishing harbours as attraction stops',
                'Coastal guesthouses and beach resorts for overnight',
            ],
        },
    ],

    relax: [
        {
            variantId: 'relax_countryside',
            variantLabel: 'Relax — Countryside Escape',
            emoji: '🌾',
            difficulty: 'Easy',
            tagline: 'Village roads. Green fields. Breathe.',
            description: 'Short daily rides through countryside, villages, local markets. No rush, no highway.',
            palette: { primary: '#27ae60', mapPinAccent: 'forestgreen', routeColor: '#1e8449' },
            dailyKmModifier: 0.5,
            departureTime: '08:00 AM',
            routingBias: [
                'Use only village roads and state B-roads — no national highways',
                'Keep daily distance under 120 km — afternoons are for exploring on foot',
                'Route through local weekly markets, farm stays, and artisan villages',
                'Include long lunch stops at local family restaurants',
                'Prioritise routes through paddy fields, orchards, and river valleys',
                'Overnight at homestays and farm stays — no chain hotels',
            ],
            stopBias: [
                'Long food stops at authentic local eateries — 60-90 min',
                'Village market stops as cultural attraction waypoints',
                'Scenic viewpoints with benches and shade for a proper rest',
                'Homestay and farm stay overnight recommendations',
            ],
        },
        {
            variantId: 'relax_heritage',
            variantLabel: 'Relax — Heritage & Culture',
            emoji: '🏛️',
            difficulty: 'Easy',
            tagline: 'Ancient stones. Living history. Slow miles.',
            description: 'Cultural circuit — temples, forts, palaces, local crafts. Short rides, long exploration.',
            palette: { primary: '#7d6608', mapPinAccent: 'goldenrod', routeColor: '#6e2f10' },
            dailyKmModifier: 0.45,
            departureTime: '08:30 AM',
            routingBias: [
                'Route through towns and districts known for historical significance',
                'Include temple circuits, fort visits, and palace towns',
                'Keep daily riding under 100 km — most time spent at heritage sites',
                'Use scenic B-roads connecting heritage towns — avoid highways',
                'Overnight at heritage hotels, palace guesthouses, or temple towns',
                'Include local craft villages and artisan workshops as stops',
            ],
            stopBias: [
                'Heritage site stops with 90-120 min duration each',
                'Local craft and souvenir market stops',
                'Traditional restaurant stops serving regional cuisine',
                'Heritage hotel or palace stay overnight recommendations',
            ],
        },
        {
            variantId: 'relax_nature',
            variantLabel: 'Relax — Nature & Wellness',
            emoji: '🌿',
            difficulty: 'Easy',
            tagline: 'Forest air. Still water. Just you.',
            description: 'Nature immersion — wildlife sanctuaries, forest roads, waterfalls, ayurvedic stays.',
            palette: { primary: '#1e8449', mapPinAccent: 'darkgreen', routeColor: '#196f3d' },
            dailyKmModifier: 0.5,
            departureTime: '07:30 AM',
            routingBias: [
                'Route through forest reserves, wildlife corridors, and hill stations',
                'Include waterfall detours, lake viewpoints, and botanical gardens',
                'Keep daily riding to 100-150 km — forest roads reward slow riding',
                'Overnight at jungle resorts, eco-lodges, or wellness retreats',
                'Avoid cities and industrial areas entirely',
                'Include dawn wildlife safari stops at sanctuaries along the route',
            ],
            stopBias: [
                'Waterfall and lake viewpoints as long attraction stops (45-60 min)',
                'Forest department rest houses or eco-lodge overnight stays',
                'Organic restaurant and wellness cafe food stops',
                'Wildlife sanctuary entry points as special waypoints',
            ],
        },
    ],
};

// ─── MAIN TRIP_STYLES (kept for pin colors and base config) ──────────────────
const TRIP_STYLES = {
    adventure: {
        id: 'adventure', label: 'Adventure Trip', emoji: '🏔️',
        palette: { primary: '#e74c3c', mapPinAccent: 'crimson', routeColor: '#c0392b' },
    },
    cruise: {
        id: 'cruise', label: 'Cruise Trip', emoji: '🛣️',
        palette: { primary: '#e67e22', mapPinAccent: 'darkorange', routeColor: '#d35400' },
    },
    relax: {
        id: 'relax', label: 'Relax Trip', emoji: '🌿',
        palette: { primary: '#27ae60', mapPinAccent: 'forestgreen', routeColor: '#2ecc71' },
    },
};

// ─── PIN COLOR MAPPING ────────────────────────────────────────────────────────
const getPinColor = (stopType, style) => {
    const universalColors = {
        fuel_station: 'red',
        food_dhaba: 'blue',
        mechanic: 'purple',
        overnight: 'black',
        start: 'darkgreen',
        end: 'darkred',
    };
    const styleColors = {
        adventure: { break: 'brown', attraction: 'crimson' },
        cruise: { break: 'orange', attraction: 'darkorange' },
        relax: { break: 'teal', attraction: 'forestgreen' },
    };
    return universalColors[stopType] || styleColors[style]?.[stopType] || 'grey';
};

// ─── HELPER: get style from bikeType ─────────────────────────────────────────
const getStyleFromBikeType = (bikeType) => {
    return BIKE_TYPE_TO_STYLE[bikeType] || 'cruise'; // default to cruise
};

// ─── HELPER: get 3 variants for a style ──────────────────────────────────────
const getVariantsForStyle = (style) => {
    return STYLE_VARIANTS[style] || STYLE_VARIANTS['cruise'];
};

module.exports = {
    TRIP_STYLES,
    STYLE_VARIANTS,
    BIKE_TYPE_TO_STYLE,
    getPinColor,
    getStyleFromBikeType,
    getVariantsForStyle,
};
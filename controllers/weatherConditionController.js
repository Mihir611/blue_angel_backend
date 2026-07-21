const { getRideConditions } = require('../utils/weatherUpdates');

const calculateRideAIIndex = (weatherWrapper, distanceKm = 100) => {
    const weatherData = weatherWrapper.weather;
    const { main, wind, clouds, visibility, rain, weather: conditions } = weatherData; // added rain & conditions array

    const feelsLikeC = main.feels_like;
    const humidity = main.humidity;
    const windSpeedKph = wind.speed * 3.6; // convert m/s → km/h early
    const cloudCover = clouds.all;
    const hasRain = rain?.['1h'] > 0 || conditions?.some(w => w.main === 'Rain' || w.main === 'Drizzle');

    let score = 100;

    // 🌡 Temperature (feels-like is key for rider comfort)
    if (feelsLikeC < 5) score -= 45;       // extreme cold → hypothermia risk
    else if (feelsLikeC < 12) score -= 25;
    else if (feelsLikeC < 18) score -= 10;
    else if (feelsLikeC <= 28) score -= 0; // sweet spot ~18–28 °C
    else if (feelsLikeC <= 34) score -= 15; // warm → mild discomfort
    else if (feelsLikeC <= 38) score -= 30; // hot → fatigue & dehydration risk
    else score -= 50;                       // extreme heat (>38) → very unsafe

    // 💧 Humidity (worsens heat perception & dehydration)
    if (humidity > 90) score -= 25;
    else if (humidity > 80) score -= 18;
    else if (humidity > 70) score -= 10;
    else if (humidity > 55) score -= 4;

    // 💨 Wind (very dangerous >40–50 km/h for motorbikes)
    if (windSpeedKph > 50) score -= 45;    // severe crosswind risk
    else if (windSpeedKph > 35) score -= 30;
    else if (windSpeedKph > 25) score -= 18;
    else if (windSpeedKph > 15) score -= 10;

    // 🌧 Rain (huge safety hit – traction & visibility)
    if (hasRain) {
        if (rain?.['1h'] > 5) score -= 40;   // heavy rain
        else score -= 25;                    // light/moderate rain
    }

    // ☁ Cloud + Heat combo (direct sun in heat = extra burn/fatigue)
    if (cloudCover < 30 && feelsLikeC > 32) score -= 12;

    // 👁 Visibility (critical for safety)
    if (visibility < 2000) score -= 35;    // very poor
    else if (visibility < 5000) score -= 18;
    else if (visibility < 8000) score -= 8;

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Hydration & fatigue prediction (more realistic scaling)
    let baseHydrationFactor = 1;
    if (feelsLikeC > 30) baseHydrationFactor += 1.5;
    if (feelsLikeC > 35) baseHydrationFactor += 2;
    if (humidity > 75) baseHydrationFactor += 0.8;
    if (hasRain) baseHydrationFactor += 0.5; // wet = still need fluids, discomfort

    // Scale with distance: more stops needed on longer rides in bad conditions
    let hydrationStops = Math.ceil((baseHydrationFactor * distanceKm) / 120); // ~every 120 km baseline in good conditions

    // AI-like ride status with nuance
    let rideStatus, aiInsight;
    if (score >= 85) {
        rideStatus = "Excellent Ride Conditions";
        aiInsight = "Optimal comfort & safety — ideal for long-distance enjoyment.";
    } else if (score >= 70) {
        rideStatus = "Good for Riding";
        aiInsight = "Generally favorable — minor adjustments for comfort recommended.";
    } else if (score >= 50) {
        rideStatus = "Moderate – Ride with Caution";
        aiInsight = "Increased fatigue & risk — plan more breaks & monitor closely.";
    } else if (score >= 30) {
        rideStatus = "Risky – Not Ideal";
        aiInsight = "Significant hazards (traction, wind, heat, visibility) — reconsider or prepare extensively.";
    } else {
        rideStatus = "Unsafe for Riding";
        aiInsight = "High risk of fatigue, loss of control, or dehydration — strongly advised to avoid or postpone.";
    }

    return {
        rideIndex: score,
        rideStatus,
        aiInsight,               // added "AI" commentary
        hydrationStops,
        location: weatherData.name,
        rawConditions: {
            feelsLikeC,
            humidity,
            windSpeedKph: Number(windSpeedKph.toFixed(1)),
            cloudCover,
            visibilityMeters: visibility,
            hasRain,
        }
    };
};

exports.getRideAndWeatherConditions = async (req, res) => {
    try {
        const { location, windUnit = "kph", distanceKm } = req.query;
        const dist = Number(distanceKm) || 100;

        const weatherData = await getRideConditions(location);
        const predictions = calculateRideAIIndex(weatherData, dist);

        const { main, wind } = weatherData.weather;
        const windSpeedMps = wind.speed;
        let convertedWindSpeed;
        let unitLabel;

        if (windUnit === "mph") {
            convertedWindSpeed = windSpeedMps * 2.237;
            unitLabel = "mph";
        } else {
            convertedWindSpeed = windSpeedMps * 3.6;
            unitLabel = "km/h";
        }

        const enhancedPredictions = {
            ...predictions,
            temp: main.temp,
            feelsLike: main.feels_like,
            humidity: main.humidity,
            windSpeed: Number(convertedWindSpeed.toFixed(2)),
            windUnit: unitLabel,
            distanceUsedKm: dist,
        };

        res.json(enhancedPredictions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
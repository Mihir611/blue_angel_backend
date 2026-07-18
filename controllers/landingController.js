const Events = require('../models/Events');
const Sliders = require('../models/Sliders');
const { updateExpiredEvents, updateExpiredSliders } = require('../utils/cleanEventsAndSliders');

const getEvents = async () => {
    try {
        let result = await updateExpiredEvents();
        if (result.success) {
            console.log('Script completed successfully');
        } else {
            console.error('Script failed:', result.error);
        }

        const events = await Events.find({ isActive: true })
            .sort({ eventDate: 1 }) // Sort by event date ascending
            .limit(5) // Limit to 10 events
            .select('title description imageUrl eventDate location category price'); // Select only necessary fields
        return events;
    } catch (err) {
        throw new Error('Failed to fetch events: ' + err.message);
    }
}

exports.getLandingPageEvents = async (req, res) => {
    try {
        const [events, sliders] = await Promise.all([getEvents()]);
        res.json({ events, sliders });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}
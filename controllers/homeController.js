const Events = require('../models/Events');
const Sliders = require('../models/Sliders');

const getAllEvents = async() => {
    try {
        const events = await Events.find({isActive: true})
            .sort({ eventDate: 1 }) // Sort by event date ascending
            .limit(10) // Limit to 10 events
            .select('title description imageUrl eventDate location category price'); // Select only necessary fields
        return events;
    } catch(err) {
        throw new Error('Failed to fetch events: ' + err.message);
    }
}

const getAllSliders = async() => {
    try {
        const sliders = await Sliders.find({isActive: true})
            .sort({ displayOrder: 1 }) // Sort by display order ascending
            .select('title description imageUrl link'); // Select only necessary fields
        return sliders;
    } catch(err) {
        throw new Error('Failed to fetch sliders: ' + err.message);
    }
}

exports.getHomePage = async (req, res) => {
    try {
        const [events, sliders] = await Promise.all([getAllEvents(), getAllSliders()]);
        res.json({ events, sliders });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}
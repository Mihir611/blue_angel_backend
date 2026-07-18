const Events = require('../models/Events');
const Sliders = require('../models/Sliders');
const { updateExpiredEvents, updateExpiredSliders } = require('../utils/cleanEventsAndSliders');

const getAllEvents = async () => {
    try {
        let result = await updateExpiredEvents();
        if (result.success) {
            console.log('Script completed successfully');
        } else {
            console.error('Script failed:', result.error);
        }

        const events = await Events.aggregate([
            { $match: { isActive: true } },            // Filter active events
            { $sample: { size: 5 } },                 // Pick 10 random events
            { $project: {                              // Select only necessary fields
                title: 1,
                description: 1,
                imageUrl: 1,
                eventDate: 1,
                location: 1,
                category: 1,
                price: 1
            }}
        ]);

        if (!events || events.length === 0) {
            return { success: false, message: 'No events found', data: [] };
        }

        return { success: true, data: events };
    } catch (err) {
        throw new Error('Failed to fetch events: ' + err.message);
    }
}

const getAllSliders = async () => {
    try {
        let result = await updateExpiredSliders();
        if (result.success) {
            console.log('Script completed successfully');
            console.log(`Summary: ${result.modifiedCount} sliders updated`);
        } else {
            console.error('Script failed:', result.error);
        }

        const sliders = await Sliders.aggregate([
            { $match: { isActive: true } },           // Filter active sliders
            { $sample: { size: 5 } },                  // Pick 5 random sliders
            { $project: {                              // Select only necessary fields
                title: 1,
                description: 1,
                imageUrl: 1,
                link: 1
            }}
        ]);

        if (!sliders || sliders.length === 0) {
            return { success: false, message: 'No sliders found', data: [] };
        }

        return { success: true, data: sliders };
    } catch (err) {
        throw new Error('Failed to fetch sliders: ' + err.message);
    }
}

exports.createEvents = async (req, res) => {
    const { eventsData } = req.body;

    const currentDate = new Date();
    const eventDate = new Date(eventsData.eventDate);
    currentDate.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate < currentDate) {
        return res.status(400).json({
            success: false,
            message: "Cannot create event for past dates. Event date must be today or in the future."
        });
    }

    try {
        await Events.create({
            "location": {
                "city": eventsData.city,
                "state": eventsData.state,
                "country": eventsData.country
            },
            "title": eventsData.title,
            "description": eventsData.description,
            "imageUrl": eventsData.imageUrl,
            "eventDate": new Date(eventsData.eventDate),
            "category": eventsData.category,
            "price": parseInt(eventsData.price),
            "contactInfo": {
                "email": eventsData.email,
                "phone": eventsData.phone
            },
            "tags": eventsData.tags,
            "isActive": eventsData.isActive,
        })

        return res.status(201).json({
            success: true,
            message: "Event created successfully",
            data: eventsData
        });
    } catch (error) {
        console.log(error)
        if (error.name === 'ValidationError') {
            const validationErrors = {};
            for (let field in error.errors) {
                validationErrors[field] = error.errors[field].message;
            }
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: validationErrors
            });
        }

        // Handle MongoDB duplicate key error (if unique constraints are added later)
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Event with this information already exists"
            });
        }

        // Handle invalid date format
        if (error.name === 'CastError' && error.path === 'eventDate') {
            return res.status(400).json({
                success: false,
                message: "Invalid date format for event date"
            });
        }

        // Handle general server errors
        return res.status(500).json({
            success: false,
            message: "Internal server error occurred while creating event"
        });
    }
}

exports.createSliders = async (req, res) => {
    const { sliderData } = req.body;

    try {

        if (!sliderData) {
            return res.status(400).json({
                success: false,
                message: "Slider data is required"
            });
        }

        if (!sliderData.title || !sliderData.imageUrl) {
            return res.status(400).json({
                success: false,
                message: "Title and image URL are required fields"
            });
        }

        const sliderDetails = await Sliders.create({
            "title": sliderData.title,
            "description": sliderData.description,
            "imageUrl": sliderData.imageUrl,
            "link": sliderData.link,
            "displayOrder": parseInt(sliderData.displayOrder) || 0,
            "isActive": sliderData.isActive !== undefined ? sliderData.isActive : true,
        });

        // Send success response
        return res.status(201).json({
            success: true,
            message: "Slider created successfully",
            data: sliderDetails
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const validationErrors = {};
            for (let field in error.errors) {
                validationErrors[field] = error.errors[field].message;
            }
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: validationErrors
            });
        }

        // Handle MongoDB duplicate key error (if unique constraints are added later)
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Slider with this information already exists"
            });
        }

        // Handle cast errors (invalid data types)
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid data type for field: ${error.path}`
            });
        }

        // Handle general server errors
        return res.status(500).json({
            success: false,
            message: "Internal server error occurred while creating slider"
        });
    }
}

exports.getHomePage = async (req, res) => {
    try {
        const [eventsResult, slidersResult] = await Promise.all([getAllEvents(), getAllSliders()]);
        res.json({
            events: {
                success: eventsResult.success,
                message: eventsResult.message || null,
                data: eventsResult.data,
            },
            sliders: {
                success: slidersResult.success,
                message: slidersResult.message || null,
                data: slidersResult.data,
            },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}

exports.getEventById = async (req, res) => {
    const { eventId } = req.query;

    try {
        const event = await Events.findById(eventId).select('title description imageUrl eventDate location category price contactInfo tags isActive');
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        res.status(200).json({ success: true, data: event });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
}

exports.getSliderById = async (req, res) => {
    const { sliderId } = req.query;

    try {
        const slider = await Sliders.findById(sliderId).select('title description imageUrl link displayOrder isActive');
        if (!slider) {
            return res.status(404).json({ success: false, message: 'Slider not found' });
        }
        res.status(200).json({ success: true, data: slider });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
}

exports.getEventSliders = async (req, res) => {
    const { id, entryType } = req.query;

    try {

        if(!id || !entryType) {
            return res.status(400).json({ success: false, message: 'ID and entry type are required' });
        }

        if (entryType === 'event') {
            const event = await Events.findById(id).select('title description imageUrl eventDate location category price contactInfo tags isActive');
            if (!event) {
                return res.status(404).json({ success: false, message: 'Event not found' });
            }
            res.status(200).json({ success: true, data: event });
        } else {
            const slider = await Sliders.findById(id).select('title description imageUrl link displayOrder isActive');
            if (!slider) {
                return res.status(404).json({ success: false, message: 'Slider not found' });
            }
            res.status(200).json({ success: true, data: slider });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
}
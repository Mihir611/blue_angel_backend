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

        const events = await Events.find({ isActive: true })
            .sort({ eventDate: 1 }) // Sort by event date ascending
            .limit(10) // Limit to 10 events
            .select('title description imageUrl eventDate location category price'); // Select only necessary fields
        return events;
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
            process.exit(1);
        }

        const sliders = await Sliders.find({ isActive: true })
            .sort({ displayOrder: 1 }) // Sort by display order ascending
            .select('title description imageUrl link'); // Select only necessary fields
        return sliders;
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

        if(!sliderData) {
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
        const [events, sliders] = await Promise.all([getAllEvents(), getAllSliders()]);
        res.json({ events, sliders });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}
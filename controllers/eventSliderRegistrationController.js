const EventsSliderRegistration = require('../models/EventAndSlidersRegistration');
const mongoose = require('mongoose');

exports.RegisterEvent = async (req, res) => {
    try {
        const { userEmail, registrationType, eventId, sliderId, notes, contactInfo } = req.body;

        if (!userEmail || !registrationType) {
            return res.status(400).json({ success: false, message: 'User Email and registration type are required' });
        }

        if (!['event', 'slider'].includes(registrationType)) {
            return res.status(400).json({
                success: false,
                message: 'Registration type must be either "event" or "slider"'
            });
        }

        // Validate required fields based on registration type
        if (registrationType === 'event' && !eventId) {
            return res.status(400).json({
                success: false,
                message: 'Event ID is required for event registration'
            });
        }

        if (registrationType === 'slider' && !sliderId) {
            return res.status(400).json({
                success: false,
                message: 'Slider ID is required for slider registration'
            });
        }

        // Validate ObjectId format
        if (registrationType === 'event' && !mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid event ID format'
            });
        }

        if (registrationType === 'slider' && !mongoose.Types.ObjectId.isValid(sliderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid slider ID format'
            });
        }

        // Build query conditions more carefully
        const queryConditions = { userEmail, isActive: true };
        
        if (registrationType === 'event') {
            queryConditions.eventId = eventId;
            queryConditions.registrationType = 'event';
        } else {
            queryConditions.sliderId = sliderId;
            queryConditions.registrationType = 'slider';
        }

        const existingRegistration = await EventsSliderRegistration.findOne(queryConditions);

        if (existingRegistration) {
            return res.status(409).json({
                success: false,
                message: `User is already registered for this ${registrationType}`
            });
        }

        const registrationData = {
            userEmail, registrationType, notes, contactInfo, isActive: true
        };

        if (registrationType === 'event') {
            registrationData.eventId = eventId;
        } else {
            registrationData.sliderId = sliderId;
        }

        const registration = new EventsSliderRegistration(registrationData);
        await registration.save();

        // Get full registration details with populated references
        const fullRegistration = await registration.getFullRegistrationDetails();

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: fullRegistration
        });
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'User is already registered for this event/slider'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

exports.getEventRegistrationByUser = async (req, res) => {
    try {
        const { userEmail } = req.params;
        const { type } = req.query;

        if (!userEmail) {
            return res.status(400).json({
                success: false,
                message: 'user email is required'
            });
        }

        const registrations = await EventsSliderRegistration.findByUserEmail(userEmail, type);

        const populatedRegistrations = await Promise.all(
            registrations.map(async (registration) => {
                return await registration.getFullRegistrationDetails();
            })
        );

        res.status(200).json({
            success: true,
            message: 'Registrations retrieved successfully',
            count: populatedRegistrations.length,
            data: populatedRegistrations
        });
    } catch (error) {
        console.error('Get user registrations error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

exports.getRegistrationByEvents = async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: 'Event ID is required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid event ID format'
            });
        }

        const registrations = await EventsSliderRegistration.findByEvent(eventId);

        // Populate references for each registration
        const populatedRegistrations = await Promise.all(
            registrations.map(async (registration) => {
                return await registration.getFullRegistrationDetails();
            })
        );

        res.status(200).json({
            success: true,
            message: 'Event registrations retrieved successfully',
            count: populatedRegistrations.length,
            data: populatedRegistrations
        });
    } catch (error) {
        console.error('Get event registrations error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

exports.getRegistrationBySliders = async (req, res) => {
    try {
        const { sliderId } = req.params;

        if (!sliderId) {
            return res.status(400).json({
                success: false,
                message: 'Slider ID is required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(sliderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid slider ID format'
            });
        }

        const registrations = await EventsSliderRegistration.findBySlider(sliderId);

        // Populate references for each registration
        const populatedRegistrations = await Promise.all(
            registrations.map(async (registration) => {
                return await registration.getFullRegistrationDetails();
            })
        );

        res.status(200).json({
            success: true,
            message: 'Slider registrations retrieved successfully',
            count: populatedRegistrations.length,
            data: populatedRegistrations
        });
    } catch (error) {
        console.error('Get slider registrations error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

exports.getAllRegistrations = async (req, res) => {
    try {
        const { page = 1, limit = 10, type, status } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = { isActive: true };

        if (type && ['event', 'slider'].includes(type)) {
            query.registrationType = type;
        }

        if (status && ['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
            query.status = status;
        }

        // Get total count for pagination
        const total = await EventsSliderRegistration.countDocuments(query);

        // Get registrations with pagination
        const registrations = await EventsSliderRegistration.find(query)
            .sort({ registrationDate: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Populate references for each registration
        const populatedRegistrations = await Promise.all(
            registrations.map(async (registration) => {
                return await registration.getFullRegistrationDetails();
            })
        );

        res.status(200).json({
            success: true,
            message: 'Active registrations retrieved successfully',
            data: populatedRegistrations,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get all active registrations error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

exports.updateRegistrationStatus = async (req, res) => {
    try {
        const { registrationId } = req.params;
        const { status } = req.body;

        if (!registrationId) {
            return res.status(400).json({
                success: false,
                message: 'Registration ID is required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid registration ID format'
            });
        }

        if (!status || !['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status is required (pending, confirmed, cancelled, completed)'
            });
        }

        const registration = await EventsSliderRegistration.findByIdAndUpdate(
            registrationId,
            { status },
            { new: true }
        );

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        const populatedRegistration = await registration.getFullRegistrationDetails();

        res.status(200).json({
            success: true,
            message: 'Registration status updated successfully',
            data: populatedRegistration
        });
    } catch (error) {
        console.error('Update registration status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

exports.deleteRegistrations = async (req, res) => {
    try {
        const { registrationId } = req.params;

        if (!registrationId) {
            return res.status(400).json({
                success: false,
                message: 'Registration ID is required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid registration ID format'
            });
        }

        const registration = await EventsSliderRegistration.findByIdAndUpdate(
            registrationId,
            { isActive: false },
            { new: true }
        );

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Registration deleted successfully'
        });
    } catch (error) {
        console.error('Delete registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}
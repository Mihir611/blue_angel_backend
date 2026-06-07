const appFeedback = require('../models/feedback/appFeedbackSchema');
const itineraryFeedback = require('../models/feedback/itineraryFeedback');
const { getUserByEmail } = require('../utils/getUserDetailsHelper');

exports.postAppFeedback = async (req, res) => {
    const { userEmail, appFeedbackData } = req.body;

    if (!userEmail) {
        return res.status(400).json({ success: false, message: 'User email is required' });
    }

    if (!appFeedbackData || Object.keys(appFeedbackData).length === 0) {
        return res.status(400).json({ success: false, message: 'App feedback data is required' });
    }

    try {
        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const { overallExp, navigation, performance, design, message } = appFeedbackData;

        const newAppFeedback = new AppFeedback({
            user: user.userId,
            overallExp,
            navigation,
            performance,
            design,
            message
        });

        const saved = await newAppFeedback.save();

        return res.status(201).json({ success: true, message: 'App feedback submitted successfully', data: saved });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ success: false, message: 'Validation failed', errors: validationErrors });
        }
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: `Invalid format for field: ${error.path}` });
        }
        console.error('postAppFeedback error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

exports.updateItineraryFeedback = async (req, res) => {
    const { userEmail, itineraryFeedbackData } = req.body;

    if (!userEmail) {
        return res.status(400).json({ success: false, message: 'User email is required' });
    }

    if (!itineraryFeedbackData || Object.keys(itineraryFeedbackData).length === 0) {
        return res.status(400).json({ success: false, message: 'Itinerary feedback data is required' });
    }

    const { itineraryId } = itineraryFeedbackData;

    if (!itineraryId) {
        return res.status(400).json({ success: false, message: 'itineraryId is required' });
    }

    try {
        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const existingFeedback = await itineraryFeedback.findOne({
            user: user.userId,
            itineraryId
        });

        if (!existingFeedback) {
            return res.status(404).json({ success: false, message: 'Feedback record not found for this itinerary' });
        }

        if (existingFeedback.rating > 0) {
            return res.status(409).json({ success: false, message: 'Feedback already submitted for this itinerary' });
        }

        const {
            itineraryTitle, rating, message, highlights,
            improvements, wouldFollow, accuracy, roadQuality,
            sceneryRating, navigationEase, actualDuration,
            completedItinerary, favoriteStop, safetyRating
        } = itineraryFeedbackData;

        const updated = await itineraryFeedback.findOneAndUpdate(
            { user: user.userId, itineraryId },
            {
                $set: {
                    itineraryTitle,
                    rating,
                    message,
                    highlights:         highlights      ?? [],
                    improvements:       improvements    ?? [],
                    wouldFollow:        wouldFollow     ?? false,
                    accuracy,
                    roadQuality,
                    sceneryRating,
                    navigationEase,
                    actualDuration,
                    completedItinerary,
                    favoriteStop,
                    safetyRating
                }
            },
            { returnDocument: 'after', runValidators: true }
        );

        return res.status(200).json({ success: true, message: 'Itinerary feedback submitted successfully', data: updated });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ success: false, message: 'Validation failed', errors: validationErrors });
        }
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: `Invalid format for field: ${error.path}` });
        }
        console.error('putItineraryFeedback error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

exports.getFeedback = async (req, res) => {
    const { userEmail } = req.query;
    if (!userEmail) {
        return res.status(400).json({ success: false, message: 'User email is required' });
    }
    try {
        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const [appFeedbacks, itineraryFeedbacks] = await Promise.all([
            appFeedback.find({ user: user.userId }).select('rating message -_id').lean(),
            itineraryFeedback.find({ user: user.userId }).select('rating message itineraryTitle -_id').lean(),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                hasAppFeedback: appFeedbacks.length > 0,
                hasItineraryFeedback: itineraryFeedbacks.length > 0,
            }
        });
        
    } catch (error) {
        console.error('Fetch feedback error', error);
        return res.status(500).json({ success: false, message: 'An error occured while fetching feedback' });
    }
}

exports.getUnmarkedFeedbacks = async (req, res) => {
    const {userEmail} = req.query;
    if(!userEmail) {
        return res.status(400).json({ success: false, message: 'User email is required' });
    }
    try {
        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const pendingFeedbacks = await itineraryFeedback.find({
            user: user.userId,
            rating: 0,
        }).lean();

        return res.status(200).json({ success: true, count: pendingFeedbacks.length, data: pendingFeedbacks, message: pendingFeedbacks.length ? 'Pending feedbacks fetched successfully': 'No pending feedbacks'});
    } catch (error) {
        console.error('Get Unmarked ITineraries Error:', error);
        return res.status(500).json({ success: false, message: "Internal server error"});
    }
}
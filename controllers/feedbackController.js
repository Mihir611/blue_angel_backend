const appFeedback = require('../models/feedback/appFeedbackSchema');
const itineraryFeedback = require('../models/feedback/itineraryFeedback');
const { getUserByEmail } = require('../utils/getUserDetailsHelper');

exports.postFeedback = async (req, res) => {
    const { userEmail, appFeedbackData, itineraryFeedbackData } = req.body;

    if (!userEmail) {
        return res.status(400).json({ success: false, message: 'User email is required' });
    }

    if (!appFeedbackData && !itineraryFeedbackData) {
        return res.status(400).json({ success: false, message: 'At least one feedback type (app or itinerary) must be provided' });
    }

    try {
        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const results = {};
        //Handelling app feedback
        if (appFeedbackData) {
            const { rating, message, easeOfUse, wouldRecommend } = appFeedbackData;

            if (!rating || !message) {
                return res.status(400).json({ success: false, message: 'App feedback requires both rating and message' });
            }

            const newAppFeedback = new appFeedback({
                user: user.userId,
                rating,
                message,
                easeOfUse,
                wouldRecommend
            });

            const savedAppFeedabck = await newAppFeedback.save();
            results.appFeedback = savedAppFeedabck;
        }

        //Handelling itinerary feedback
        if (itineraryFeedbackData) {
            const { itineraryId, itineraryTitle, rating, message, highlights, improvements, wouldFollow, accuracy, roadQuality, sceneryRating, navigationEase, actualDuration, completedItinerary, favoriteStop, safetyRating } = itineraryFeedbackData;

            if (!itineraryId || !rating || !message) {
                return res.status(400).json({ success: false, message: 'Itinerary feedback requires itineraryId, rating, and message' });
            }

            const newItineraryFeedback = new itineraryFeedback({
                user: user.userId,
                itineraryId,
                itineraryTitle,
                rating,
                message,
                highlights: highlights ?? [],
                improvements: improvements ?? [],
                wouldFollow: wouldFollow ?? null,
                accuracy,
                roadQuality,
                sceneryRating,
                navigationEase,
                actualDuration,
                completedItinerary,
                favoriteStop,
                safetyRating,
            });

            const savedItineraryFeedback = await new newItineraryFeedback.save();
            results.itineraryFeedback = savedItineraryFeedback;
        }

        return res.status(201).json({ success: true, message: 'Feedback submitted successfully', data: results });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({ success: false, message: 'Validation failed', errors: validationErrors });
        }

        // Handle invalid ObjectId format for itineraryId
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: `Invalid format for field: ${error.path}` });
        }

        console.error('Feedback submission error:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while submitting feedback' });
    }
}

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
            appFeedback, find({ user: user.userId }).select('rating message - _id').lean(),
            itineraryFeedback.find({ user: user.userId }).select('rating message itineraryTitle - _id').lean(),
        ]);

        if (!appFeedbacks.length && !itineraryFeedbacks.length) {
            return res.status(404).json({success: false, message: 'No feedback found for this user'});
        }

        return res.status(200).json({ success: true, data: { appFeedbacks, itineraryFeedbacks } });
    } catch (error) {
        console.error('Fetch feedback error', error);
        return res.status(500).json({ success: false, message: 'An error occured while fetching feedback' });
    }
}
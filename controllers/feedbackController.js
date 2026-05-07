const appFeedback = require('../models/feedback/appFeedbackSchema');
const itineraryFeedback = require('../models/feedback/itineraryFeedback');
const { getUserByEmail } = require('../utils/getUserDetailsHelper');

exports.postFeedback = async (req, res) => {
    const { userEmail, appFeedbackData, itineraryFeedbackData } = req.body;

    if (!userEmail) {
        return res.status(400).json({ success: false, message: 'User email is required' });
    }

    const hasAppFeedback = appFeedbackData && Object.keys(appFeedbackData).length > 0;
    const hasItineraryFeedback = itineraryFeedbackData && Object.keys(itineraryFeedbackData).length > 0;

    if (!hasAppFeedback && !hasItineraryFeedback) {
        return res.status(400).json({ success: false, message: 'At least one feedback type (app or itinerary) must be provided' });
    }

    try {
        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const results = {};

        if (hasAppFeedback) {
            const { overallExp, navigation, performance, design, message } = appFeedbackData;

            const newAppFeedback = new appFeedback({
                user: user.userId,
                overallExp,
                navigation,
                performance,
                design,
                message
            });

            results.appFeedback = await newAppFeedback.save();
        }

        if (hasItineraryFeedback) {
            const {
                itineraryId, itineraryTitle, rating, message, highlights,
                improvements, wouldFollow, accuracy, roadQuality, sceneryRating,
                navigationEase, actualDuration, completedItinerary, favoriteStop, safetyRating
            } = itineraryFeedbackData;

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

            results.itineraryFeedback = await newItineraryFeedback.save();
        }

        const message = hasAppFeedback && hasItineraryFeedback
            ? 'Both feedbacks submitted successfully'
            : hasAppFeedback
                ? 'App feedback submitted successfully'
                : 'Itinerary feedback submitted successfully';

        return res.status(201).json({ success: true, message, data: results });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({ success: false, message: 'Validation failed', errors: validationErrors });
        }

        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: `Invalid format for field: ${error.path}` });
        }

        console.error('Feedback submission error:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while submitting feedback' });
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
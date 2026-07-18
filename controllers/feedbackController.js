const appFeedback = require('../models/feedback/appFeedbackSchema');
const itineraryFeedback = require('../models/feedback/itineraryFeedback');
const { getUserByEmail } = require('../utils/getUserDetailsHelper');

exports.postFeedback = async (req, res) => {
    const { userEmail, appFeedbackData, itineraryFeedbackData } = req.body;

    if (!userEmail) {
        return res.status(400).json({ success: false, message: 'User email is required' });
    }

    const hasApp = appFeedbackData && Object.keys(appFeedbackData).length > 0;
    const hasItinerary = itineraryFeedbackData && Object.keys(itineraryFeedbackData).length > 0;

    if (!hasApp && !hasItinerary) {
        return res.status(400).json({ success: false, message: 'At least one of appFeedbackData or itineraryFeedbackData is required' });
    }

    const results = {};
    const errors = {};

    if (hasApp) {
        // Delegate by calling the handler logic directly via a mock req/res
        await new Promise((resolve) => {
            const mockRes = {
                status(code) { this._code = code; return this; },
                json(data) {
                    if (this._code >= 400) errors.app = data;
                    else results.app = data;
                    resolve();
                }
            };
            exports.postAppFeedback({ body: { userEmail, appFeedbackData } }, mockRes);
        });
    }

    if (hasItinerary) {
        await new Promise((resolve) => {
            const mockRes = {
                status(code) { this._code = code; return this; },
                json(data) {
                    if (this._code >= 400) errors.itinerary = data;
                    else results.itinerary = data;
                    resolve();
                }
            };
            exports.createItineraryFeedback({ body: { userEmail, itineraryFeedbackData } }, mockRes);
        });
    }

    const hasErrors = Object.keys(errors).length > 0;
    const hasResults = Object.keys(results).length > 0;

    if (hasErrors && !hasResults) {
        return res.status(400).json({ success: false, message: 'Feedback submission failed', errors });
    }

    if (hasErrors && hasResults) {
        return res.status(207).json({ success: true, message: 'Partial feedback submitted', data: results, errors });
    }

    return res.status(201).json({ success: true, message: 'Feedback submitted successfully', data: results });
};

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

exports.createItineraryFeedback = async (req, res) => {
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

        if (existingFeedback) {
            return res.status(409).json({ success: false, message: 'Feedback already submitted for this itinerary' });
        }

        const {
            itineraryTitle, rating, message, highlights,
            improvements, wouldFollow, accuracy, roadQuality,
            sceneryRating, navigationEase, actualDuration,
            completedItinerary, favoriteStop, safetyRating
        } = itineraryFeedbackData;

        const newItineraryFeedback = new itineraryFeedback({
            user: user.userId,
            itineraryId,
            itineraryTitle,
            rating,
            message,
            highlights: highlights ?? [],
            improvements: improvements ?? [],
            wouldFollow: wouldFollow ?? false,
            accuracy,
            roadQuality,
            sceneryRating,
            navigationEase,
            actualDuration,
            completedItinerary,
            favoriteStop,
            safetyRating
        });

        const saved = await newItineraryFeedback.save();
        const selectedItineraryUpdate = await SelectedItinerary.findOneAndUpdate(
            { user: user.userId, itinerary_id: itineraryId },
            { $set: { itineraryStatus: 'Completed' } },
            { new: true }
        );

        if (!selectedItineraryUpdate) {
            console.warn(`createItineraryFeedback: no SelectedItinerary found for user ${user.userId}, itinerary ${itineraryId}`);
        }

        return res.status(201).json({
            success: true, message: 'Itinerary feedback submitted successfully', data: {
                feedback: saved,
                itineraryStatus: selectedItineraryUpdate?.itineraryStatus ?? null
            }
        });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ success: false, message: 'Validation failed', errors: validationErrors });
        }
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: `Invalid format for field: ${error.path}` });
        }
        console.error('createItineraryFeedback error:', error);
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
    const { userEmail } = req.query;
    if (!userEmail) {
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

        return res.status(200).json({ success: true, count: pendingFeedbacks.length, data: pendingFeedbacks, message: pendingFeedbacks.length ? 'Pending feedbacks fetched successfully' : 'No pending feedbacks' });
    } catch (error) {
        console.error('Get Unmarked ITineraries Error:', error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}
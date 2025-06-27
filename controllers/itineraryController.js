const { ItineraryRequest, ItineraryResponse } = require('../models/Itinerary');
const { generateMultipleTravelItinerariesSeparate } = require('../utils/gpthelper');

//#region Helper functions
const generateItineraryAsyc = async (responseId, travelData) => {
    try {
        const gptResponse = await generateMultipleTravelItinerariesSeparate(travelData);

        if(gptResponse.success) {
            let generatedItinerary;
            try {
                if(typeof gptResponse.data.rawItineraries === 'string') {
                    const jsonMatch = gptResponse.data.rawItineraries.match(/```json\s*([\s\S]*?)\s*```/);
                    const jsonString = jsonMatch ? jsonMatch[1] : gptResponse.data.rawItineraries;
            
                    generatedItinerary = JSON.parse(jsonString);
                }
                else {
                    generatedItinerary = gptResponse.data.itineraries.itineraries;
                }
            } catch (error) {
                console.warn('Could not parse itinerary as JSON, using raw text');
                generatedItinerary = gptResponse.data.itinerary.itinerary;
            }
            await ItineraryResponse.findByIdAndUpdate(responseId, {
                status: 'completed',
                generatedItinerary: generatedItinerary ? generatedItinerary : gptResponse.itinerary, // Remove the wrapping array
                generatedAt: new Date(),
                tokenUsed: gptResponse.data.tokenUsage || null
            });
            console.log("itinerary generated successfully for responseID:", responseId);
        } else {
            await ItineraryResponse.findByIdAndUpdate(responseId, {
                status: 'failed',
                error: gptResponse.error || 'Unknown error occurred',
                failedAt: new Date()
            });

            console.error('GPT filed to generate itinerary:', gptResponse.error);
        }
    } catch (error) {
        await ItineraryResponse.findByIdAndUpdate(responseId, {
            status: 'failed',
            errorMessage: error.message,
            failedAt: new Date()
        });

        console.error('Error in async itinerary generation:', error);
    }
}

//#endregion Helper functions
exports.generateItinerary = async(req, res) => {
    const {rideType, rideSource, rideDestination, rideDuration, locationPreference} = req.body;
    const requestedBy = req.body.email;

    try {
        const itineraryRequest = await ItineraryRequest.create({
            rideType,
            rideSource,
            rideDestination,
            rideDuration,
            locationPreference,
            requestedBy,
            status: 'processing'
        });

        // Check if there are similar requests to potentially generate multiple variations
        const similarRequests = await ItineraryRequest.findSimilar(rideSource, rideDestination, rideType);

        // Getting the Itinerary plan from gpt using the data given by the user
        const travelData = {
            source: rideSource,
            destination: rideDestination,
            days: parseInt(rideDuration),
            travelMode: rideType,
            preferences: locationPreference ? locationPreference.split(',').map(pref => pref.trim()) : [
                'off-beat places',
                'mountains',
                'off-road adventures',
                'hidden gems',
                'scenic routes',
                'adventure activities',
                'local culture'
            ],
            variationNumber: similarRequests.length + 1, // Increment for each similar request
        };

        const itineraryResponse = await ItineraryResponse.create({
            requestId: itineraryRequest._id,
            status: 'processing',
        });

        itineraryRequest.addResponseReferences(itineraryResponse._id);
        await itineraryRequest.save();

        generateItineraryAsyc(itineraryResponse._id, travelData);

        res.status(200).json({
            message: "Itinerary request submitted successfully",
            requestId: itineraryRequest._id,
            responseId: itineraryResponse._id,
            estimatedTime: "2-3 minutes"
        });
    } catch(err) {
        console.error("Error generating itinerary:", err);
        res.status(500).json({error: "Failed to request itinerary"});
    }
}



exports.getItinerary = async(req, res) => {
    const email = req.query.email;
    try {
        const itineraries = await ItineraryRequest.findUserRequestsWithItineraries(email);

        if (!itineraries || itineraries.length === 0) {
            return res.status(404).json({message: "No itineraries found for this user"});
        }
        // Format the response to include all completed itineraries
        const formattedItineraries = itineraries.map(request => ({
            requestId: request._id,
            rideType: request.rideType,
            rideSource: request.rideSource,
            rideDestination: request.rideDestination,
            rideDuration: request.rideDuration,
            formattedDuration: request.formattedDuration,
            locationPreference: request.locationPreference,
            requestedBy: request.requestedBy,
            status: request.status,
            generatedCount: request.generatedCount,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            itineraries: request.itineraryResponses.map(response => ({
                responseId: response._id,
                itinerary: response.generatedItinerary,
                tokenUsed: response.tokenUsed,
                version: response.version,
                model: response.model,
                generatedAt: response.generatedAt,
                createdAt: response.createdAt
            }))
        }));


        res.status(200).json(formattedItineraries);
    } catch(err) {
        console.error("Error fetching itineraries:", err);
        res.status(500).json({error: "Failed to fetch itineraries"});
    }
}

exports.getAllItineraries = async(req, res) => {
    try {
        const itineraries = await ItineraryRequest.find().populate({path: 'itineraryResponses', match: {status: 'completed'}}).sort({createdAt: -1});

        if (!itineraries || itineraries.length === 0) {
            return res.status(404).json({message: "No itineraries found"});
        }

        const formattedItineraries = itineraries
            .filter(request => request.itineraryResponses.length > 0)
            .map(request => ({
                requestId: request._id,
                rideType: request.rideType,
                rideSource: request.rideSource,
                rideDestination: request.rideDestination,
                rideDuration: request.rideDuration,
                formattedDuration: request.formattedDuration,
                locationPreference: request.locationPreference,
                requestedBy: request.requestedBy,
                status: request.status,
                generatedCount: request.generatedCount,
                createdAt: request.createdAt,
                updatedAt: request.updatedAt,
                itineraries: request.itineraryResponses.map(response => ({
                    responseId: response._id,
                    itinerary: response.generatedItinerary,
                    tokenUsed: response.tokenUsed,
                    version: response.version,
                    model: response.model,
                    generatedAt: response.generatedAt,
                    createdAt: response.createdAt
                }))
            }));

        res.status(200).json(formattedItineraries);
    } catch(err) {
        console.error("Error fetching all itineraries:", err);
        res.status(500).json({error: "Failed to fetch all itineraries"});
    }
}

// New endpoint to get itinerary status
exports.getItineraryStatus = async (req, res) => {
    const { requestId } = req.params;

    try {
        const request = await ItineraryRequest.findById(requestId)
            .populate('itineraryResponses');

        if (!request) {
            return res.status(404).json({ message: "Itinerary request not found" });
        }

        const responseStatuses = request.itineraryResponses.map(response => ({
            responseId: response._id,
            status: response.status,
            hasItinerary: response.generatedItinerary && response.generatedItinerary.length > 0,
            errorMessage: response.errorMessage,
            createdAt: response.createdAt,
            generatedAt: response.generatedAt
        }));

        res.status(200).json({
            requestId: request._id,
            overallStatus: request.status,
            generatedCount: request.generatedCount,
            responses: responseStatuses
        });

    } catch (err) {
        console.error("Error fetching itinerary status:", err);
        res.status(500).json({ error: "Failed to fetch itinerary status" });
    }
};

// New endpoint to generate additional itinerary for existing request
exports.generateAdditionalItinerary = async (req, res) => {
    const { requestId } = req.params;

    try {
        const request = await ItineraryRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({ message: "Itinerary request not found" });
        }

        // Create new response for the same request
        const itineraryResponse = await ItineraryResponse.create({
            requestId: request._id,
            status: 'processing',
            version: request.generatedCount + 1
        });

        // Add response reference to request
        request.addResponseReference(itineraryResponse._id);
        await request.save();

        // Prepare travel data
        const travelData = {
            source: request.rideSource,
            destination: request.rideDestination,
            days: parseInt(request.rideDuration),
            travelMode: request.rideType,
            preferences: request.locationPreference ? 
                request.locationPreference.split(',').map(pref => pref.trim()) : [
                    'off-beat places',
                    'mountains',
                    'off-road adventures',
                    'hidden gems',
                    'scenic routes',
                    'adventure activities',
                    'local culture'
                ],
            variationNumber: request.generatedCount + 1
        };

        // Generate itinerary asynchronously
        generateItineraryAsyc(itineraryResponse._id, travelData);

        res.status(200).json({
            message: "Additional itinerary generation started",
            requestId: request._id,
            responseId: itineraryResponse._id,
            version: itineraryResponse.version
        });

    } catch (err) {
        console.error("Error generating additional itinerary:", err);
        res.status(500).json({ error: "Failed to generate additional itinerary" });
    }
};

// New endpoint to get a specific itinerary response
exports.getSpecificItinerary = async (req, res) => {
    const { responseId } = req.params;

    try {
        const response = await ItineraryResponse.findById(responseId)
            .populate('requestId');

        if (!response) {
            return res.status(404).json({ message: "Itinerary response not found" });
        }

        res.status(200).json({
            responseId: response._id,
            requestDetails: {
                requestId: response.requestId._id,
                rideType: response.requestId.rideType,
                rideSource: response.requestId.rideSource,
                rideDestination: response.requestId.rideDestination,
                rideDuration: response.requestId.rideDuration,
                locationPreference: response.requestId.locationPreference,
                requestedBy: response.requestId.requestedBy
            },
            status: response.status,
            itinerary: response.generatedItinerary,
            tokenUsage: response.tokenUsage,
            version: response.version,
            model: response.model,
            errorMessage: response.errorMessage,
            generatedAt: response.generatedAt,
            createdAt: response.createdAt
        });

    } catch (err) {
        console.error("Error fetching specific itinerary:", err);
        res.status(500).json({ error: "Failed to fetch specific itinerary" });
    }
};
const mongoose = require('mongoose');

// Ride Itinerary Schema
const rideItineraryRequestSchema = new mongoose.Schema({
	rideType: { type: String, enum: ['Solo Ride', 'Squad Ride'], required: true },
	rideSource: { type: String, required: true, trim: true },
	rideDestination: { type: String, required: true, trim: true },
	rideDuration: { type: Number, required: true, min: 1 },
	locationPreference: { type: String, enum: ['Off-beat', 'Well-known'], required: true },
	requestedBy: { type: String, ref: 'User', required: true },
	itineraryResponses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ItineraryResponse' }],
	status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
	generatedCount: { type: Number, default: 0 },
}, { timestamps: true });

const rideItineraryResponseSchema = new mongoose.Schema({
	requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ItineraryRequest', required: true }, // Fixed ref
	status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
	generatedItinerary: [{ type: mongoose.Schema.Types.Mixed }],
	errorMessage: { type: String, default: null },
	tokenUsed: { type: { promptTokenCount: Number, candidatesTokenCount: Number, totalTokenCount: Number }, default: null },
	version: { type: Number, default: 1 },
	model: { type: String, default: 'gpt-3.5-turbo' },
	generatedAt: { type: Date, default: null },
	failedAt: { type: Date, default: null },
}, { timestamps: true });

// indexng
rideItineraryRequestSchema.index({ requestedBy: 1, createdAt: -1 });
rideItineraryRequestSchema.index({ rideSource: 1, rideDestination: 1, rideType: 1 });
rideItineraryRequestSchema.index({ status: 1 });

rideItineraryResponseSchema.index({ requestId: 1 });
rideItineraryResponseSchema.index({ status: 1 });
rideItineraryResponseSchema.index({ createdAt: -1 });

rideItineraryRequestSchema.virtual('formattedDuration').get(function () {
	return `${this.rideDuration} ${this.rideDuration === 1 ? 'day' : 'days'}`;
});

rideItineraryRequestSchema.virtual('completedResponsesCount', {
	ref: 'ItineraryResponse',
	localField: '_id',
	foreignField: 'requestId',
	count: true,
	match: { status: 'completed' }
});

// Method to check if request has any completed itineraries
rideItineraryRequestSchema.methods.hasCompletedItineraries = function () {
	return this.generatedCount > 0;
};

// Method to add a new response reference
rideItineraryRequestSchema.methods.addResponseReferences = function (responseId) {
	if (!this.itineraryResponses.includes(responseId)) {
		this.itineraryResponses.push(responseId);
		this.generatedCount = this.itineraryResponses.length;
	}
};

// Static method to find similar requests (same source, destination, and type)
rideItineraryRequestSchema.statics.findSimilar = function (source, destination, rideType) {
	return this.find({
		rideSource: new RegExp(source, 'i'),
		rideDestination: new RegExp(destination, 'i'),
		rideType: rideType
	}).populate('itineraryResponses');
}

// Static method to find user's requests with completed itineraries
rideItineraryRequestSchema.statics.findUserRequestsWithItineraries = function (email) {
	return this.find({
		requestedBy: email,
		generatedCount: { $gt: 0 }
	}).populate({
		path: 'itineraryResponses',
		match: { status: 'completed' }
	}).sort({ createdAt: -1 });
};

rideItineraryResponseSchema.methods.addItinerary = function (itinerary) {
	this.generatedItinerary.push(itinerary);
	return this.save();
};

// Method to get itinerary count
rideItineraryResponseSchema.methods.getItineraryCount = function () {
	return this.generatedItinerary ? this.generatedItinerary.length : 0;
};

// Check if response is ready
rideItineraryResponseSchema.methods.isReady = function () {
	return this.status === 'completed' && this.generatedItinerary;
};

// Static method to find completed resposnes for a request
rideItineraryResponseSchema.statics.findCompletedByRequests = function (requestId) {
	return this.find({
		requestId: requestId,
		status: 'completed'
	}).sort({ generatedAt: -1 });
};

// midelware to update timestamps
rideItineraryResponseSchema.pre('save', function(next) {
	if (this.status === 'completed' && !this.generatedAt) {
		this.generatedAt = new Date();
	} else if (this.status === 'failed' && !this.failedAt) {
		this.failedAt = new Date();
	}
	next();
});

// Enhanced middleware to update request status after response status changes
rideItineraryResponseSchema.post('save', async function(doc, next) {
	try {
		const ItineraryRequest = mongoose.model('ItineraryRequest'); // Fixed model name
		const request = await ItineraryRequest.findById(doc.requestId);

		if (request) {
			// Add response reference if not already present
			if (!request.itineraryResponses.includes(doc._id)) {
				request.itineraryResponses.push(doc._id);
			}

			// Update generated count
			request.generatedCount = request.itineraryResponses.length;

			// Get all responses for this request to determine overall status
			const responses = await mongoose.model('ItineraryResponse').find({ 
				requestId: doc.requestId 
			});

			// Determine the new status based on response statuses
			const hasCompleted = responses.some(r => r.status === 'completed');
			const hasProcessing = responses.some(r => r.status === 'processing');
			const allFailed = responses.length > 0 && responses.every(r => r.status === 'failed');

			// Update request status based on response statuses
			if (hasCompleted) {
				request.status = 'completed';
			} else if (allFailed) {
				request.status = 'failed';
			} else if (hasProcessing) {
				request.status = 'processing';
			}

			await request.save();
		}
	} catch (error) {
		console.error('Error updating itinerary request after response save:', error);
	}
	
	if (next) next();
});

// Middleware to handle status changes and update request accordingly
rideItineraryResponseSchema.pre('findOneAndUpdate', async function(next) {
	try {
		// Get the document being updated
		const docToUpdate = await this.model.findOne(this.getQuery());
		if (docToUpdate && this.getUpdate().$set && this.getUpdate().$set.status) {
			// Store the old status to compare later
			this._oldStatus = docToUpdate.status;
			this._newStatus = this.getUpdate().$set.status;
			this._requestId = docToUpdate.requestId;
		}
	} catch (error) {
		console.error('Error in pre findOneAndUpdate:', error);
	}
	next();
});

rideItineraryResponseSchema.post('findOneAndUpdate', async function(doc, next) {
	try {
		// Only proceed if status actually changed
		if (this._oldStatus && this._newStatus && this._oldStatus !== this._newStatus) {
			const ItineraryRequest = mongoose.model('ItineraryRequest'); // Fixed model name
			const request = await ItineraryRequest.findById(this._requestId);

			if (request) {
				// Get all responses for this request
				const responses = await mongoose.model('ItineraryResponse').find({ 
					requestId: this._requestId 
				});

				// Determine the new status
				const hasCompleted = responses.some(r => r.status === 'completed');
				const hasProcessing = responses.some(r => r.status === 'processing');
				const allFailed = responses.length > 0 && responses.every(r => r.status === 'failed');

				let newRequestStatus = request.status;
				if (hasCompleted) {
					newRequestStatus = 'completed';
				} else if (allFailed) {
					newRequestStatus = 'failed';
				} else if (hasProcessing) {
					newRequestStatus = 'processing';
				}

				// Only update if status actually needs to change
				if (request.status !== newRequestStatus) {
					request.status = newRequestStatus;
					await request.save();
				}
			}
		}
	} catch (error) {
		console.error('Error updating request status after response update:', error);
	}
	
	if (next) next();
});

module.exports = {
	ItineraryRequest: mongoose.model('ItineraryRequest', rideItineraryRequestSchema), // Fixed typo
	ItineraryResponse: mongoose.model('ItineraryResponse', rideItineraryResponseSchema)
};
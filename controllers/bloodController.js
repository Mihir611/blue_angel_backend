const BloodRequest = require('../models/BloodSchema');

const ALLOWED_FIELDS = [
    'requestId',
    'patientName',
    'bloodGroup',
    'unitsRequired',
    'urgency',
    'hospital',
    'contactNumber',
    'alternateContactNumber',
    'requiredBy',
    'additionalNotes',
    'status'
];

const pickAllowedFields = (body) => {
    const payload = {};
    ALLOWED_FIELDS.forEach((field) => {
        if (body[field] !== undefined) payload[field] = body[field];
    });
    return payload;
};

exports.createBloodRequest = async (req, res) => {
    try {
        const payload = pickAllowedFields(req.body);

        if (!payload.patientName || !payload.bloodGroup || !payload.hospital) {
            return res.status(400).json({
                Success: false,
                message: 'patientName, bloodGroup, and hospital are required'
            });
        }

        const bloodRequest = await BloodRequest.create({
            ...payload,
            createdBy: req.user.userId
        });

        res.status(201).json({
            Success: true,
            data: { bloodRequest }
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                Success: false,
                message: 'A blood request with that requestId already exists'
            });
        }
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                Success: false,
                message: err.message
            });
        }
        res.status(500).json({
            Success: false,
            message: 'Something went wrong while creating the blood request'
        });
    }
};

exports.getAllBloodRequests = async (req, res) => {
    try {
        const {
            status = 'active',
            bloodGroup,
            city,
            urgency,
            page = 1,
            limit = 20
        } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (bloodGroup) filter.bloodGroup = bloodGroup;
        if (urgency) filter.urgency = urgency;
        if (city) filter['hospital.city'] = new RegExp(`^${city}$`, 'i');

        const skip = (Number(page) - 1) * Number(limit);

        const [bloodRequests, total] = await Promise.all([
            BloodRequest.find(filter)
                .sort({ urgency: 1, createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            BloodRequest.countDocuments(filter)
        ]);

        res.status(200).json({
            Success: true,
            message: 'Blood requests fetched successfully',
            results: bloodRequests.length,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            data: { bloodRequests }
        });
    } catch (err) {
        res.status(500).json({
            Success: false,
            message: 'Something went wrong while fetching blood requests'
        });
    }
};

exports.getNearbyBloodRequests = async (req, res) => {
    try {
        const { lng, lat, maxDistance = 10000, bloodGroup } = req.query;

        if (!lng || !lat) {
            return res.status(400).json({
                Success: false,
                message: 'lng and lat query params are required'
            });
        }

        const filter = {
            status: 'active',
            'hospital.location': {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [Number(lng), Number(lat)]
                    },
                    $maxDistance: Number(maxDistance)
                }
            }
        };
        if (bloodGroup) filter.bloodGroup = bloodGroup;

        const bloodRequests = await BloodRequest.find(filter).lean();

        res.status(200).json({
            Success: true,
            message: 'Nearby blood requests fetched successfully',
            results: bloodRequests.length,
            data: { bloodRequests }
        });
    } catch (err) {
        res.status(500).json({
            Success: false,
            message: 'Something went wrong while fetching nearby blood requests'
        });
    }
};

exports.getBloodRequest = async (req, res) => {
    try {
        const bloodRequest = await BloodRequest.findOne({
            requestId: req.params.requestId
        }).lean();

        if (!bloodRequest) {
            return res.status(404).json({
                Success: false,
                message: 'No blood request found with that ID'
            });
        }

        res.status(200).json({
            Success: true,
            message: 'Blood request fetched successfully',
            data: { bloodRequest }
        });
    } catch (err) {
        res.status(500).json({
            Success: false,
            message: 'Something went wrong while fetching the blood request'
        });
    }
};

exports.updateBloodRequest = async (req, res) => {
    try {
        const payload = pickAllowedFields(req.body);
        payload.updatedBy = req.user.userId;

        const bloodRequest = await BloodRequest.findOneAndUpdate(
            { requestId: req.params.requestId },
            payload,
            { new: true, runValidators: true }
        );

        if (!bloodRequest) {
            return res.status(404).json({
                Success: false,
                message: 'No blood request found with that ID'
            });
        }

        res.status(200).json({
            Success: true,
            message: 'Blood request updated successfully',
            data: { bloodRequest }
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                Success: false,
                message: err.message
            });
        }
        if (err.name === 'CastError') {
            return res.status(400).json({
                Success: false,
                message: `Invalid value for field: ${err.path}`
            });
        }
        res.status(500).json({
            Success: false,
            message: 'Something went wrong while updating the blood request'
        });
    }
};

// DELETE /api/blood-requests/:requestId
exports.deleteBloodRequest = async (req, res) => {
    try {
        const bloodRequest = await BloodRequest.findOneAndDelete({
            requestId: req.params.requestId
        });

        if (!bloodRequest) {
            return res.status(404).json({
                Success: false,
                message: 'No blood request found with that ID'
            });
        }

        res.status(200).json({
            Success: true,
            message: 'Blood request deleted successfully'
        });
    } catch (err) {
        res.status(500).json({
            Success: false,
            message: 'Something went wrong while deleting the blood request'
        });
    }
};
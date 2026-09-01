const CommunityMaster = require('../models/CommunityMaster');
const joinRequests = require('../models/ClubJoinRequests');
const CommunityApplication = require('../models/communityApplication');
const User = require('../models/User');
const { UserXp } = require('../models/achievementsMaster');
const { nanoid } = require('nanoid');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const SEARCH_FIELD_WEIGHTS = {
    communityName: 10,
    tagline: 5,
    description: 3,
    'location.city': 2,
    'location.state': 2,
    'location.country': 1,
    'general.name': 1,
};
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.createCommunity = async (req, res) => {
    try {
        const { communityName, email, phoneNumber, logo, incorporationDate, description, tagline, instagramHandle, location, general, hasSubCommunities, communityLevel } = req.body;
        const existingCommunity = await CommunityMaster.findOne({ communityName }).lean();
        if (existingCommunity) {
            return res.status(409).json({ Success: false, message: 'A Community with this name already exists' })
        }
        const community = await CommunityMaster.create({
            communityName,
            email,
            phoneNumber,
            logo,
            incorporationDate,
            description,
            tagline,
            instagramHandle,
            location,
            general,
            hasSubCommunities,
        })

        res.status(201).json({ Success: true, message: 'Community successfully created' });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ Success: false, message: 'A Community with this name already exists' })
        }
        res.status(400).json({ Success: false, message: err.message })
    }
}

exports.getCommunity = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || DEFAULT_PAGE, 1);
        const limit = Math.min(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.city) filter['location.city'] = req.query.city;
        if (req.query.state) filter['location.state'] = req.query.state;
        if (req.query.country) filter['location.country'] = req.query.country;

        const [communities, total] = await Promise.all([
            CommunityMaster.find(filter).sort({ communityLevel: -1 }).skip(skip).limit(limit).lean(),
            CommunityMaster.countDocuments(filter),
        ]);

        res.status(200).json({ Success: true, results: communities.length, total, page, totalPages: Math.ceil(total / limit), data: { communities } });
    } catch (err) {
        res.status(500).json({ Success: false, message: err.message });
    }
}

exports.getCommunityById = async (req, res) => {
    try {
        const { id } = req.params;

        const community = await CommunityMaster.findById(id).lean();

        if (!community) {
            return res.status(404).json({ Success: false, message: 'No community found with that ID' });
        }

        res.status(200).json({ 'Success': true, data: { community } });
    } catch (err) {
        res.status(500).json({ Success: false, message: err.message });
    }
}

exports.updateCommunity = async (req, res) => {
    try {
        const { id } = req.params;

        const allowedTopLevelFields = ['description', 'tagline', 'instagramHandle', 'hasSubCommunities'];
        const allowedGeneralFields = ['namne', 'email', 'phoneNumber'];

        const updates = {}
        allowedTopLevelFields.forEach((field) => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        allowedGeneralFields.forEach((field) => {
            if (req.body.general?.[field] !== undefined) updates[`general.${field}`] = req.body.general[field];
        });

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ 'Success': false, message: 'No valid updatable fields provided' });
        }

        const community = await CommunityMaster.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
        if (!community) {
            return res.status(404).json({ Success: false, message: 'No community found with that ID' });
        }

        res.status(200).json({ Success: true, data: { community }, message: 'Community details have been updated' });
    } catch (err) {
        res.status(400).json({ Success: false, message: "Couldn't update the community details" });
    }
}

exports.searchCommunities = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || !q.trim()) {
            return res.status(400).json({ Success: false, message: "Search query 'q' is required" });
        }

        const page = Math.max(parseInt(req.query.page, 10) || DEFAULT_PAGE, 1);
        const limit = Math.min(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);
        const skip = (page - 1) * limit;
        const searchFields = Object.keys(SEARCH_FIELD_WEIGHTS);
        const terms = q.trim().split(/\s+/).map(escapeRegex);
        const termRegexes = terms.map((term) => new RegExp(term, 'i'));
        const matchStage = {
            $or: termRegexes.flatMap((regex) =>
                searchFields.map((field) => ({ [field]: regex }))
            ),
        };
        const scoreExpr = {
            $add: termRegexes.flatMap((regex) =>
                searchFields.map((field) => ({
                    $cond: [
                        { $regexMatch: { input: { $ifNull: [`$${field}`, ''] }, regex } },
                        SEARCH_FIELD_WEIGHTS[field],
                        0,
                    ],
                }))
            ),

        }

        const basePipeline = [{ $match: matchStage }];

        const [results, totalCountArr] = await Promise.all([
            Community.aggregate([
                ...basePipeline,
                { $addFields: { _relevanceScore: scoreExpr } },
                { $sort: { _relevanceScore: -1, communityLevel: -1 } },
                { $skip: skip },
                { $limit: limit },
            ]),
            Community.aggregate([...basePipeline, { $count: 'total' }]),
        ]);

        const total = totalCountArr[0]?.total || 0;

        res.status(200).json({
            Success: true,
            results: results.length,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            data: { communities: results },
        });
    } catch (err) {
        res.status(500).json({ Success: false, message: err.message })
    }
}

exports.deleteCommunity = async (req, res) => {
    try {
        const { id } = req.params;
        const commuity = await CommunityMaster.findByIdAndDelete(id);
        if (!community) {
            return res.status(404).json({ Success: false, message: `No community found with this id: ${id}` });
        }

        res.status(204).json({ Success: true, data: null })
    } catch (err) {
        res.status(500).json({ Success: false, message: err.message })
    }
}

exports.RequestNewCommunity = async (req, res) => {
    try {
        const applicantUserId = req.user.id;
        const {
            communityName,
            email,
            phoneNumber,
            logo,
            incorporationDate,
            description,
            tagline,
            instagramHandle,
            location,
            general,
            hasSubCommunities,
        } = req.body;

        const applicant = await User.findOne({ userId: applicantUserId });
        if (!applicant || !applicant.isVerified) {
            return res.status(403).json({ Success: false, message: 'Account must be verified to apply' });
        }

        if (applicant.role === 'CommunityAdmin') {
            return res.status(409).json({ Success: false, message: 'You already administer a community' });
        }

        const xpDoc = await UserXp.findOne({ user: applicantUserId }).lean();
        const riderLevel = xpDoc?.level || 1;
        if (riderLevel < 30) {
            return res.status(403).json({
                Success: false,
                message: `You must reach rider level 30 to apply for a community. Current level: ${riderLevel}.`
            });
        }

        const existingPending = await CommunityApplication.findOne({ applicantUserId, status: 'pending' });
        if (existingPending) {
            return res.status(409).json({ Success: false, message: 'You already have a pending application' });
        }

        const application = await CommunityApplication.create({
            applicantUserId, communityName, email, phoneNumber, logo,
            incorporationDate, description, tagline, instagramHandle, location
        });
        return res.status(201).json({ Success: true, message: 'Application submitted for review', data: { applicationId: application.applicationId } });
    } catch (err) {
        return res.status(500).json({ Success: false, message: err.message })
    }
}

exports.getApplications = async (req, res) => {
    try {
        let applications = await CommunityApplication.find({ status: 'pending' }).lean();
        if (applications.length === 0) {
            return res.status(204).json({ Success: true, message: 'No pending application', data: {} })
        }
        return res.status(200).json({ Success: true, data: { applications }, message: 'Here are some applications to review' });
    } catch (error) {
        console.error(error);

        return res.status(500).json({ Success: false, message: 'Failed to fetch applications', error: error.message });
    }
}

exports.ReviewApplication = async (req, res) => {
    const { applicationId } = req.params;
    const { decision, rejectionReason } = req.body;
    const reviewerId = req.userId;

    try {
        if (!['approved', 'rejected'].includes(decision)) {
            return res.status(400).json({ Success: false, message: 'Invalid decision' });
        }

        const application = await CommunityApplication.findOne({ applicationId, status: 'pending' });

        if (!application) {
            return res.status(404).json({ Success: false, message: 'Pending application not found' });
        }
        if (decision === 'rejected') {
            application.status = 'rejected';
            application.reviewedBy = reviewerId;
            application.reviewedAt = new Date();
            application.rejectionReason = rejectionReason || 'Not specified';
            await application.save();
            return res.status(200).json({ Success: true, message: 'Application rejected' });
        }

        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            const applicant = await User.findOne({ userId: application.applicantUserId }).session(session);
            if (!applicant) {
                await session.abortTransaction();
                return res.status(404).json({ Success: false, message: 'Applicant no longer exists' });
            }
            if (applicant.role === 'CommunityAdmin') {
                await session.abortTransaction();
                return res.status(409).json({ Success: false, message: 'Applicant already administers a community' });
            }

            const communityId = `MotonomaadCommunity${nanoid(10)}`;
            await Community.create([{
                communityId,
                communityName: application.communityName,
                email: application.email,
                phoneNumber: application.phoneNumber,
                logo: application.logo,
                incorporationDate: application.incorporationDate,
                description: application.description,
                tagline: application.tagline,
                instagramHandle: application.instagramHandle,
                location: application.location,
                general: {
                    userId: applicant.userId,
                    name: `${applicant.firstname || ''} ${applicant.lastname || ''}`.trim() || applicant.email,
                    email: applicant.email,
                    phoneNumber: applicant.phone
                }
            }], { session });

            await User.findOneAndUpdate(
                { userId: applicant.userId },
                { $set: { role: 'CommunityAdmin', adminOfCommunityId: communityId } },
                { session }
            );

            application.status = 'approved';
            application.reviewedBy = reviewerId;
            application.reviewedAt = new Date();
            await application.save({ session });

            await session.commitTransaction();
            return res.status(200).json({ Success: true, message: 'Application approved, community created', data: { communityId } });
        } catch (txErr) {
            await session.abortTransaction();
            console.error(txErr);
            return res.status(500).json({ Success: false, message: 'Approval failed' });
        } finally {
            session.endSession();
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ Success: false, message: 'Failed to review application' });
    }
}
const Bikes = require('../models/Bikes');
const User = require('../models/User');
const { hashPassword, validatePassword } = require('../utils/hash')
const { getUserByEmail } = require('../utils/getUserDetailsHelper');

exports.getProfile = async (req, res) => {
	if (!req.query.userEmail) {
		return res.status(400).json({ success: false, message: 'User email is required' });
	}
	try {
		// Use findOne instead of find since you want a single user
		const user = await User.findOne({ email: req.query.userEmail })
			.select('-otp -isVerified -hash -salt -refreshToken -otpExpiresAt')
			.lean();

		if (!user) {
			return res.status(404).json({
				success: false,
				message: 'User not found'
			});
		}

		// Get the latest bike - using user._id instead of email for better performance
		const bike = await Bikes.findOne({ owner: user.userId, bikeStatus: 'primary' })
			.sort({ createdAt: -1 })
			.lean();

		// Add bike information to user object
		user.bikeName = bike ? bike.bikeName : null;
		user.bikeManufacturer = bike ? bike.manufacturer : null;
		user.bikeModel = bike ? bike.model : null;

		res.json({
			success: true,
			data: user
		});
	} catch (error) {
		console.error('Error fetching user profile:', error);
		res.status(500).json({
			success: false,
			message: 'Error fetching user profile',
			error: error.message
		});
	}
};

exports.updateProfile = async (req, res) => {
	const { userEmail } = req.query;
	if (!userEmail) {
		return res.status(400).json({ success: false, message: 'User email is required' });
	}

	// Only include fields that are actually present in the request body
	// to avoid overwriting existing data with undefined
	const allowedFields = [
		'username', 'firstname', 'lastname', 'bio', 'dob',
		'bloodgroup', 'gender', 'profession', 'emergencyContact'
	];

	const updateFields = {};
	for (const field of allowedFields) {
		if (req.body[field] !== undefined) {
			updateFields[field] = req.body[field];
		}
	}

	/* Handle profile picture separately — maps to the correct schema field name
	if (req.body.processedPicture !== undefined) {
		updateFields.profilePictue = req.body.processedPicture; // matches schema typo
	}*/

	if (Object.keys(updateFields).length === 0) {
		return res.status(400).json({ success: false, message: 'No valid fields provided for update' });
	}

	try {
		const user = await getUserByEmail(userEmail);
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}
		if (updateFields.dob) {
			const [day, month, year] = updateFields.dob.split('/');
			const parsed = new Date(`${year}-${month}-${day}`);

			if (isNaN(parsed.getTime())) {
				return res.status(400).json({ success: false, message: 'Invalid date format. Use DD/MM/YYYY' });
			}

			updateFields.dob = parsed;
		}
		// Use user._id (ObjectId) not user.userId (custom String field)
		const updatedUser = await User.findByIdAndUpdate(
			user._id,                    // <-- fixed: was user.userId
			{ $set: updateFields },      // <-- fixed: use $set to only update provided fields
			{ new: true, runValidators: true }
		).select('-otp -isVerified -hash -salt -refreshToken -otpExpiresAt');

		res.status(201).json({ success: true, data: updatedUser });
	} catch (err) {
		console.log(err);
		res.status(400).json({ success: false, error: 'Update failed', details: err.message });
	}
};


exports.changePassword = async (req, res) => {
	const { oldPassword, newPassword } = req.body;

	if (!oldPassword || !newPassword) {
		return res.status(400).json({ message: 'Old password and new password are required' });
	}

	if (oldPassword === newPassword) {
		return res.status(400).json({ message: 'New password must be different from the current password' });
	}

	try {
		// req.user.id comes from your auth middleware (JWT etc.) — correct approach
		const user = await User.findById(req.user.id);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		if (!validatePassword(oldPassword, user.hash, user.salt)) {
			return res.status(400).json({ message: 'Incorrect current password' });
		}

		const { salt, hash } = hashPassword(newPassword);
		user.salt = salt;
		user.hash = hash;
		await user.save();

		return res.json({ success: true, message: 'Password updated successfully' });

	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Server error' });
	}
};

exports.getEmergencyContact = async (req, res) => {
	const { userEmail } = req.query;

	if (!userEmail) {
		return res.status(400).json({ success: false, message: 'UserEmail is required' });
	}

	try {
		const user = await getUserByEmail(userEmail);
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}
		console.log(user)
		if (!user.emergencyContact || !user.emergencyContact.contactNumber) {
			return res.status(404).json({ success: false, message: 'No emergency contact found for this user' });
		}
		return res.status(200).json({ 
			success: true, 
			message: 'Emergency contacts retrived', 
			data: { 
				name: user.firstname + user.lastname, 
				bloodGroup: user.bloodgroup, 
				emergencyContact: { 
					name: user.emergencyContact.name, 
					relation: user.emergencyContact.relation, 
					phone: user.emergencyContact.contactNumber 
				}, 
				medicalNotes: '' 
			} 
		});
	} catch (Error) {
		console.log(Error);
		return res.status(500).json({ success: false, message: 'Internal Server error' });
	}
}
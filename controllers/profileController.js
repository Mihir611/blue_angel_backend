const Bikes = require('../models/Bikes');
const User = require('../models/User');
const { hashPassword, validatePassword } = require('../utils/hash')

exports.getProfile = async (req, res) => {
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
    const bike = await Bikes.findOne({ owner: req.query.userEmail })
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
  const updateFields = {
    username: req.body.username,
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    bio: req.body.bio,
    dob: req.body.dob,
    bloodgroup: req.body.bloodgroup,
    gender: req.body.gender,
    profession: req.body.profession,
    processedPicture: req.body.processedPicture,
  };

  try {
    const updatedUser = await User.findByIdAndUpdate(req.user.id, updateFields, {
      new: true,
      runValidators: true,
    }).select('-otp -isVerified -hash -salt -refreshToken -otpExpiresAt');
    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ error: 'Update failed', details: err.message });
  }
};


exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });



    if (!validatePassword(oldPassword, user.hash, user.salt)) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    // Generate new salt and hash
    const { salt, hash } = hashPassword(newPassword);


    // Save new credentials
    user.salt = salt;
    user.hash = hash;
    await user.save();

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

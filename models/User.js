const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  phone: String,
  hash: String,
  salt: String,
  isVerified: { type: Boolean, default: false },
  refreshToken: String,
  otp: String, // hashed OTP
  otpExpiresAt: Date,

  // Profile fields
  username: { type: String, unique: true },
  firstname: String,
  lastname: String,
  bio: String,
  dob: Date,
  bloodgroup: String,
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  profession: String,
  profilePictue: String,
  userDeactivated: { type: Boolean, default: false },
});

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
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
  emergencyContact: {
    name: { type: String },
    relation: { type: String, enum: ['Father', 'Mother', 'Brother', 'Sister', 'Gurdian'] },
    contactNumber: { type: String }
  },
  userDeactivated: { type: Boolean, default: false },
});

module.exports = mongoose.model('User', userSchema);

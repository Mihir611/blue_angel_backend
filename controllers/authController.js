const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { hashPassword, validatePassword } = require('../utils/hash');
const sendEmail = require('../utils/sendEmail');
const { generateOtp, hashOtp } = require('../utils/otp');
const { generateTokens } = require('../middleware/authMiddleware');
const { isDisposableEmail } = require('../utils/validateEmail');
const catchAsync = require('../utils/catchAsyncHandller');

exports.register = catchAsync(async (req, res) => {
  const { email, phone, password } = req.body.registrationData;

  if (isDisposableEmail(email)) {
    console.log(`Blocked disposable email attempt: ${email}`);
    return res.status(400).json({Success: false, message:"Disposable email addresses are not allowed."});
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({Success: false, message:"An account with this email id already exists, please login"});
  }

  const { hash, salt } = hashPassword(password);
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await User.create({ email, phone, hash, salt, otp: otpHash, otpExpiresAt });
  await sendEmail(email, "Verify Your Email", `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`);

  res.status(201).json({Success: true, message: "OTP sent to your email"});
});

exports.verifyOtp = catchAsync(async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({Success: false, message: "User not found"});
  if (user.isVerified) return res.status(400).json({Success: false, message: "User already verified"});

  const hashedInputOtp = hashOtp(otp);
  const isOtpValid = user.otp === hashedInputOtp && new Date() < user.otpExpiresAt;
  if (!isOtpValid) return res.status(400).json({Success: false, message: "Invalid or expired OTP"});

  user.isVerified = true;
  user.otp = null;
  user.otpExpiresAt = null;
  await user.save();

  res.status(200).json({Success: true, message:"Email verified successfully"});
});

exports.resendOtp = catchAsync(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user || user.isVerified) return res.status(400).send("Invalid request");

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.otp = otpHash;
  user.otpExpiresAt = otpExpiresAt;
  await user.save();

  await sendEmail(email, "Resend OTP", `<p>Your new OTP is <b>${otp}</b>.</p>`);
  res.status(201).json({Success: true, message:"OTP resent"});
});

exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || !user.isVerified) return res.status(401).json({Success: false, message: "Email not verified or user not found"});

  const isValid = validatePassword(password, user.hash, user.salt);
  if (!isValid) return res.status(403).json({Success: false, message: "Invalid credentials"});

  const tokens = generateTokens(user);
  user.refreshToken = tokens.refreshToken;
  await user.save();

  res.status(200).json({Success: true, tokens});
});

exports.forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({Status: false, message:"User not found"});

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.otp = otpHash;
  user.otpExpiresAt = otpExpiresAt;
  await user.save();

  await sendEmail(email, "Reset Your Password", `<p>Your OTP is <b>${otp}</b>. It will expire in 10 minutes.</p>`);
  res.status(201).json({Success: true, message:"OTP sent to your email"});
});

exports.resetPassword = catchAsync(async (req, res) => {
  const { email, otp, newPassword, confirmNewPassword } = req.body;

  if (newPassword !== confirmNewPassword)
    return res.status(400).json({Success: false, message:"Passwords do not match"});

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({Success: false, message:"User not found"});

  const hashedInputOtp = hashOtp(otp);
  const isOtpValid = user.otp === hashedInputOtp && new Date() < user.otpExpiresAt;
  if (!isOtpValid) return res.status(400).json({Success: false, message:"Invalid or expired OTP"});

  const { hash, salt } = hashPassword(newPassword);
  user.hash = hash;
  user.salt = salt;
  user.otp = null;
  user.otpExpiresAt = null;
  await user.save();

  res.send("Password reset successful");
});

exports.refreshToken = catchAsync(async (req, res) => {
  const { token } = req.body;
  if (!token) return res.sendStatus(401);

  const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  const user = await User.findOne(payload._id);

  if (!user || user.refreshToken !== token) return res.sendStatus(403);

  const tokens = generateTokens(user);
  user.refreshToken = tokens.refreshToken;
  await user.save();

  res.json(tokens);
});

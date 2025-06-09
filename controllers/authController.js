const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { hashPassword, validatePassword } = require('../utils/hash');
const sendEmail = require('../utils/sendEmail');
const { generateOtp, hashOtp } = require('../utils/otp');
const { generateTokens } = require('../middleware/authMiddleware');
const { isDisposableEmail } = require('../utils/validateEmail');



exports.register = async (req, res) => {
  const { email, phone, password, confirmPassword } = req.body.registrationData;
  if (isDisposableEmail(email)) {
    console.log(`Blocked disposable email attempt: ${email}`);
    return res.status(400).send("Disposable email addresses are not allowed.");
  }
  // if (password !== confirmPassword) return res.status(400).send("Passwords do not match");

  try {
    const { hash, salt } = hashPassword(password);

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // expires in 10 min

    await User.create({
      email,
      phone,
      hash,
      salt,
      otp: otpHash,
      otpExpiresAt
    });

    await sendEmail(email, "Verify Your Email", `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`);

    res.status(201).send("OTP sent to your email");
  } catch (err) {
    console.log(err);
    res.status(500).send(err.message);
  }
};

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send("User not found");
    if (user.isVerified) return res.status(400).send("User already verified");

    const hashedInputOtp = hashOtp(otp);
    const isOtpValid = user.otp === hashedInputOtp && new Date() < user.otpExpiresAt;

    if (!isOtpValid) return res.status(400).send("Invalid or expired OTP");

    user.isVerified = true;
    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();

    res.send("Email verified successfully");
  } catch (err) {
    res.status(500).send(err.message);
  }
};

exports.resendOtp = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || user.isVerified) return res.status(400).send("Invalid request");

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otpHash;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    await sendEmail(email, "Resend OTP", `<p>Your new OTP is <b>${otp}</b>.</p>`);
    res.send("OTP resent");
  } catch (err) {
    res.status(500).send(err.message);
  }
};


exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || !user.isVerified) return res.status(401).send("Email not verified or user not found");

    const isValid = validatePassword(password, user.hash, user.salt);
    if (!isValid) return res.status(403).send("Invalid credentials");

    const tokens = generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.json(tokens);
  } catch (err) {
    res.status(500).send(err.message);
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send("User not found");

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    user.otp = otpHash;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    await sendEmail(email, "Reset Your Password", `<p>Your OTP is <b>${otp}</b>. It will expire in 10 minutes.</p>`);

    res.send("OTP sent to your email");
  } catch (err) {
    res.status(500).send(err.message);
  }
};

exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword, confirmNewPassword } = req.body;

  if (newPassword !== confirmNewPassword)
    return res.status(400).send("Passwords do not match");

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send("User not found");

    const hashedInputOtp = hashOtp(otp);
    const isOtpValid = user.otp === hashedInputOtp && new Date() < user.otpExpiresAt;

    if (!isOtpValid) return res.status(400).send("Invalid or expired OTP");

    const { hash, salt } = hashPassword(newPassword);
    user.hash = hash;
    user.salt = salt;
    user.otp = null;
    user.otpExpiresAt = null;

    await user.save();

    res.send("Password reset successful");
  } catch (err) {
    res.status(500).send(err.message);
  }
};

exports.refreshToken = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.sendStatus(401);

  try {
    const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findOne(payload._id);

    if (!user || user.refreshToken !== token) return res.sendStatus(403);

    const tokens = generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.json(tokens);
  } catch (err) {
    res.status(403).send("Invalid refresh token");
  }
};

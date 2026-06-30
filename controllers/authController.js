const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RiderStats = require('../models/RiderStats');
const { UserXp } = require('../models/achievementsMaster');
const { hashPassword, validatePassword, verifyPin, hashPin } = require('../utils/hash');
const sendEmail = require('../utils/sendEmail');
const { generateOtp, hashOtp } = require('../utils/otp');
const { generateTokens } = require('../middleware/authMiddleware');
const { isDisposableEmail, validatePasswordStrength, validatePin } = require('../utils/Validator');
const catchAsync = require('../utils/catchAsyncHandller');

/* Helper Functions */
const generateUserId = () => {
	const randomNum = String(Math.floor(1 + Math.random() * 99999)).padStart(5, '0');
	const randomChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
	return `MotonomaadUser${randomNum}${randomChar}`;
}

const generateUniqueUserId = async () => {
	let userId;
	let isUnique = false;

	while (!isUnique) {
		userId = generateUserId();
		const existing = await User.findOne({ userId });
		if (!existing) isUnique = true;
	}

	return userId;
}

exports.register = catchAsync(async (req, res) => {
	const { email, phone, password, pin } = req.body.registrationData;

	if (isDisposableEmail(email)) {
		console.log(`Blocked disposable email attempt: ${email}`);
		return res.status(400).json({ Success: false, message: "Disposable email addresses are not allowed." });
	}

	const { isValid, message } = validatePasswordStrength(password);
	if (!isValid) {
		return res.status(400).json({ Success: false, message });
	}

	const existingUser = await User.findOne({ email });
	if (existingUser) {
		return res.status(409).json({ Success: false, message: "An account with this email id already exists, please login" });
	}

	const { hash, salt } = await hashPassword(password);
	let pinHash = null, pinSalt = null;
	if (pin) {
		const { isValid, message } = isValidPin(pin);
		if (!isValid) {
			return res.status(400).json({ Success: false, message });
		}
		({ hash: pinHash, salt: pinSalt } = await hashPin(pin));
	}
	const otp = generateOtp();
	const otpHash = hashOtp(otp);
	const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
	const userId = await generateUniqueUserId();
	await User.create({ userId, email, phone, hash, salt, pinHash, pinSalt, otp: otpHash, otpExpiresAt });
	await sendEmail(email, "Verify Your Email", `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`);

	res.status(201).json({ Success: true, message: "OTP sent to your email" });
});

exports.verifyOtp = catchAsync(async (req, res) => {
	const { email, otp } = req.body;

	const user = await User.findOne({ email });
	if (!user) return res.status(404).json({ Success: false, message: "User not found" });
	if (user.isVerified) return res.status(400).json({ Success: false, message: "User already verified" });

	const hashedInputOtp = hashOtp(otp);
	const isOtpValid = user.otp === hashedInputOtp && new Date() < user.otpExpiresAt;
	if (!isOtpValid) return res.status(400).json({ Success: false, message: "Invalid or expired OTP" });

	user.isVerified = true;
	user.otp = null;
	user.otpExpiresAt = null;

	const tokens = generateTokens(user);
	user.refreshToken = tokens.refreshToken;

	await user.save();
	await RiderStats.create({ user: user.userId });
	await UserXp.create({ user: user.userId });
	res.status(200).json({ Success: true, message: "Email verified successfully", tokens, user: { userId: user.userId, email: user.email } });
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
	res.status(201).json({ Success: true, message: "OTP resent" });
});

exports.login = catchAsync(async (req, res) => {
	const { email, password, pin, mode = 'password' } = req.body;
	if (!email) return res.status(400).json({ Success: false, message: "Email is required" });
	const user = await User.findOne({ email });
	if (!user || !user.isVerified) return res.status(401).json({ Success: false, message: "Account not verified or user not found" });
	let isAuthenticated = false;
	if (mode === 'pin') {
		if (!pin) {
			return res.status(400).json({ message: 'PIN is required for PIN login.' });
		}
		if (!user.pinHash || !user.pinSalt) {
			return res.status(403).json({ message: 'PIN login not set up for this account.' });
		}
		isAuthenticated = await verifyPin(pin, user.pinHash, user.pinSalt);
	} else {
		if (!password) {
			return res.status(400).json({ message: 'Password is required.' });
		}
		isAuthenticated = await validatePassword(password, user.hash, user.salt);
	}

	if (!isAuthenticated) return res.status(403).json({ Success: false, message: "Invalid credentials" });

	const tokens = generateTokens(user);
	const generatedAt = Date.now();
	user.refreshToken = tokens.refreshToken;
	await user.save();

	res.status(200).json({ Success: true, tokens: { ...tokens, generatedAt }, user: { userId: user.userId, email: user.email } });
});

exports.forgotPassword = catchAsync(async (req, res) => {
	const { email, mode = 'password' } = req.body;

	const user = await User.findOne({ email });
	if (!user) return res.status(404).json({ Status: false, message: "User not found" });

	const otp = generateOtp();
	const otpHash = hashOtp(otp);
	const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

	user.otp = otpHash;
	user.otpExpiresAt = otpExpiresAt;
	await user.save();
	if (mode === 'password') {
		await sendEmail(email, "Reset Your Password", `<p>Your OTP is <b>${otp}</b>. It will expire in 10 minutes.</p>`);
	} else {
		await sendEmail(email, "Reset Your Pin", `<p>Your OTP is <b>${otp}</b>. It will expire in 10 minutes.</p>`);
	}
	res.status(201).json({ Success: true, message: "OTP sent to your email" });
});

exports.resetPassword = catchAsync(async (req, res) => {
	const { email, otp, newPassword, confirmNewPassword } = req.body;
	const { isValid, message } = validatePasswordStrength(password);

	if (!isValid) {
		return res.status(400).json({ Success: false, message });
	}
	
	if (newPassword !== confirmNewPassword)
		return res.status(400).json({ Success: false, message: "Passwords do not match" });

	const user = await User.findOne({ email });
	if (!user) return res.status(404).json({ Success: false, message: "User not found" });

	const hashedInputOtp = hashOtp(otp);
	const isOtpValid = user.otp === hashedInputOtp && new Date() < user.otpExpiresAt;
	if (!isOtpValid) return res.status(400).json({ Success: false, message: "Invalid or expired OTP" });

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

	try {
		const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
		const user = await User.findOne(payload.userId);
		if (!user || user.refreshToken !== token) return res.sendStatus(403);

		const tokens = generateTokens(user);
		const generatedAt = Date.now();
		user.refreshToken = tokens.refreshToken;
		await user.save();
		res.status(200).json({ Success: true, tokens: { ...tokens, generatedAt }, user: { userId: user.userId, email: user.email } });
	} catch (err) {
		return res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
	}
});

exports.updatePin = catchAsync(async (req, res) => {
	const { email, newPin, oldPin } = req.body;
	if (!email) return res.status(400).json({ Success: false, message: "Email is required" });
	const { isValid, message } = validatePin(pin);
	if (!isValid) {
		return res.status(400).json({ Success: false, message });
	}
	const user = await User.findOne({ email });
	if (!user) return res.status(404).json({ Success: false, message: "User not found" });

	const hashedInputOtp = hashOtp(otp);
	const isOtpValid = user.otp === hashedInputOtp && new Date() < user.otpExpiresAt;
	if (!isOtpValid) return res.status(400).json({ Success: false, message: "Invalid or expired OTP" });

	if (user.pinHash && user.pinSalt) {
		const isValid = await verifyPin(oldPin, user.pinHash, user.pinSalt);
		if (!isValid) {
			return res.status(401).json({ Success: false, message: "Current PIN is incorrect." });
		}
	}

	const { hash: pinHash, salt: pinSalt } = await hashPin(newPin);
	await user.updateOne({ userId }, { $set: { pinHash, pinSalt } });
	return res.status(200).json({ status: 'Success', message: "PIN Updated successfully" });
})

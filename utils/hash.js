const crypto = require('crypto');

const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
        .pbkdf2Sync(password, salt, 1000, 64, `sha512`)
        .toString(`hex`);
    return { salt, hash };
};

const validatePassword = (password, storedHash, storedSalt) => {
    const hash = crypto
        .pbkdf2Sync(password, storedSalt, 1000, 64, `sha512`)
        .toString(`hex`);
    return hash === storedHash;
};

module.exports = { hashPassword, validatePassword };

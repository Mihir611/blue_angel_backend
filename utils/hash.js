const crypto = require('crypto');
const { promisify } = require('util');
const pbkdf2Async = promisify(crypto.pbkdf2);

const ITERATIONS = 310000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';
const SALT_BYTES = 32;

const hashPassword = async (password) => {
    const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
    const hash = await pbkdf2Async(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
    return { salt, hash: hash.toString('hex') };
};

const validatePassword = async (password, storedHash, storedSalt) => {
    const hash = await pbkdf2Async(password, storedSalt, ITERATIONS, KEY_LENGTH, DIGEST);
    return crypto.timingSafeEqual(
        hash,
        Buffer.from(storedHash, 'hex')
    );
};

module.exports = { hashPassword, validatePassword };

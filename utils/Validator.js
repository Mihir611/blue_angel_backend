const disposableDomains = require('disposable-email-domains');

function isDisposableEmail(email) {
  const domain = email.split('@')[1].toLowerCase();
  return disposableDomains.includes(domain);
}

const validatePasswordStrength = (password) => {
  const errors = [];

  if (password.length < 10) errors.push('at least 10 characters');
  if (!/[A-Z]/.test(password)) errors.push('one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('one number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('one special character');

  return {
    isValid: errors.length === 0,
    message: errors.length ? `Password must contain ${errors.join(', ')}.` : null,
  };
};

const validatePin = (pin) => {
  if (typeof pin !== 'string') return { isValid: false, message: 'PIN must be a string.' };
  if (!/^\d+$/.test(pin)) return { isValid: false, message: 'PIN must contain only digits.' };
  if (pin.length !== 4 && pin.length !== 6) return { isValid: false, message: 'PIN must be exactly 4 or 6 digits.' };

  return { isValid: true, message: null };
}

module.exports = { isDisposableEmail, validatePasswordStrength, validatePin };
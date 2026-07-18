const { validationResult } = require('express-validator');

exports.validate = (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json({Success: false, message: 'Validation Failed', errors: errors.array().map(e => ({field: e.path, message: e.msg}))});
    }

    next();
};
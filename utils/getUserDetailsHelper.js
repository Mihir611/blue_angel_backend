const User = require('../models/User');
const mongoose = require('mongoose');

exports.getUserByEmail = async (userEmail) => {
    const user = await User.findOne({email: userEmail});
    if(!user) return null;
    return user;
}
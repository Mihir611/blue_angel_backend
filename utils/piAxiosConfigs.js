const axios = require('axios');

exports.supportingApiClient = axios.create({
    baseURL: process.env.SUPPORTING_APU_URL,
    timeout: 10000
})
const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, html) => {
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASS,
        }
    });

    await transporter.sendMail({
        from: `"YourApp" <${process.env.EMAIL}>`,
        to,
        subject,
        html
    });
};

module.exports = sendEmail;

const nodemailer = require('nodemailer');
require('dotenv').config();


const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

transporter.verify((error) => {
    if (error) {
        console.log(error);
    } else {
        console.log('Ready to send emails');
    }
});


module.exports.sendOtpEmail = async (to, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: 'OTP Verification Code',
        html: `Your OTP Code for verification is <strong>${otp}</strong>. The code is valid for 10 minutes.`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('OTP email sent successfully');
    } catch (error) {
        console.error('Error sending OTP email:', error);
    }
};

module.exports.passwordResetCode = async (to, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: 'Password Reset Code',
        html: `
            <p>Your OTP code for resetting your password is <strong>${otp}</strong>.</p>
            <p>The code is valid for 10 minutes. Please use this code to reset your password.</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Password reset email sent successfully');
    } catch (error) {
        console.error('Error sending password reset email:', error);
    }
};
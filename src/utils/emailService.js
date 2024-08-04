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
        console.log('Ready for send emails');
    }
});


const sendOtpEmail = (to, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: 'OTP Verification Code',
        html: `Your OTP Code for verification is ${otp}. The code is valid for 10 minutes.`
    };

    try {
        transporter.sendMail(mailOptions)
        console.log('OTP email sent successfully');
    } catch (error) {
        console.error('Error sending an OTP email:', error);
    }
}


module.exports = sendOtpEmail;
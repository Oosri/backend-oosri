const nodemailer = require('nodemailer');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { SendMailClient } = require("zeptomail");

const url = process.env.ZEPTOMAIL_URL || "api.zeptomail.com/v1.1/email";
let zeptoClient = new SendMailClient({url, token: `Zoho-enczapikey ${process.env.ZEPTOMAIL_TOKEN}`});

const sendZeptoEmail = async (to, subject, htmlContent, name) => {
    try {
        console.log(`--- ATTEMPTING ZEPTOMAIL SEND TO: ${to} ---`);
        const response = await zeptoClient.sendMail({
            "from": {
                "address": process.env.EMAIL_SENDER,
                "name": process.env.EMAIL_TEAM || "Oosri Team"
            },
            "to": [
                {
                    "email_address": {
                        "address": to,
                        "name": name || to
                    }
                }
            ],
            "subject": subject,
            "htmlbody": htmlContent,
        });
        console.log('Email sent successfully via ZeptoMail to', to);
        return response;
    } catch (error) {
        console.error('Error sending email via ZeptoMail:', error);
        throw error;
    }
}


const requiredEnvVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_SENDER', 'EMAIL_TEAM'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: "emailapikey",
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000
});


// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST,
//   port: parseInt(process.env.EMAIL_PORT),
//   secure: false,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env. EMAIL_PASS
//   },
//   tls: {
//     rejectUnauthorized: false
//   },
//   connectionTimeout: 30000,
//   greetingTimeout: 30000,
// });

console.log('📧 Email Configuration:', {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  user: process.env.EMAIL_USER,
  sender: process.env.EMAIL_SENDER,
  team: process.env.EMAIL_TEAM,
  url: process.env.ZEPTOMAIL_URL,
  token: process.env.ZEPTOMAIL_TOKEN
});


// transporter.verify((error) => {
//   if (error) {
//     console.log(error);
//   } else {
//     console.log('Ready to send emails');
//   }
// });
console.log("--- EMAIL SERVICE LOADED: ZEPTOMAIL MODE ---");

const loadHtmlTemplate = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, { encoding: 'utf-8' }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

function replacePlaceholders(template, placeholders) {
  return template.replace(/{{\s*(\w+)\s*}}/g, (match, key) => {
    return placeholders[key] || '';
  });
}


module.exports.smtpSendOtpEmail = async (to, otp, fullName) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'otp-email-template.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      otp1: otp[0] || '',
      otp2: otp[1] || '',
      otp3: otp[2] || '',
      otp4: otp[3] || '',
    };
    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const mailOptions = {
      from: process.env.EMAIL_SENDER,
      to,
      subject: 'OTP Verification Code',
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully to', to);
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Error in sending OTP email');
  }
};

module.exports.smtpLoginOtpEmail = async (to, otp, fullName) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'login-2fa-email-template.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      otp1: otp[0] || '',
      otp2: otp[1] || '',
      otp3: otp[2] || '',
      otp4: otp[3] || '',
    };
    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const mailOptions = {
      from: process.env.EMAIL_SENDER,
      to,
      subject: 'OTP Verification Code',
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully to', to);
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Error in sending OTP email');
  }
};

module.exports.smtpSendOnBoardingEmail = async (to, password, fullName) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'onBoarding-templates.html');
    let htmlContent = await loadHtmlTemplate(templatePath);



    const placeholders = {
      fullName,
      username: to,
      password,
      year: new Date().getFullYear(),
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const mailOptions = {
      from: process.env.EMAIL_SENDER,
      to,
      subject: 'Welcome Onboard - Your Login Details',
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log('Onboarding email sent successfully to', to);
  } catch (error) {
    console.error('Error sending onboarding email:', error);
    throw new Error('Error in sending onboarding email');
  }
};




module.exports.smtpPasswordResetCode = async (to, otp, fullName) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'resetPasswordEmail-template.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      otp1: otp[0] || '',
      otp2: otp[1] || '',
      otp3: otp[2] || '',
      otp4: otp[3] || '',
    };
    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const mailOptions = {
      from: process.env.EMAIL_SENDER,
      to,
      subject: 'Password Reset Code',
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully to', to);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Error in sending password reset email');
  }
};



module.exports.smtpOrderPlaced = async (to, orderId, fullName, images) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'orderPlaced-template.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      orderId: orderId,
      image1: images[0],
      image2: images[1],
      image3: images[2],
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const mailOptions = {
      from: process.env.EMAIL_SENDER,
      to,
      subject: 'Order Confirmed and Now Being Processed',
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw new Error('Error in sending Order Placed email: ' + error.message);
  }
};

module.exports.sendOtpEmail = async (to, otp, fullName) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'otp-email-template.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      otp1: otp[0] || '',
      otp2: otp[1] || '',
      otp3: otp[2] || '',
      otp4: otp[3] || '',
    };
    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(to, 'OTP Verification Code', htmlContent, fullName);
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Error in sending OTP email');
  }
};

module.exports.loginOtpEmail = async (to, otp, fullName) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'login-2fa-email-template.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      otp1: otp[0] || '',
      otp2: otp[1] || '',
      otp3: otp[2] || '',
      otp4: otp[3] || '',
    };
    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const result = await sendZeptoEmail(to, 'OTP Verification Code', htmlContent, fullName);
    console.log(result, "LOGIN OTP RESULT")
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Error in sending OTP email');
  }
};

module.exports.sendOnBoardingEmail = async (to, password, fullName) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'onBoarding-templates.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName,
      username: to,
      password,
      year: new Date().getFullYear(),
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(to, 'Welcome Onboard - Your Login Details', htmlContent, fullName);
  } catch (error) {
    console.error('Error sending onboarding email:', error);
    throw new Error('Error in sending onboarding email');
  }
};

module.exports.passwordResetCode = async (to, otp, fullName) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'resetPasswordEmail-template.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      otp1: otp[0] || '',
      otp2: otp[1] || '',
      otp3: otp[2] || '',
      otp4: otp[3] || '',
    };
    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(to, 'Password Reset Code', htmlContent, fullName);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Error in sending password reset email');
  }
};

module.exports.orderPlaced = async (to, orderId, fullName, images) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'orderPlaced-template.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      orderId: orderId,
      image1: images[0],
      image2: images[1],
      image3: images[2],
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(to, 'Order Confirmed and Now Being Processed', htmlContent, fullName);
  } catch (error) {
    throw new Error('Error in sending Order Placed email: ' + error.message);
  }
};
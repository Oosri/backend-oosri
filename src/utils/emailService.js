const nodemailer = require('nodemailer');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
<<<<<<< HEAD
const { SendMailClient } = require('zeptomail');

const url = process.env.ZEPTOMAIL_URL || 'api.zeptomail.com/v1.1/email';
let zeptoClient = new SendMailClient({
  url,
  token: `Zoho-enczapikey ${process.env.ZEPTOMAIL_TOKEN}`
});

const sendZeptoEmail = async (to, subject, htmlContent, name, fromAddress) => {
  try {
    console.log(`--- ATTEMPTING ZEPTOMAIL SEND TO: ${to} ---`);
    const response = await zeptoClient.sendMail({
      from: {
        address: fromAddress || process.env.EMAIL_SENDER,
        name: process.env.EMAIL_TEAM || 'Oosri Team'
      },
      to: [
        {
          email_address: {
            address: to,
            name: name || to
          }
        }
      ],
      subject: subject,
      htmlbody: htmlContent
=======
const { SendMailClient } = require("zeptomail");

const url = process.env.ZEPTOMAIL_URL || "api.zeptomail.com/v1.1/email";
let zeptoClient = new SendMailClient({ url, token: `Zoho-enczapikey ${process.env.ZEPTOMAIL_TOKEN}` });

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
>>>>>>> 7acb325 (chore: fix conflicts)
    });
    console.log('Email sent successfully via ZeptoMail to', to);
    return response;
  } catch (error) {
    console.error('Error sending email via ZeptoMail:', error);
<<<<<<< HEAD
    const message = error.error?.message || 'Unknown ZeptoMail error';
    const code = error.error?.code || 'UNKNOWN_CODE';
    throw new Error(`ZeptoMail Error (${code}): ${message}`);
  }
};

const requiredEnvVars = [
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASS',
  'EMAIL_SENDER',
  'EMAIL_TEAM',
  'HELLO_EMAIL'
];
const missingVars = requiredEnvVars.filter((v) => !process.env[v]);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}`
  );
=======
    throw error;
  }
}


const requiredEnvVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_SENDER', 'EMAIL_TEAM'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
>>>>>>> 7acb325 (chore: fix conflicts)
}

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
<<<<<<< HEAD
    user: 'emailapikey',
=======
    user: "emailapikey",
>>>>>>> 7acb325 (chore: fix conflicts)
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000
});

<<<<<<< HEAD
=======

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

>>>>>>> 7acb325 (chore: fix conflicts)
console.log('📧 Email Configuration:', {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  user: process.env.EMAIL_USER,
  sender: process.env.EMAIL_SENDER,
  team: process.env.EMAIL_TEAM,
  url: process.env.ZEPTOMAIL_URL,
  token: process.env.ZEPTOMAIL_TOKEN
});

<<<<<<< HEAD
console.log('--- EMAIL SERVICE LOADED: ZEPTOMAIL MODE ---');
=======

// transporter.verify((error) => {
//   if (error) {
//     console.log(error);
//   } else {
//     console.log('Ready to send emails');
//   }
// });
console.log("--- EMAIL SERVICE LOADED: ZEPTOMAIL MODE ---");
>>>>>>> 7acb325 (chore: fix conflicts)

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

<<<<<<< HEAD
// ==================== EXISTING FUNCTIONS ====================

module.exports.smtpSendOtpEmail = async (to, otp, fullName) => {
  try {
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'otp-email-template.html'
    );
=======

module.exports.smtpSendOtpEmail = async (to, otp, fullName) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'otp-email-template.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      otp1: otp[0] || '',
      otp2: otp[1] || '',
      otp3: otp[2] || '',
<<<<<<< HEAD
      otp4: otp[3] || ''
=======
      otp4: otp[3] || '',
>>>>>>> 7acb325 (chore: fix conflicts)
    };
    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const mailOptions = {
      from: process.env.EMAIL_SENDER,
      to,
      subject: 'OTP Verification Code',
<<<<<<< HEAD
      html: htmlContent
=======
      html: htmlContent,
>>>>>>> 7acb325 (chore: fix conflicts)
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
<<<<<<< HEAD
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'login-2fa-email-template.html'
    );
=======
    const templatePath = path.join(__dirname, 'emailTemplates', 'login-2fa-email-template.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      otp1: otp[0] || '',
      otp2: otp[1] || '',
      otp3: otp[2] || '',
<<<<<<< HEAD
      otp4: otp[3] || ''
=======
      otp4: otp[3] || '',
>>>>>>> 7acb325 (chore: fix conflicts)
    };
    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const mailOptions = {
      from: process.env.EMAIL_SENDER,
      to,
      subject: 'OTP Verification Code',
<<<<<<< HEAD
      html: htmlContent
=======
      html: htmlContent,
>>>>>>> 7acb325 (chore: fix conflicts)
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
<<<<<<< HEAD
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'onBoarding-templates.html'
    );
    let htmlContent = await loadHtmlTemplate(templatePath);

=======
    const templatePath = path.join(__dirname, 'emailTemplates', 'onBoarding-templates.html');
    let htmlContent = await loadHtmlTemplate(templatePath);



>>>>>>> 7acb325 (chore: fix conflicts)
    const placeholders = {
      fullName,
      username: to,
      password,
<<<<<<< HEAD
      year: new Date().getFullYear()
=======
      year: new Date().getFullYear(),
>>>>>>> 7acb325 (chore: fix conflicts)
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const mailOptions = {
      from: process.env.EMAIL_SENDER,
      to,
      subject: 'Welcome Onboard - Your Login Details',
<<<<<<< HEAD
      html: htmlContent
=======
      html: htmlContent,
>>>>>>> 7acb325 (chore: fix conflicts)
    };

    await transporter.sendMail(mailOptions);
    console.log('Onboarding email sent successfully to', to);
  } catch (error) {
    console.error('Error sending onboarding email:', error);
    throw new Error('Error in sending onboarding email');
  }
};

<<<<<<< HEAD
module.exports.smtpPasswordResetCode = async (to, otp, fullName) => {
  try {
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'resetPasswordEmail-template.html'
    );
=======



module.exports.smtpPasswordResetCode = async (to, otp, fullName) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'resetPasswordEmail-template.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      otp1: otp[0] || '',
      otp2: otp[1] || '',
      otp3: otp[2] || '',
      otp4: otp[3] || '',
      otp5: otp[4] || '',
<<<<<<< HEAD
      otp6: otp[5] || ''
=======
      otp6: otp[5] || '',
>>>>>>> 7acb325 (chore: fix conflicts)
    };
    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const mailOptions = {
      from: process.env.EMAIL_SENDER,
      to,
      subject: 'Password Reset Code',
<<<<<<< HEAD
      html: htmlContent
=======
      html: htmlContent,
>>>>>>> 7acb325 (chore: fix conflicts)
    };

    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully to', to);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Error in sending password reset email');
  }
};

<<<<<<< HEAD
module.exports.smtpOrderPlaced = async (to, orderId, fullName, images) => {
  try {
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'orderPlaced-template.html'
    );
=======


module.exports.smtpOrderPlaced = async (to, orderId, fullName, images) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'orderPlaced-template.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      orderId: orderId,
      image1: images[0],
      image2: images[1],
<<<<<<< HEAD
      image3: images[2]
=======
      image3: images[2],
>>>>>>> 7acb325 (chore: fix conflicts)
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const mailOptions = {
      from: process.env.EMAIL_SENDER,
      to,
      subject: 'Order Confirmed and Now Being Processed',
<<<<<<< HEAD
      html: htmlContent
=======
      html: htmlContent,
>>>>>>> 7acb325 (chore: fix conflicts)
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw new Error('Error in sending Order Placed email: ' + error.message);
  }
};

<<<<<<< HEAD
// ==================== ZEPTOMAIL FUNCTIONS ====================

module.exports.sendOtpEmail = async (to, otp, fullName) => {
  try {
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'otp-email-template.html'
    );
=======
module.exports.sendOtpEmail = async (to, otp, fullName) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'otp-email-template.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      otp1: otp[0] || '',
      otp2: otp[1] || '',
      otp3: otp[2] || '',
<<<<<<< HEAD
      otp4: otp[3] || ''
=======
      otp4: otp[3] || '',
>>>>>>> 7acb325 (chore: fix conflicts)
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
<<<<<<< HEAD
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'login-2fa-email-template.html'
    );
=======
    const templatePath = path.join(__dirname, 'emailTemplates', 'login-2fa-email-template.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      otp1: otp[0] || '',
      otp2: otp[1] || '',
      otp3: otp[2] || '',
<<<<<<< HEAD
      otp4: otp[3] || ''
    };
    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const result = await sendZeptoEmail(
      to,
      'OTP Verification Code',
      htmlContent,
      fullName
    );
    console.log(result, 'LOGIN OTP RESULT');
=======
      otp4: otp[3] || '',
    };
    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const result = await sendZeptoEmail(to, 'OTP Verification Code', htmlContent, fullName);
    console.log(result, "LOGIN OTP RESULT")
>>>>>>> 7acb325 (chore: fix conflicts)
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Error in sending OTP email');
  }
};

module.exports.sendOnBoardingEmail = async (to, password, fullName) => {
  try {
<<<<<<< HEAD
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'onBoarding-templates.html'
    );
=======
    const templatePath = path.join(__dirname, 'emailTemplates', 'onBoarding-templates.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName,
      username: to,
      password,
<<<<<<< HEAD
      year: new Date().getFullYear()
=======
      year: new Date().getFullYear(),
>>>>>>> 7acb325 (chore: fix conflicts)
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

<<<<<<< HEAD
    await sendZeptoEmail(
      to,
      'Welcome Onboard - Your Login Details',
      htmlContent,
      fullName
    );
=======
    await sendZeptoEmail(to, 'Welcome Onboard - Your Login Details', htmlContent, fullName);
>>>>>>> 7acb325 (chore: fix conflicts)
  } catch (error) {
    console.error('Error sending onboarding email:', error);
    throw new Error('Error in sending onboarding email');
  }
};

module.exports.passwordResetCode = async (to, otp, fullName) => {
  try {
<<<<<<< HEAD
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'resetPasswordEmail-template.html'
    );
=======
    const templatePath = path.join(__dirname, 'emailTemplates', 'resetPasswordEmail-template.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      otp1: otp[0] || '',
      otp2: otp[1] || '',
      otp3: otp[2] || '',
      otp4: otp[3] || '',
      otp5: otp[4] || '',
<<<<<<< HEAD
      otp6: otp[5] || ''
=======
      otp6: otp[5] || '',
>>>>>>> 7acb325 (chore: fix conflicts)
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
<<<<<<< HEAD
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'orderPlaced-template.html'
    );
=======
    const templatePath = path.join(__dirname, 'emailTemplates', 'orderPlaced-template.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      fullName: fullName || 'User',
      orderId: orderId,
      image1: images[0],
      image2: images[1],
<<<<<<< HEAD
      image3: images[2]
=======
      image3: images[2],
>>>>>>> 7acb325 (chore: fix conflicts)
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

<<<<<<< HEAD
    await sendZeptoEmail(
      to,
      'Order Confirmed and Now Being Processed',
      htmlContent,
      fullName
    );
=======
    await sendZeptoEmail(to, 'Order Confirmed and Now Being Processed', htmlContent, fullName);
>>>>>>> 7acb325 (chore: fix conflicts)
  } catch (error) {
    throw new Error('Error in sending Order Placed email: ' + error.message);
  }
};

<<<<<<< HEAD
// ==================== PAYMENT FLOW FUNCTIONS ====================

module.exports.sellerOrderNotification = async (
  to,
  sellerName,
  orderId,
  buyerName,
  totalAmount,
  itemsList
) => {
  try {
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'sellerOrderNotification.html'
    );
=======
// New notification functions for payment flow
module.exports.sellerOrderNotification = async (to, sellerName, orderId, buyerName, totalAmount, itemsList, netAmountNGN, platformFeeNGN) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'sellerOrderNotification.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      sellerName: sellerName || 'Seller',
      orderId: orderId,
      buyerName: buyerName || 'Buyer',
      totalAmount: totalAmount,
<<<<<<< HEAD
      itemsList: itemsList || '',
      year: new Date().getFullYear()
=======
      netAmountNGN: netAmountNGN || '0.00',
      platformFeeNGN: platformFeeNGN || '0.00',
      itemsList: itemsList || '',
      year: new Date().getFullYear(),
>>>>>>> 7acb325 (chore: fix conflicts)
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(to, 'New Order Received', htmlContent, sellerName);
  } catch (error) {
    console.error('Error sending seller order notification:', error);
<<<<<<< HEAD
    throw new Error(
      'Error in sending seller order notification: ' + error.message
    );
  }
};

module.exports.buyerPurchaseConfirmation = async (
  to,
  buyerName,
  totalAmountUSD,
  ordersCount,
  ordersList
) => {
  try {
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'buyerPurchaseConfirmation.html'
    );
=======
    throw new Error('Error in sending seller order notification: ' + error.message);
  }
};

module.exports.buyerPurchaseConfirmation = async (to, buyerName, totalAmountUSD, ordersCount, ordersList) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'buyerPurchaseConfirmation.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      buyerName: buyerName || 'User',
      totalAmountUSD: totalAmountUSD,
      ordersCount: ordersCount,
      ordersList: ordersList || '',
<<<<<<< HEAD
      year: new Date().getFullYear()
=======
      year: new Date().getFullYear(),
>>>>>>> 7acb325 (chore: fix conflicts)
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

<<<<<<< HEAD
    await sendZeptoEmail(
      to,
      'Purchase Confirmed - Thank You!',
      htmlContent,
      buyerName
    );
  } catch (error) {
    console.error('Error sending buyer purchase confirmation:', error);
    throw new Error(
      'Error in sending buyer purchase confirmation: ' + error.message
    );
  }
};

module.exports.paymentFailureNotification = async (
  to,
  buyerName,
  failureReason
) => {
  try {
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'paymentFailure.html'
    );
=======
    await sendZeptoEmail(to, 'Purchase Confirmed - Thank You!', htmlContent, buyerName);
  } catch (error) {
    console.error('Error sending buyer purchase confirmation:', error);
    throw new Error('Error in sending buyer purchase confirmation: ' + error.message);
  }
};

module.exports.paymentFailureNotification = async (to, buyerName, failureReason) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'paymentFailure.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      buyerName: buyerName || 'User',
      failureReason: failureReason || 'Payment could not be processed',
<<<<<<< HEAD
      year: new Date().getFullYear()
=======
      year: new Date().getFullYear(),
>>>>>>> 7acb325 (chore: fix conflicts)
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(to, 'Payment Failed', htmlContent, buyerName);
  } catch (error) {
    console.error('Error sending payment failure notification:', error);
<<<<<<< HEAD
    throw new Error(
      'Error in sending payment failure notification: ' + error.message
    );
  }
};

module.exports.sellerRefundNotification = async (
  to,
  sellerName,
  orderId,
  refundAmount
) => {
  try {
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'sellerRefundNotification.html'
    );
=======
    throw new Error('Error in sending payment failure notification: ' + error.message);
  }
};

module.exports.sellerRefundNotification = async (to, sellerName, orderId, refundAmount) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'sellerRefundNotification.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      sellerName: sellerName || 'Seller',
      orderId: orderId,
      refundAmount: refundAmount,
<<<<<<< HEAD
      year: new Date().getFullYear()
=======
      year: new Date().getFullYear(),
>>>>>>> 7acb325 (chore: fix conflicts)
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

<<<<<<< HEAD
    await sendZeptoEmail(
      to,
      'Refund Issued for Order',
      htmlContent,
      sellerName
    );
  } catch (error) {
    console.error('Error sending seller refund notification:', error);
    throw new Error(
      'Error in sending seller refund notification: ' + error.message
    );
  }
};

module.exports.buyerStockFailureNotification = async (
  to,
  buyerName,
  errorMessage
) => {
  try {
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'buyerStockFailure.html'
    );
=======
    await sendZeptoEmail(to, 'Refund Issued for Order', htmlContent, sellerName);
  } catch (error) {
    console.error('Error sending seller refund notification:', error);
    throw new Error('Error in sending seller refund notification: ' + error.message);
  }
};

module.exports.buyerStockFailureNotification = async (to, buyerName, errorMessage) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'buyerStockFailure.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      buyerName: buyerName || 'User',
      errorMessage: errorMessage || 'Item sold out during checkout',
<<<<<<< HEAD
      year: new Date().getFullYear()
=======
      year: new Date().getFullYear(),
>>>>>>> 7acb325 (chore: fix conflicts)
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

<<<<<<< HEAD
    await sendZeptoEmail(
      to,
      'Order Cancelled - Item Out of Stock',
      htmlContent,
      buyerName
    );
  } catch (error) {
    console.error('Error sending buyer stock failure notification:', error);
    throw new Error(
      'Error in sending buyer stock failure notification: ' + error.message
    );
  }
};

module.exports.supportDisputeAlert = async (
  to,
  disputeId,
  reason,
  paymentIds
) => {
  try {
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'supportDisputeAlert.html'
    );
=======
    await sendZeptoEmail(to, 'Order Cancelled - Item Out of Stock', htmlContent, buyerName);
  } catch (error) {
    console.error('Error sending buyer stock failure notification:', error);
    throw new Error('Error in sending buyer stock failure notification: ' + error.message);
  }
};

module.exports.supportDisputeAlert = async (to, disputeId, reason, paymentIds) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'supportDisputeAlert.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      disputeId: disputeId,
      reason: reason || 'Unknown',
      paymentIds: paymentIds || 'N/A',
<<<<<<< HEAD
      year: new Date().getFullYear()
=======
      year: new Date().getFullYear(),
>>>>>>> 7acb325 (chore: fix conflicts)
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

<<<<<<< HEAD
    await sendZeptoEmail(
      to,
      '🚨 Dispute Alert - Immediate Action Required',
      htmlContent,
      'Support Team'
    );
=======
    await sendZeptoEmail(to, '🚨 Dispute Alert - Immediate Action Required', htmlContent, 'Support Team');
>>>>>>> 7acb325 (chore: fix conflicts)
  } catch (error) {
    console.error('Error sending support dispute alert:', error);
    throw new Error('Error in sending support dispute alert: ' + error.message);
  }
};

<<<<<<< HEAD
module.exports.supportUrgentRefundAlert = async (
  to,
  paymentIntentId,
  buyerId,
  totalAmount,
  paymentIds,
  originalError,
  refundError
) => {
  try {
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'supportUrgentRefund.html'
    );
=======
module.exports.supportUrgentRefundAlert = async (to, paymentIntentId, buyerId, totalAmount, paymentIds, originalError, refundError) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'supportUrgentRefund.html');
>>>>>>> 7acb325 (chore: fix conflicts)
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      paymentIntentId: paymentIntentId,
      buyerId: buyerId,
      totalAmount: totalAmount,
      paymentIds: paymentIds || 'N/A',
      originalError: originalError || 'Unknown error',
      refundError: refundError || 'Unknown error',
<<<<<<< HEAD
      year: new Date().getFullYear()
=======
      year: new Date().getFullYear(),
>>>>>>> 7acb325 (chore: fix conflicts)
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

<<<<<<< HEAD
    await sendZeptoEmail(
      to,
      '🚨🚨 URGENT: Manual Refund Required',
      htmlContent,
      'Support Team'
    );
=======
    await sendZeptoEmail(to, '🚨🚨 URGENT: Manual Refund Required', htmlContent, 'Support Team');
>>>>>>> 7acb325 (chore: fix conflicts)
  } catch (error) {
    console.error('Error sending urgent refund alert:', error);
    throw new Error('Error in sending urgent refund alert: ' + error.message);
  }
<<<<<<< HEAD
};

module.exports.sendProductUploadReminder = async (to, sellerName) => {
  try {
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'productUploadReminder.html'
    );
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      sellerName: sellerName || 'Seller',
      year: new Date().getFullYear()
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(
      to,
      'Complete Your Store Setup - Upload Your Products',
      htmlContent,
      sellerName,
      process.env.HELLO_EMAIL
    );
    console.log(`✅ Product upload reminder sent to: ${to}`);
  } catch (error) {
    console.error('Error sending product upload reminder:', error);
    // Re-throw the original error to preserve stack trace and details
    throw error;
  }
};

module.exports.sendSellerVerifiedEmail = async (to, sellerName) => {
  try {
    const templatePath = path.join(
      __dirname,
      'emailTemplates',
      'sellerVerified.html'
    );
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      sellerName: sellerName || 'Seller',
      year: new Date().getFullYear()
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(
      to,
      "Welcome to Oosri - You're Verified! 🎉",
      htmlContent,
      sellerName,
      process.env.HELLO_EMAIL
    );
    console.log(`✅ Seller verification email sent to: ${to}`);
  } catch (error) {
    console.error('Error sending seller verification email:', error);
    throw new Error(
      'Error in sending seller verification email: ' + error.message
    );
  }
};
=======
};
>>>>>>> 7acb325 (chore: fix conflicts)

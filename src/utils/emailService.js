const nodemailer = require('nodemailer');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { SendMailClient } = require("zeptomail");

const url = process.env.ZEPTOMAIL_URL || "api.zeptomail.com/v1.1/email";
let zeptoClient = new SendMailClient({ url, token: `Zoho-enczapikey ${process.env.ZEPTOMAIL_TOKEN}` });

const sendZeptoEmail = async (to, subject, htmlContent, name, fromEmail, fromName) => {
  try {
    const response = await zeptoClient.sendMail({
      "from": {
        "address": fromEmail || process.env.EMAIL_SENDER,
        "name": fromName || process.env.EMAIL_TEAM || "Oosri Team"
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
    return response;
  } catch (error) {
    console.error('Error sending email via ZeptoMail:', JSON.stringify(error, null, 2));
    throw error;
  }
}

const sendReminderEmail = async (to, subject, htmlContent, name) => {
  return sendZeptoEmail(to, subject, htmlContent, name, 'hello@oosri.com', 'Oosri Team');
}

module.exports.sendZeptoEmail = sendZeptoEmail;
module.exports.sendReminderEmail = sendReminderEmail;

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
      otp5: otp[4] || '',
      otp6: otp[5] || '',
    };
    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const mailOptions = {
      from: process.env.EMAIL_SENDER,
      to,
      subject: 'Password Reset Code',
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
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
      otp5: otp[4] || '',
      otp6: otp[5] || '',
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

// New notification functions for payment flow
module.exports.sellerOrderNotification = async (to, sellerName, orderId, buyerName, totalAmount, itemsList, netAmountNGN, platformFeeNGN) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'sellerOrderNotification.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      sellerName: sellerName || 'Seller',
      orderId: orderId,
      buyerName: buyerName || 'Buyer',
      totalAmount: totalAmount,
      netAmountNGN: netAmountNGN || '0.00',
      platformFeeNGN: platformFeeNGN || '0.00',
      itemsList: itemsList || '',
      year: new Date().getFullYear(),
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(to, 'New Order Received', htmlContent, sellerName);
  } catch (error) {
    console.error('Error sending seller order notification:', error);
    throw new Error('Error in sending seller order notification: ' + error.message);
  }
};

module.exports.buyerPurchaseConfirmation = async (to, buyerName, totalAmountUSD, ordersCount, ordersList) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'buyerPurchaseConfirmation.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      buyerName: buyerName || 'User',
      totalAmountUSD: totalAmountUSD,
      ordersCount: ordersCount,
      ordersList: ordersList || '',
      year: new Date().getFullYear(),
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(to, 'Purchase Confirmed - Thank You!', htmlContent, buyerName);
  } catch (error) {
    console.error('Error sending buyer purchase confirmation:', error);
    throw new Error('Error in sending buyer purchase confirmation: ' + error.message);
  }
};

module.exports.paymentFailureNotification = async (to, buyerName, failureReason) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'paymentFailure.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      buyerName: buyerName || 'User',
      failureReason: failureReason || 'Payment could not be processed',
      year: new Date().getFullYear(),
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(to, 'Payment Failed', htmlContent, buyerName);
  } catch (error) {
    console.error('Error sending payment failure notification:', error);
    throw new Error('Error in sending payment failure notification: ' + error.message);
  }
};

module.exports.sellerRefundNotification = async (to, sellerName, orderId, refundAmount) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'sellerRefundNotification.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      sellerName: sellerName || 'Seller',
      orderId: orderId,
      refundAmount: refundAmount,
      year: new Date().getFullYear(),
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(to, 'Refund Issued for Order', htmlContent, sellerName);
  } catch (error) {
    console.error('Error sending seller refund notification:', error);
    throw new Error('Error in sending seller refund notification: ' + error.message);
  }
};

module.exports.buyerStockFailureNotification = async (to, buyerName, errorMessage) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'buyerStockFailure.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      buyerName: buyerName || 'User',
      errorMessage: errorMessage || 'Item sold out during checkout',
      year: new Date().getFullYear(),
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(to, 'Order Cancelled - Item Out of Stock', htmlContent, buyerName);
  } catch (error) {
    console.error('Error sending buyer stock failure notification:', error);
    throw new Error('Error in sending buyer stock failure notification: ' + error.message);
  }
};

module.exports.supportDisputeAlert = async (to, disputeId, reason, paymentIds) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'supportDisputeAlert.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      disputeId: disputeId,
      reason: reason || 'Unknown',
      paymentIds: paymentIds || 'N/A',
      year: new Date().getFullYear(),
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(to, '🚨 Dispute Alert - Immediate Action Required', htmlContent, 'Support Team');
  } catch (error) {
    console.error('Error sending support dispute alert:', error);
    throw new Error('Error in sending support dispute alert: ' + error.message);
  }
};

module.exports.supportUrgentRefundAlert = async (to, paymentIntentId, buyerId, totalAmount, paymentIds, originalError, refundError) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'supportUrgentRefund.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    const placeholders = {
      paymentIntentId: paymentIntentId,
      buyerId: buyerId,
      totalAmount: totalAmount,
      paymentIds: paymentIds || 'N/A',
      originalError: originalError || 'Unknown error',
      refundError: refundError || 'Unknown error',
      year: new Date().getFullYear(),
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    await sendZeptoEmail(to, '🚨🚨 URGENT: Manual Refund Required', htmlContent, 'Support Team');
  } catch (error) {
    console.error('Error sending urgent refund alert:', error);
    throw new Error('Error in sending urgent refund alert: ' + error.message);
  }
};

/**
 * Send order status update notification to buyer
 * @param {string} to - Buyer email
 * @param {string} fullName - Buyer full name
 * @param {string} orderId - Order ID
 * @param {string} newStatus - New order status (pending|processing|pending_logistics|completed|canceled|on-hold)
 */
module.exports.orderStatusUpdate = async (to, fullName, orderId, newStatus) => {
  try {
    const templatePath = path.join(__dirname, 'emailTemplates', 'orderStatusUpdate.html');
    let htmlContent = await loadHtmlTemplate(templatePath);

    // Map each status to a buyer-friendly contextual message
    const statusMessages = {
      pending: 'Your order has been received and is waiting to be processed. We will update you shortly.',
      processing: 'Great news! Your order is currently being prepared and will be dispatched soon.',
      pending_logistics: 'Your order has been confirmed and is awaiting logistics assignment. Our team is already working on it.',
      completed: 'Your order has been successfully delivered. We hope you enjoy your purchase!',
      canceled: 'Your order has been canceled. If you did not request this, please contact our support team.',
      'on-hold': 'Your order is temporarily on hold. Our team will get in touch with you for more details.',
    };

    const placeholders = {
      fullName: fullName || 'Valued Customer',
      orderId: orderId,
      newStatus: newStatus,
      statusMessage: statusMessages[newStatus] || 'Your order status has been updated.',
      year: new Date().getFullYear(),
    };

    htmlContent = replacePlaceholders(htmlContent, placeholders);

    const subjectMap = {
      pending: 'Your Order is Pending',
      processing: 'Your Order is Being Processed',
      pending_logistics: 'Your Order is Awaiting Logistics Processing',
      completed: 'Your Order has been Delivered!',
      canceled: 'Your Order has been Canceled',
      'on-hold': 'Your Order is On Hold',
    };

    const subject = subjectMap[newStatus] || `Order Status Update — ${newStatus}`;

    await sendZeptoEmail(to, subject, htmlContent, fullName);
  } catch (error) {
    console.error('Error sending order status update email:', error);
    throw new Error('Error in sending order status update email: ' + error.message);
  }
};

module.exports.logisticsManualProcessingAlert = async (to, payload) => {
  try {
    const {
      orderIds,
      buyerName,
      buyerEmail,
      buyerPhone,
      deliveryAddress,
      items,
      paymentReference,
      timestamp,
      explicitFlag,
      provider,
      dhlError
    } = payload;

    const itemRows = (items || [])
      .map((item) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${item.productName || 'Unknown Item'}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.quantity || 0}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.orderId || 'N/A'}</td>
        </tr>
      `)
      .join('');

    const addressText = [
      deliveryAddress?.address,
      deliveryAddress?.cityName,
      deliveryAddress?.postalCode,
      deliveryAddress?.countryCode
    ].filter(Boolean).join(', ') || 'Address unavailable';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
        <h2 style="color: #dc3545;">${provider || 'Shipping'} Shipment Failed - Manual Processing Required</h2>
        <p><strong>Flag:</strong> ${explicitFlag}</p>
        <p><strong>Order ID(s):</strong> ${(orderIds || []).join(', ') || 'N/A'}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p><strong>Buyer Name:</strong> ${buyerName || 'Unknown Buyer'}</p>
        <p><strong>Buyer Email:</strong> ${buyerEmail || 'N/A'}</p>
        <p><strong>Buyer Phone:</strong> ${buyerPhone || 'N/A'}</p>
        <p><strong>Delivery Address:</strong> ${addressText}</p>
        <p><strong>Payment Confirmation Reference:</strong> ${paymentReference || 'N/A'}</p>
        <p><strong>Timestamp:</strong> ${timestamp || new Date().toISOString()}</p>
        <p style="color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 4px; border: 1px solid #f5c6cb;"><strong>${provider || 'Shipping'} Error:</strong> ${dhlError || `Unknown ${(provider || 'shipping').toLowerCase()} failure`}</p>
        <h3>Order Items Summary</h3>
        <table style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Item</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Quantity</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Order ID</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows || '<tr><td colspan="3" style="padding:8px;border:1px solid #ddd;">No items available</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    await sendZeptoEmail(to, `${provider || 'Shipping'} Shipment Failed - Manual Processing Required`, htmlContent, 'Logistics Processing Team');
  } catch (error) {
    console.error('Error sending logistics manual processing alert:', error);
    throw new Error('Error in sending logistics manual processing alert: ' + error.message);
  }
};

module.exports.logisticsShipmentSuccessAlert = async (to, payload) => {
  try {
    const {
      orderIds,
      buyerName,
      buyerEmail,
      buyerPhone,
      deliveryAddress,
      items,
      paymentReference,
      timestamp,
      provider,
      shipmentDetails
    } = payload;

    const itemRows = (items || [])
      .map((item) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${item.productName || 'Unknown Item'}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.quantity || 0}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.orderId || 'N/A'}</td>
        </tr>
      `)
      .join('');

    const addressText = [
      deliveryAddress?.address,
      deliveryAddress?.cityName,
      deliveryAddress?.postalCode,
      deliveryAddress?.countryCode
    ].filter(Boolean).join(', ') || 'Address unavailable';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
        <h2 style="color: #28a745;">${provider || 'Shipping'} Shipment Successfully Created</h2>
        <p><strong>Order ID(s):</strong> ${(orderIds || []).join(', ') || 'N/A'}</p>
        <p><strong>Pickup Confirmation:</strong> <span style="font-size: 1.2em; color: #007bff; font-weight: bold;">${shipmentDetails?.pickupConfirmationNumber || 'N/A'}</span></p>
        <p><strong>Ready By Time:</strong> ${shipmentDetails?.readyByTime || 'N/A'}</p>
        <p><strong>Next Cutoff Time:</strong> ${shipmentDetails?.nextPickupCutoffTime || 'N/A'}</p>
        ${shipmentDetails?.shipmentStatus ? `<p><strong>Shipment Status:</strong> ${shipmentDetails.shipmentStatus}</p>` : ''}
        ${shipmentDetails?.shipmentPaymentStatus ? `<p><strong>Shipment Payment Status:</strong> ${shipmentDetails.shipmentPaymentStatus}</p>` : ''}
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p><strong>Buyer Name:</strong> ${buyerName || 'Unknown Buyer'}</p>
        <p><strong>Buyer Email:</strong> ${buyerEmail || 'N/A'}</p>
        <p><strong>Buyer Phone:</strong> ${buyerPhone || 'N/A'}</p>
        <p><strong>Delivery Address:</strong> ${addressText}</p>
        <p><strong>Payment Confirmation Reference:</strong> ${paymentReference || 'N/A'}</p>
        <p><strong>Timestamp:</strong> ${timestamp || new Date().toISOString()}</p>
        ${shipmentDetails?.warning ? `<p style="color: #856404; background-color: #fff3cd; padding: 10px; border-radius: 4px; border: 1px solid #ffeeba;"><strong>Warning:</strong> ${shipmentDetails.warning}</p>` : ''}
        <h3>Order Items Summary</h3>
        <table style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Item</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Quantity</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Order ID</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows || '<tr><td colspan="3" style="padding:8px;border:1px solid #ddd;">No items available</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    await sendZeptoEmail(to, `${provider || 'Shipping'} Shipment Created Successfully`, htmlContent, 'Logistics Processing Team');
  } catch (error) {
    console.error('Error sending logistics shipment success alert:', error);
    throw new Error('Error in sending logistics shipment success alert: ' + error.message);
  }
};


module.exports.contactUsNotification = async (email, fullName, message) => {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>New Contact Us Message</h2>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap; background: #f9f9f9; padding: 15px; border-radius: 5px;">${message}</p>
      </div>
    `;

    await sendZeptoEmail('info@oosri.com', 'New Contact Us Message from ' + fullName, htmlContent, 'Oosri Support', email, fullName);
  } catch (error) {
    console.error('Error sending contact us notification:', error);
    throw new Error('Error in sending contact us notification: ' + error.message);
  }
};

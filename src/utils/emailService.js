const nodemailer = require('nodemailer');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

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

const replacePlaceholders = (template, placeholders) => {
  let result = template;
  for (const key in placeholders) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), placeholders[key]);
  }
  return result;
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

    const mailOptions = {
      from: process.env.EMAIL_USER,
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

    const mailOptions = {
      from: process.env.EMAIL_USER,
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

        const mailOptions = {
            from: process.env.EMAIL_USER,  
            to,                        
            subject: 'Order Confirmed and Now Being Processed',
            html: htmlContent,            
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        throw new Error('Error in sending Order Placed email: ' + error.message);
    }
};
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify((err, success) => {
  if (err) console.error("Transporter error:", err);
  else console.log("✅ Email transporter ready");
});

async function sendPriceAlert(to, productName, oldPrice, newPrice) {
  const mailOptions = {
    from: `"MicroTrack Alerts" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Price Drop Alert!',
    text: `${productName} dropped from $${oldPrice} to $${newPrice}!`
  };

  try {
    console.log("Sending email to:", to);
    console.log("Using Gmail:", process.env.EMAIL_USER);
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (err) {
    console.error("Email error:", err);
  }
}

module.exports = sendPriceAlert;
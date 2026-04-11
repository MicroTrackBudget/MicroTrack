const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // 587 = false (STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// optional debug check
transporter.verify((err) => {
  if (err) console.error("❌ SMTP error:", err);
  else console.log("✅ Brevo SMTP ready");
});

async function sendPriceAlert(to, productName, oldPrice, newPrice) {
  try {
    console.log("📧 Sending email to:", to);

    const info = await transporter.sendMail({
      from: `"MicroTrack Alerts" <${process.env.SMTP_USER}>`,
      to,
      subject: "Price Drop Alert!",
      text: `${productName} dropped from $${oldPrice} to $${newPrice}!`
    });

    console.log("✅ Email sent:", info.response);
  } catch (err) {
    console.error("❌ Email error:", err);
  }
}

module.exports = sendPriceAlert;
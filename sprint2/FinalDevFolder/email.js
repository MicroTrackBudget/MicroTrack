const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // 587 = STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// optional debug
transporter.verify((err) => {
  if (err) console.error("❌ SMTP error:", err);
  else console.log("✅ Brevo SMTP ready");
});

async function sendPriceAlert(to, productName, oldPrice, newPrice) {
  try {
    const info = await transporter.sendMail({
      from: `"MicroTrack Alerts" <${process.env.SMTP_USER}>`,
      to,
      subject: "Price Drop Alert 🔥",
      html: `
        <h2>Price Drop Alert</h2>
        <p><b>${productName}</b></p>
        <p>Old: $${oldPrice}</p>
        <p>New: $${newPrice}</p>
      `
    });

    console.log("📧 Email sent:", info.messageId);
  } catch (err) {
    console.error("❌ Email error:", err);
  }
}

module.exports = sendPriceAlert;
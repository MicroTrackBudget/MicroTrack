const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.error("❌ Missing RESEND_API_KEY environment variable");
}

const resend = new Resend(apiKey);

async function sendPriceAlert(to, productName, oldPrice, newPrice) {
  try {
    if (!apiKey) return;

    const result = await resend.emails.send({
      from: 'MicroTrack <onboarding@resend.dev>',
      to,
      subject: '🔥 Price Drop Alert!',
      text: `${productName} dropped from $${oldPrice} to $${newPrice}!`
    });

    console.log("Email sent via Resend:", result);
  } catch (err) {
    console.error("Resend email error:", err);
  }
}

module.exports = sendPriceAlert;
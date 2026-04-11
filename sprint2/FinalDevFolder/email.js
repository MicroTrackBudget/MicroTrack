const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendPriceAlert(to, productName, oldPrice, newPrice) {
  try {
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
const fetch = require('node-fetch');
require('dotenv').config();

async function sendPriceAlert(to, productName, currentPrice, targetPrice) {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: "MicroTrack Alerts", email: "your-verified-sender@yourdomain.com" },
        to: [{ email: to }],
        subject: "Price Drop Alert 🔥",
        htmlContent: `
          <h2>Price Drop Alert</h2>
          <p><b>${productName}</b> has hit your target!</p>
          <p>Current Price: $${currentPrice}</p>
          <p>Your Target: $${targetPrice}</p>
        `
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    console.log("📧 Email sent via Brevo API");
  } catch (err) {
    console.error("❌ Email error:", err);
  }
}

module.exports = sendPriceAlert;
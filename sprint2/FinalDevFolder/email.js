const SibApiV3Sdk = require('@getbrevo/brevo');
require('dotenv').config();

let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.SMTP_PASS; // (Brevo API key works here too)

async function sendPriceAlert(to, productName, oldPrice, newPrice) {
  try {
    const email = {
      sender: { email: process.env.SMTP_USER, name: "MicroTrack" },
      to: [{ email: to }],
      subject: "Price Drop Alert!",
      textContent: `${productName} dropped from $${oldPrice} to $${newPrice}!`
    };

    const result = await apiInstance.sendTransacEmail(email);
    console.log("Email sent via Brevo API:", result);
  } catch (err) {
    console.error("Email error:", err);
  }
}

module.exports = sendPriceAlert;
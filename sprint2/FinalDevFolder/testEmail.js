require('dotenv').config();
const sendPriceAlert = require('./email');

// Replace with your own email to test
const testEmail = process.env.EMAIL_TEST;

sendPriceAlert(testEmail, 'Test Product', 100, 80);
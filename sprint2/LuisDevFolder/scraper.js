// scraper.js
const axios = require('axios');
const cheerio = require('cheerio');

// Replace with your real ScrapingBee API key
const SCRAPINGBEE_API_KEY = 'API_KEY_GOES_HERE';

/**
 * Get Walmart product price from URL
 * @param {string} productUrl 
 * @returns {number|null} current price or null if not found
 */
async function getWalmartPrice(productUrl) {
    try {
        const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
            params: {
                api_key: SCRAPINGBEE_API_KEY,
                url: productUrl,
                render_js: true
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Walmart's product JSON is in __NEXT_DATA__ script
        const jsonText = $('#__NEXT_DATA__').html();
        if (!jsonText) return null;

        const data = JSON.parse(jsonText);

        // Navigate JSON safely
        const price = data?.props?.pageProps?.initialData?.data?.product?.priceInfo?.currentPrice?.price;

        return price != null ? Number(price) : null;
    } catch (err) {
        console.error('Scraping error (Walmart):', err.message);
        return null;
    }
}

/**
 * Example stub for Amazon scraper (can implement later)
 */
async function getAmazonPrice(productUrl) {
    // Implement similar approach with ScrapingBee and cheerio
    return null;
}

module.exports = { getWalmartPrice, getAmazonPrice };

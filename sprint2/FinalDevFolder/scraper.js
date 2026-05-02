// scraper.js
const axios = require('axios');
const cheerio = require('cheerio');

// Replace with your real ScrapingBee API key
const SCRAPINGBEE_API_KEY = 'JRIM6BO87GOUTR7WU0RO1AVXDKAH9TOAB6LN4YFDA1IMF2OP5WGC7ZL579VPCHJKE96T1VEWZNA23WEL';

// --- Clean full Amazon URL to ASIN ---
function cleanAmazonUrl(productUrl) {
    const match = productUrl.match(/\/dp\/([A-Z0-9]{10})/);
    if (!match) return productUrl;
    return `https://www.amazon.com/dp/${match[1]}`;
  }
  
  // --- Resolve a.co short links ---
  async function resolveAmazonUrl(productUrl) {
    if (productUrl.includes('amazon.com')) {
      return cleanAmazonUrl(productUrl);
    }
    try {
      const response = await axios.get(productUrl, {
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
      });
      const finalUrl = response.request.res.responseUrl;
      console.log('Resolved short URL to:', finalUrl);
      return cleanAmazonUrl(finalUrl);
    } catch (err) {
      console.error('Failed to resolve Amazon short URL:', err.message);
      return productUrl;
    }
  }
  
  // --- Parse a price string like "$19.99" or "19.99" → 19.99 ---
  function parsePrice(text) {
    if (!text) return null;
    const cleaned = text.replace(/[^0-9.]/g, '');
    const num = Number(cleaned);
    return isNaN(num) || num === 0 ? null : num;
  }

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

// --- Amazon ---
async function getAmazonPrice(productUrl) {
    try {
      const cleanUrl = await resolveAmazonUrl(productUrl);
      console.log('Scraping Amazon URL:', cleanUrl);
  
      const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
        params: {
          api_key: SCRAPINGBEE_API_KEY,
          url: cleanUrl,
          render_js: true,
          premium_proxy: true,   // FIX 1: required to avoid CAPTCHA/bot walls
          country_code: 'us',    // FIX 2: ensures USD pricing on amazon.com
          window_width: 1920,    // FIX 3: desktop layout has consistent selectors
          window_height: 1080,
        },
      });
  
      const $ = cheerio.load(response.data);
  
      // Early exit: detect CAPTCHA / bot-detection page
      const title = $('title').text().trim();
      if (
        title.toLowerCase().includes('robot') ||
        title.toLowerCase().includes('captcha') ||
        title.toLowerCase().includes('sorry')
      ) {
        console.warn('Amazon: bot-detection page served. Title:', title);
        return null;
      }
  
      // Method 1: corePriceDisplay / priceToPay block (most reliable, modern PDPs)
      // FIX 4: read the whole+fraction spans directly instead of .a-offscreen
      const tryBlockPrice = (selector) => {
        const block = $(selector).first();
        if (!block.length) return null;
        // whole contains "19." — keep the dot, just strip non-numeric except "."
        const whole = block.find('.a-price-whole').first().text().replace(/[^0-9.]/g, '');
        const fraction = block.find('.a-price-fraction').first().text().replace(/[^0-9]/g, '');
        if (!whole) return null;
        // whole already ends with "." on Amazon e.g. "19." so appending fraction gives "19.99"
        const raw = fraction ? `${whole}${fraction}` : `${whole}00`;
        return parsePrice(raw);
      };
  
      let price =
        tryBlockPrice('.priceToPay') ||
        tryBlockPrice('#corePriceDisplay_desktop_feature_div .a-price') ||
        tryBlockPrice('#apex_desktop_newAccordionRow .a-price') ||
  
        // Method 2: deal / sale price containers
        tryBlockPrice('#dealprice_shippingMessage .a-price') ||
        tryBlockPrice('.reinventPricePriceToPayMargin .a-price') ||
  
        // Method 3: legacy price IDs (older ASINs / 3P sellers)
        parsePrice($('#priceblock_ourprice').text()) ||
        parsePrice($('#priceblock_dealprice').text()) ||
        parsePrice($('#priceblock_saleprice').text()) ||
  
        // Method 4: last-resort — any .a-price block visible on page
        tryBlockPrice('.a-price');
  
      if (price == null) {
        console.warn('Amazon: could not find price. Page title:', title);
        // Uncomment the line below while debugging to dump the raw HTML:
        // require('fs').writeFileSync('amazon_debug.html', response.data);
        return null;
      }
  
      console.log('Amazon price found:', price);
      return price;
  
    } catch (err) {
      if (err.response) {
        console.error(
          'Amazon ScrapingBee error:',
          err.response.status,
          JSON.stringify(err.response.data)
        );
      } else {
        console.error('Amazon scraping error:', err.message);
      }
      return null;
    }
  }

module.exports = { getWalmartPrice, getAmazonPrice };
// app.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const scraper = require('./scraper');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

db.connect((err) => {
    if (err) {
        console.error('❌ MySQL connection failed:', err.message);
        return;
    }
    console.log('✅ Connected to MySQL database!');
});

/* ================= USERS ================= */

app.post('/api/users', (req, res) => {
    const { fullName, email, password } = req.body;

    const query = 'INSERT INTO Users (username, email, password) VALUES (?, ?, ?)';
    db.query(query, [fullName, email, password], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY')
                return res.status(400).json({ error: 'Email already exists' });
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, userId: result.insertId });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    db.query(
        'SELECT * FROM Users WHERE email = ? AND password = ?',
        [email, password],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length === 0)
                return res.status(400).json({ error: 'No account found with this email/password' });

            res.json({
                success: true,
                userId: results[0].user_id,
                username: results[0].username
            });
        }
    );
});

/* ================= GET PRODUCTS ================= */

app.get('/sprint2/api/products', (req, res) => {
    const user_id = req.query.user_id;
    if (!user_id)
        return res.status(400).json({ error: 'Missing user_id' });

    db.query(
        'SELECT * FROM Product WHERE user_id = ?',
        [user_id],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ products: results });
        }
    );
});

/* ================= ADD PRODUCT ================= */

app.post('/sprint2/api/products', async (req, res) => {
    const { product_name, store_location, product_url, user_id, target_price } = req.body;

    if (!user_id)
        return res.status(400).json({ error: 'Missing user_id' });

    let scrapedPrice = null;

    try {
        switch (store_location.toLowerCase()) {

            case 'walmart':
                // 🔥 CLEAN WALMART URL (removes tracking parameters)
                const cleanUrl = product_url.split('?')[0];
                console.log("Scraping Walmart URL:", cleanUrl);

                scrapedPrice = await scraper.getWalmartPrice(cleanUrl);
                console.log("Scraped Price:", scrapedPrice);
                break;

            case 'amazon':
                scrapedPrice = await scraper.getAmazonPrice(product_url);
                break;

            default:
                scrapedPrice = null;
        }

    } catch (err) {
        console.error('Scraping error:', err.message);
    }

    const finalPrice = scrapedPrice !== null ? scrapedPrice : null;

    db.query(
        'INSERT INTO Product (product_name, store_location, product_url, current_price, target_price, user_id) VALUES (?, ?, ?, ?, ?, ?)',
        [product_name, store_location, product_url, finalPrice, target_price, user_id],
        (err, result) => {
            if (err)
                return res.status(500).json({ error: err.message });

            const productId = result.insertId;

            if (finalPrice !== null) {
                db.query(
                    'INSERT INTO PriceHistory (product_id, price, price_date) VALUES (?, ?, NOW())',
                    [productId, finalPrice],
                    (err2) => {
                        if (err2)
                            console.error('Failed to insert PriceHistory:', err2.message);
                    }
                );
            }

            res.json({
                success: true,
                productId,
                current_price: finalPrice,
                target_price
            });
        }
    );
});

/* ================= UPDATE PRICES ================= */

app.get('/sprint2/api/update-prices', async (req, res) => {
    const user_id = req.query.user_id;
    if (!user_id)
        return res.status(400).json({ error: 'Missing user_id' });

    try {
        const [products] = await db.promise().query(
            'SELECT * FROM Product WHERE user_id = ?',
            [user_id]
        );

        const updates = [];

        for (let product of products) {
            let price = null;

            switch (product.store_location.toLowerCase()) {

                case 'walmart':
                    const cleanUrl = product.product_url.split('?')[0];
                    price = await scraper.getWalmartPrice(cleanUrl);
                    break;

                case 'amazon':
                    price = await scraper.getAmazonPrice(product.product_url);
                    break;

                default:
                    price = null;
            }

            if (price !== null) {
                await db.promise().query(
                    'UPDATE Product SET current_price = ? WHERE product_id = ?',
                    [price, product.product_id]
                );

                await db.promise().query(
                    'INSERT INTO PriceHistory (product_id, price, price_date) VALUES (?, ?, NOW())',
                    [product.product_id, price]
                );

                updates.push({ product_id: product.product_id, price });
            }
        }

        res.json({ success: true, updates });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

/* ================= TEST ROUTE ================= */

app.get('/sprint2/test-walmart', async (req, res) => {
    const testUrl = 'https://www.walmart.com/ip/18988764263';

    try {
        const price = await scraper.getWalmartPrice(testUrl);
        res.send(price ? `✅ Walmart price: $${price}` : '⚠️ Price not found');
    } catch (err) {
        res.status(500).send(`❌ Error: ${err.message}`);
    }
});

/* ================= START SERVER ================= */

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// CREATE BUDGET
app.post('/createBudget', (req,res)=>{
    const {monthly_limit,weekly_limit,user_id,category_id} = req.body;
  
    if(monthly_limit === undefined || user_id === undefined || category_id === undefined)
      return res.status(400).json({error:"Missing required fields"});
  
    db.query(
      `INSERT INTO Budget (monthly_limit,weekly_limit,user_id,category_id)
       VALUES (?,?,?,?)`,
      [monthly_limit, weekly_limit || 0, user_id, category_id],
      (err,result)=>{
        if(err) return res.status(500).json({error:"Database error"});
        res.json({message:"Budget created", budgetId: result.insertId});
      }
    );
  });

  // CATEGORY
app.post("/getOrCreateCategory", (req, res) => {
    const { category_name } = req.body;
  
    db.query(
      "SELECT category_id FROM SpendCategory WHERE category_name = ?",
      [category_name],
      (err, results) => {
        if (err) return res.status(500).json({ error: "DB error" });
  
        if (results.length > 0) {
          return res.json({ category_id: results[0].category_id });
        }
  
        db.query(
          "INSERT INTO SpendCategory (category_name) VALUES (?)",
          [category_name],
          (err, result) => {
            if (err) return res.status(500).json({ error: "Insert error" });
            res.json({ category_id: result.insertId });
          }
        );
      }
    );
  });

  // GET BUDGETS
app.get('/budgets/:userId',(req,res)=>{
    const {userId} = req.params;
  
    db.query(
      `SELECT B.budget_id, S.category_name, B.monthly_limit,
       IFNULL(SUM(T.transaction_amount),0) AS spent
       FROM Budget B
       JOIN SpendCategory S ON B.category_id = S.category_id
       LEFT JOIN Transactions T
         ON T.category_id = B.category_id AND T.user_id = B.user_id
       WHERE B.user_id = ?
       GROUP BY B.budget_id`,
      [userId],
      (err,results)=>{
        if(err) return res.status(500).json({error:"Database error"});
        res.json(results);
      }
    );
  });

  // DELETE BUDGET
app.delete('/budget/:id',(req,res)=>{
    const {id} = req.params;
  
    db.query(
      `DELETE FROM Budget WHERE budget_id=?`,
      [id],
      err => {
        if(err) return res.status(500).json({error:"Database error"});
        res.json({message:"Budget deleted"});
      }
    );
  });

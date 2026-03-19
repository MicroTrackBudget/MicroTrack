require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const scraper = require('./scraper');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ================= DB ================= */

const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "BudgetApp"
});

db.connect(err => {
    if (err) {
        console.error('❌ MySQL connection failed:', err.message);
        return;
    }
    console.log('✅ Connected to MySQL database!');
});

const dbAsync = db.promise(); // allows async/await

/* ================= USERS ================= */

app.post('/api/users', (req, res) => {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) return res.status(400).json({ error: "All fields required" });

    db.query(
        'INSERT INTO Users (username, email, password) VALUES (?, ?, ?)',
        [fullName, email, password],
        (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, userId: result.insertId });
        }
    );
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });

    db.query(
        'SELECT * FROM Users WHERE email = ? AND password = ?',
        [email, password],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length === 0) return res.status(400).json({ error: 'Invalid login' });

            res.json({
                success: true,
                userId: results[0].user_id,
                username: results[0].username
            });
        }
    );
});

/* ================= PRODUCTS ================= */

app.get('/sprint2/api/products', (req, res) => {
    const user_id = req.query.user_id;
    if (!user_id) return res.status(400).json({ error: "Missing user_id" });

    db.query(
        'SELECT * FROM Product WHERE user_id = ?',
        [user_id],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ products: results });
        }
    );
});

app.post('/sprint2/api/products', async (req, res) => {
    const { product_name, store_location, product_url, user_id, target_price } = req.body;
    if (!product_name || !store_location || !product_url || !user_id) return res.status(400).json({ error: "Missing required fields" });

    let scrapedPrice = null;

    try {
        if (store_location.toLowerCase() === 'walmart') {
            const cleanUrl = product_url.split('?')[0];
            scrapedPrice = await scraper.getWalmartPrice(cleanUrl);
        } else if (store_location.toLowerCase() === 'amazon') {
            scrapedPrice = await scraper.getAmazonPrice(product_url);
        }
    } catch (err) {
        console.error("Scraping error:", err.message);
    }

    const finalPrice = scrapedPrice != null ? scrapedPrice : null;

    db.query(
        'INSERT INTO Product (product_name, store_location, product_url, current_price, target_price, user_id) VALUES (?, ?, ?, ?, ?, ?)',
        [product_name, store_location, product_url, finalPrice, target_price, user_id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            const productId = result.insertId;

            if (finalPrice != null) {
                db.query(
                    'INSERT INTO PriceHistory (product_id, price, price_date) VALUES (?, ?, NOW())',
                    [productId, finalPrice],
                    (err2) => {
                        if (err2) console.error('Failed to insert PriceHistory:', err2.message);
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

/* ================= UPDATE PRODUCT PRICES ================= */

app.get('/sprint2/api/update-prices', async (req, res) => {
    const user_id = req.query.user_id;
    if (!user_id) return res.status(400).json({ error: "Missing user_id" });

    try {
        const [products] = await dbAsync.query(
            'SELECT * FROM Product WHERE user_id = ?',
            [user_id]
        );

        const updates = [];

        for (let product of products) {
            let price = null;
            try {
                if (product.store_location.toLowerCase() === 'walmart') {
                    const cleanUrl = product.product_url.split('?')[0];
                    price = await scraper.getWalmartPrice(cleanUrl);
                } else if (product.store_location.toLowerCase() === 'amazon') {
                    price = await scraper.getAmazonPrice(product.product_url);
                }
            } catch (err) {
                console.error("Scraping error:", err.message);
            }

            if (price != null) {
                await dbAsync.query(
                    'UPDATE Product SET current_price = ? WHERE product_id = ?',
                    [price, product.product_id]
                );

                await dbAsync.query(
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

/* ================= BUDGETS ================= */

app.post('/createBudget', (req,res)=>{
    const { monthly_limit, weekly_limit, user_id, category_id } = req.body;
    if (!monthly_limit || !user_id || !category_id) return res.status(400).json({ error: "Missing required fields" });

    db.query(
        `INSERT INTO Budget (monthly_limit, weekly_limit, user_id, category_id) VALUES (?, ?, ?, ?)`,
        [monthly_limit, weekly_limit || 0, user_id, category_id],
        (err, result) => {
            if(err) return res.status(500).json({ error:"Database error" });
            res.json({ message:"Budget created", budgetId: result.insertId });
        }
    );
});

app.post("/getOrCreateCategory", (req, res) => {
    const { category_name } = req.body;
    if (!category_name) return res.status(400).json({ error:"Missing category_name" });

    db.query(
        "SELECT category_id FROM SpendCategory WHERE category_name = ?",
        [category_name], 
        (err, results) => {
            if(err) return res.status(500).json({ error:"DB error" });
            if(results.length > 0) return res.json({ category_id: results[0].category_id });

            db.query(
                "INSERT INTO SpendCategory (category_name) VALUES (?)",
                [category_name],
                (err2, result2) => {
                    if(err2) return res.status(500).json({ error:"Insert error" });
                    res.json({ category_id: result2.insertId });
                }
            );
        }
    );
});

app.get('/budgets/:userId', (req,res)=>{
    const userId = req.params.userId;

    db.query(
        `SELECT B.budget_id, S.category_name, B.monthly_limit,
                IFNULL(SUM(T.transaction_amount),0) AS spent
         FROM Budget B
         JOIN SpendCategory S ON B.category_id = S.category_id
         LEFT JOIN Transactions T ON T.category_id = B.category_id AND T.user_id = B.user_id
         WHERE B.user_id = ?
         GROUP BY B.budget_id`,
        [userId],
        (err, results) => {
            if(err) return res.status(500).json({ error:"Database error" });
            res.json(results);
        }
    );
});

app.delete('/budget/:id', (req,res)=>{
    const { id } = req.params;
    db.query(
        `DELETE FROM Budget WHERE budget_id=?`,
        [id],
        err => {
            if(err) return res.status(500).json({ error:"Database error" });
            res.json({ message:"Budget deleted" });
        }
    );
});

/* ================= SAVINGS ================= */

// Calculate remaining savings goal
app.post("/api/savings/calculate", async (req, res) => {
    const { userId, goalId, targetAmount, savedAmount } = req.body;
    if(targetAmount == null || savedAmount == null) return res.status(400).json({ error: "Missing amounts" });

    const remainingGoal = targetAmount - savedAmount;
    if(!userId || !goalId) return res.json({ remainingGoal });

    try {
        const [rows] = await dbAsync.query(
            `SELECT * FROM SavingsGoal WHERE user_id = ? AND goal_id = ?`,
            [userId, goalId]
        );
        if(rows.length === 0) return res.json({ remainingGoal });

        res.json({
            remainingGoal,
            goal_name: rows[0].goal_name,
            target_amount: rows[0].target_amount,
            saved_amount: rows[0].saved_amount
        });
    } catch(err) {
        console.error(err);
        res.status(500).json({ remainingGoal });
    }
});

// Save a savings goal
app.post("/api/savings/save", async (req, res) => {
    const { userId, goalName, targetAmount, savedAmount } = req.body;
    if(!userId || !goalName || targetAmount == null || savedAmount == null) 
        return res.status(400).json({ error: "Missing required fields" });

    const remainingGoal = targetAmount - savedAmount;

    try {
        const [result] = await dbAsync.query(
            `INSERT INTO SavingsGoal
             (user_id, goal_name, target_amount, saved_amount, remaining_goal, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [userId, goalName, targetAmount, savedAmount, remainingGoal]
        );
        res.json({ success: true, goalId: result.insertId, remainingGoal });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error:"Could not save savings goal." });
    }
});

// Load latest saved goal
app.get("/api/savings/latest", async (req, res) => {
    const userId = req.query.userId;
    if(!userId) return res.status(400).json({ error:"userId is required" });

    try {
        const [rows] = await dbAsync.query(
            `SELECT goal_id, goal_name, target_amount, saved_amount, remaining_goal, created_at
             FROM SavingsGoal
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId]
        );
        if(rows.length === 0) return res.status(404).json({ error:"No savings goals found" });
        res.json(rows[0]);
    } catch(err) {
        console.error(err);
        res.status(500).json({ error:"Could not load latest savings goal" });
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

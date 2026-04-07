require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const scraper = require('./scraper');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt'); 

const app = express();
const PORT = 3000;

app.use(cors({
    origin: ['https://microtrack-44c71.web.app', 'http://localhost:3000']
  }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DB 
const db = mysql.createConnection({
    host: process.env.MYSQLHOST,
    port: process.env.MYSQLPORT,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE
  });

db.connect(err => {
    if (err) {
        console.error('❌ MySQL connection failed:', err.message);
        return;
    }
    console.log('✅ Connected to MySQL database!');
});

const dbAsync = db.promise();

//AUTH 

// Register
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
        return res.status(400).json({ error: "All fields required" });

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: "Hash failed" });

        db.query(
            'INSERT INTO Users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hash],
            (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY')
                        return res.status(400).json({ error: 'Email already exists' });
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, userId: result.insertId });
            }
        );
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    db.query(
        'SELECT * FROM Users WHERE email = ?',
        [email],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length === 0)
                return res.status(400).json({ error: 'Invalid login' });

            bcrypt.compare(password, results[0].password, (err, match) => {
                if (!match)
                    return res.status(400).json({ error: 'Invalid login' });

                res.json({
                    success: true,
                    userId: results[0].user_id,
                    username: results[0].username
                });
            });
        }
    );
});

// Reset Password
app.post('/api/resetPassword', (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword)
        return res.status(400).json({ error: "Missing fields" });

    bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: "Hash failed" });

        db.query(
            'UPDATE Users SET password = ? WHERE email = ?',
            [hash, email],
            (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                if (result.affectedRows === 0)
                    return res.status(404).json({ error: "User not found" });

                    res.json({ success: true });
            }
        );
    });
});

//TRANSACTIONS

//Add Purchase
app.post('/api/addPurchase', (req, res) => {
    const { user_id, category_id, transaction_amount, description } = req.body;

    if (!user_id || !category_id || !transaction_amount)
        return res.status(400).json({ error: "Missing required fields" });

    db.query(
        `INSERT INTO Transactions 
        (transaction_amount, transaction_date, user_id, category_id, description)
        VALUES (?, NOW(), ?, ?, ?)`,
        [transaction_amount, user_id, category_id, description || null],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: err.message });
            }

            res.json({
                success: true,
                transactionId: result.insertId
            });
        }
    );
});

//PRODUCTS

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
    if (!product_name || !store_location || !product_url || !user_id)
        return res.status(400).json({ error: "Missing required fields" });

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

    db.query(
        'INSERT INTO Product (product_name, store_location, product_url, current_price, target_price, user_id) VALUES (?, ?, ?, ?, ?, ?)',
        [product_name, store_location, product_url, scrapedPrice, target_price, user_id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            const productId = result.insertId;

            if (scrapedPrice != null) {
                db.query(
                    'INSERT INTO PriceHistory (product_id, price, price_date) VALUES (?, ?, NOW())',
                    [productId, scrapedPrice]
                );
            }

            res.json({ success: true, productId, current_price: scrapedPrice });
        }
    );
});

//UPDATE PRODUCT PRICES 

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
            } catch (err) {}

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
        res.status(500).json({ error: err.message });
    }
});

//CATEGORIES

// Get or create category
app.post('/getOrCreateCategory', (req, res) => {
    const { category_name } = req.body;

    if (!category_name) return res.status(400).json({ error: "Missing category_name" });

    // Check if category exists
    db.query(
        'SELECT category_id FROM SpendCategory WHERE category_name = ?',
        [category_name],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            if (results.length > 0) {
                // Category exists
                return res.json({ category_id: results[0].category_id });
            } else {
                // Create new category
                db.query(
                    'INSERT INTO SpendCategory (category_name) VALUES (?)',
                    [category_name],
                    (err, insertResult) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ category_id: insertResult.insertId });
                    }
                );
            }
        }
    );
});

//BUDGETS

app.post('/api/createBudget', (req,res)=>{
    const { monthly_limit, weekly_limit, user_id, category_id } = req.body;

    if (!monthly_limit || !user_id || !category_id) 
        return res.status(400).json({ error: "Missing required fields" });

    db.query(
        `INSERT INTO Budget (monthly_limit, weekly_limit, user_id, category_id) VALUES (?, ?, ?, ?)`,
        [monthly_limit || 0, weekly_limit || 0, user_id, category_id],
        (err, result) => {
            if(err) {
                console.error("SQL Error:", err.message); // 🔥 log actual MySQL error
                return res.status(500).json({ error: err.message });
            }
            res.json({ message:"Budget created", budgetId: result.insertId });
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

//START SERVER

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});

app.get('/test', (req, res) => {
    res.json({ message: "Server is working!" });
});

// TEMP Budget Calculator route
app.post('/budget/savings', async (req, res) => {
    const { income, spending, userId, categoryId } = req.body;

    if (income == null || spending == null)
        return res.status(400).json({ error: "Income and Spending required" });

    let monthly_limit = null;
    let weekly_limit = null;

    if (userId && categoryId) {
        try {
            const [rows] = await dbAsync.query(
                'SELECT monthly_limit, weekly_limit FROM Budget WHERE user_id = ? AND category_id = ?',
                [userId, categoryId]
            );
            if (rows.length > 0) {
                monthly_limit = rows[0].monthly_limit;
                weekly_limit = rows[0].weekly_limit;
            }
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "DB error" });
        }
    }

    const remainingBudget = income - spending;

    res.json({ remainingBudget, monthly_limit, weekly_limit });
});

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

//SAVINGS 

// Calculate savings goal (frontend calls /api/savings/calculate)
app.post('/api/savings/calculate', (req, res) => {
    const { targetAmount, savedAmount, goalName } = req.body;
    if (targetAmount == null || savedAmount == null)
        return res.status(400).json({ error: "Target and Saved amount required" });

    const remainingGoal = targetAmount - savedAmount;

    res.json({ 
        remainingGoal,
        goal_name: goalName || null
    });
});

// Get latest savings goal for a user (frontend calls /api/savings/latest)
app.get('/api/savings/latest', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: "User ID required" });

    try {
        const [rows] = await dbAsync.query(
            `SELECT * FROM SavingsGoal 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [userId]
        );
        if (rows.length === 0) return res.status(404).json({ error: "No saved goals found" });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not fetch latest goal" });
    }
});

app.post('/api/checkEmail', (req, res) => {
    const { email } = req.body;

    db.query(
        'SELECT * FROM Users WHERE email = ?',
        [email],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({ exists: results.length > 0 });
        }
    );
});

app.post('/verifyUser', (req, res) => {
    const { email, username } = req.body;

    if (!email || !username) {
        return res.status(400).json({ error: "Missing fields" });
    }

    db.query(
        'SELECT * FROM Users WHERE email = ? AND username = ?',
        [email, username],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({ verified: results.length > 0 });
        }
    );
});

app.delete('/budget/:id', (req, res) => {
    const { id } = req.params;

    db.query(
        'DELETE FROM Budget WHERE budget_id = ?',
        [id],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: err.message });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Budget not found" });
            }

            res.json({ success: true, message: "Budget deleted" });
        }
    );
});

// GET SPENDING REPORT
app.get('/report/:userId', (req, res) => {

    const { userId } = req.params;
  
    const query = `
      SELECT 
        S.category_name,
        COUNT(T.transaction_id) AS total_transactions,
        IFNULL(SUM(T.transaction_amount), 0) AS total_spent
      FROM SpendCategory S
      LEFT JOIN Transactions T
        ON S.category_id = T.category_id
        AND T.user_id = ?
      GROUP BY S.category_id
    `;
  
    db.query(query, [userId], (err, results) => {
  
      if (err) return res.status(500).json({ error: "Database error" });
  
      res.json(results);
  
    });
});
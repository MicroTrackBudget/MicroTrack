const sendPriceAlert = require('./email');
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
const db = mysql.createPool({
    host: process.env.MYSQLHOST,
    port: process.env.MYSQLPORT,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.query('SELECT 1', (err) => {
    if (err) {
        console.error('❌ MySQL connection failed:', err.message);
    } else {
        console.log('✅ Connected to MySQL database!');
    }
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
    const forceEmail = req.query.forceEmail === 'true';
    if (!user_id) return res.status(400).json({ error: "Missing user_id" });

    try {
        // Get all products for the user along with their email
        const [products] = await dbAsync.query(
            `SELECT P.*, U.email
             FROM Product P
             JOIN Users U ON P.user_id = U.user_id
             WHERE P.user_id = ?`,
            [user_id]
        );

        const updates = [];

        for (let product of products) {
            let scrapedPrice = null;

            // --- Scrape price if store is recognized ---
            try {
                if (product.store_location?.toLowerCase() === 'walmart') {
                    const cleanUrl = product.product_url.split('?')[0];
                    scrapedPrice = await scraper.getWalmartPrice(cleanUrl);
                } else if (product.store_location?.toLowerCase() === 'amazon') {
                    scrapedPrice = await scraper.getAmazonPrice(product.product_url);
                }
            } catch (err) {
                console.error(`Error scraping ${product.product_name}:`, err);
            }

            // Convert string prices to numbers
            if (typeof scrapedPrice === 'string') scrapedPrice = Number(scrapedPrice.replace('$',''));

            const oldPriceNum = Number(product.current_price);
            const targetPriceNum = Number(product.target_price);

            // Use scraped price if available
            const newPriceNum = scrapedPrice != null ? scrapedPrice : oldPriceNum;

            // --- Send email if price hits target OR forceEmail ---
            if (!isNaN(targetPriceNum) && (newPriceNum <= targetPriceNum || forceEmail)) {
                console.log(`🔥 Sending price alert for ${product.product_name}: $${newPriceNum} (target $${targetPriceNum})`);
                try {
                    await sendPriceAlert(product.email, product.product_name, newPriceNum, targetPriceNum);
                } catch (err) {
                    console.error("Failed to send email:", err);
                }
            }

            // --- Update database only if price changed ---
            if (scrapedPrice != null && scrapedPrice !== oldPriceNum) {
                await dbAsync.query(
                    'UPDATE Product SET current_price = ? WHERE product_id = ?',
                    [newPriceNum, product.product_id]
                );

                updates.push({ product_id: product.product_id, price: newPriceNum });
            }
        }

        res.json({ success: true, updates, forceEmail });
    } catch (err) {
        console.error("Update prices error:", err);
        res.status(500).json({ error: err.message });
    }
});

/* ================= REMOVE PRODUCT ================= */
app.delete('/sprint2/api/remove-product', (req, res) => {
  const id = req.query.id;

  if (!id) return res.status(400).json({ error: "Missing product id" });

  // STEP 1: delete price history first
  db.query(
      'DELETE FROM PriceHistory WHERE product_id = ?',
      [id],
      (err) => {
          if (err) {
              console.error("PriceHistory delete error:", err);
              return res.status(500).json({ error: "Database error" });
          }

          // STEP 2: delete product
          db.query(
              'DELETE FROM Product WHERE product_id = ?',
              [id],
              (err2, result) => {
                  if (err2) {
                      console.error("Product delete error:", err2);
                      return res.status(500).json({ error: "Database error" });
                  }

                  res.json({ success: true });
              }
          );
      }
  );
});
 
/* ================= CATEGORIES ================= */

// Get or create category
app.post('/getOrCreateCategory', (req, res) => {
    const { category_name } = req.body;

    if (!category_name) return res.status(400).json({ error: "Missing category_name" });

    // Check if category exist
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

app.get('/report/:userId', async (req, res) => {
  const userId = req.params.userId;
  
  try {
      const [rows] = await dbAsync.query(
          `SELECT S.category_name,
                  COALESCE(SUM(T.transaction_amount), 0) AS total_spent,
                  COUNT(T.transaction_id) AS total_transactions
           FROM SpendCategory S
           LEFT JOIN Transactions T ON T.category_id = S.category_id AND T.user_id = ?
           WHERE S.category_id IN (
               SELECT DISTINCT category_id FROM Transactions WHERE user_id = ?
           )
           GROUP BY S.category_id, S.category_name
           ORDER BY total_spent DESC`,
          [userId, userId]
      );
      
      res.json(rows);
  } catch (err) {
      console.error("Report error:", err);
      res.status(500).json({ error: err.message });
  }
});

// CALCULATOR APIs 
// BUDGET CALCULATOR 
app.post("/budget/savings", async (req, res) => {
    const { userId, categoryId, income, spending } = req.body;
    if (income == null || spending == null)
      return res.status(400).json({ error: "Could not complete calculation." });
    if (typeof income !== "number" || typeof spending !== "number")
      return res.status(400).json({ error: "Could not complete calculation." });
    if (income < 0 || spending < 0)
      return res.status(400).json({ error: "Could not complete calculation." });
  
    const remainingBudget = income - spending;
    if (userId == null || categoryId == null) return res.json({ remainingBudget });
  
    try {
      const [rows] = await dbAsync.query(
        `SELECT monthly_limit, weekly_limit FROM Budget WHERE user_id = ? AND category_id = ?`,
        [userId, categoryId]
      );
      if (rows.length === 0) return res.json({ remainingBudget });
      return res.json({ remainingBudget, monthly_limit: rows[0].monthly_limit, weekly_limit: rows[0].weekly_limit });
    } catch (err) {
      return res.json({ remainingBudget });
    }
  });
// User sync
app.post('/api/user/sync', async (req, res) => {
    const { email, username } = req.body;
    if (!email) return res.status(400).json({ error: "email is required." });
    try {
        await dbAsync.query(
            `INSERT IGNORE INTO Users (username, email, password) VALUES (?, ?, 'localStorage')`,
            [username || email, email]
        );
        const [rows] = await dbAsync.query(`SELECT user_id FROM Users WHERE email = ? LIMIT 1`, [email]);
        return res.json({ userId: rows[0].user_id });
    } catch (err) { return res.status(500).json({ error: "Could not sync user." }); }
});

app.get('/api/user/id', async (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: "email is required." });
    try {
        const [rows] = await dbAsync.query(`SELECT user_id FROM Users WHERE email = ? LIMIT 1`, [email]);
        if (rows.length === 0) return res.status(404).json({ error: "User not found." });
        return res.json({ userId: rows[0].user_id });
    } catch (err) { return res.status(500).json({ error: "Could not fetch user." }); }
});

// SAVINGS 
// Savings extras
app.post("/api/savings/save", async (req, res) => {
    const { userId, goalName, targetAmount, savedAmount } = req.body;
    if (userId == null || goalName == null || targetAmount == null || savedAmount == null)
      return res.status(400).json({ error: "Missing required fields." });
    if (typeof targetAmount !== "number" || typeof savedAmount !== "number")
      return res.status(400).json({ error: "Amounts must be numbers." });
    if (targetAmount < 0 || savedAmount < 0)
      return res.status(400).json({ error: "Amounts cannot be negative." });
  
    const remainingGoal = targetAmount - savedAmount;
    try {
      const [result] = await dbAsync.query(
        `INSERT INTO SavingsGoal (user_id, goal_name, target_amount, saved_amount, remaining_goal, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
        [userId, goalName, targetAmount, savedAmount, remainingGoal]
      );
      return res.json({ message: "Savings goal saved successfully.", goalId: result.insertId, remainingGoal });
    } catch (err) {
      return res.status(500).json({ error: "Could not save savings goal." });
    }
  });

// Calculate savings goal (frontend calls /api/savings/calculate)
app.post("/api/savings/calculate", async (req, res) => {
    const { userId, goalId, targetAmount, savedAmount } = req.body;
    if (targetAmount == null || savedAmount == null)
      return res.status(400).json({ error: "Could not complete calculation." });
    if (typeof targetAmount !== "number" || typeof savedAmount !== "number")
      return res.status(400).json({ error: "Could not complete calculation." });
    if (targetAmount < 0 || savedAmount < 0)
      return res.status(400).json({ error: "Could not complete calculation." });
  
    const remainingGoal = targetAmount - savedAmount;
    if (userId == null || goalId == null) return res.json({ remainingGoal });
  
    try {
      const [rows] = await dbAsync.query(
        `SELECT goal_name, target_amount, saved_amount FROM SavingsGoal WHERE user_id = ? AND goal_id = ?`,
        [userId, goalId]
      );
      if (rows.length === 0) return res.json({ remainingGoal });
      return res.json({ remainingGoal, goal_name: rows[0].goal_name, target_amount: rows[0].target_amount, saved_amount: rows[0].saved_amount });
    } catch (err) {
      return res.json({ remainingGoal });
    }
  });  

// Get latest savings goal for a user (frontend calls /api/savings/latest)
app.get("/api/savings/latest", async (req, res) => {
    const userId = req.query.userId;
    if (userId == null) return res.status(400).json({ error: "userId is required." });
    try {
      const [rows] = await dbAsync.query(
        `SELECT goal_id, goal_name, target_amount, saved_amount, remaining_goal, created_at FROM SavingsGoal WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      if (rows.length === 0) return res.status(404).json({ error: "No savings goals found." });
      return res.json(rows[0]);
    } catch (err) {
      return res.status(500).json({ error: "Could not load latest savings goal." });
    }
  });  

app.get('/api/savings/all', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: "userId is required." });
    try {
        const [rows] = await dbAsync.query(
            `SELECT goal_id, goal_name, target_amount, saved_amount, remaining_goal, created_at FROM SavingsGoal WHERE user_id = ? ORDER BY created_at DESC`,
            [userId]
        );
        if (rows.length === 0) return res.status(404).json({ error: "No savings goals found." });
        return res.json(rows);
    } catch (err) { return res.status(500).json({ error: "Could not load savings goals." }); }
});

app.get('/api/savings/check-name', async (req, res) => {
    const { userId, goalName } = req.query;
    if (!userId || !goalName) return res.status(400).json({ error: "Missing fields." });
    try {
        const [rows] = await dbAsync.query(
            `SELECT goal_id FROM SavingsGoal WHERE user_id = ? AND goal_name = ? LIMIT 1`,
            [userId, goalName]
        );
        if (rows.length === 0) return res.json({ exists: false });
        return res.json({ exists: true, goalId: rows[0].goal_id });
    } catch (err) { return res.status(500).json({ error: "Could not check name." }); }
});

app.put("/api/savings/update/:goalId", async (req, res) => {
    const { goalId } = req.params;
    const { goalName, targetAmount, savedAmount } = req.body;
    if (goalName == null || targetAmount == null || savedAmount == null)
      return res.status(400).json({ error: "Missing required fields." });
    if (typeof targetAmount !== "number" || typeof savedAmount !== "number")
      return res.status(400).json({ error: "Amounts must be numbers." });
    if (targetAmount < 0 || savedAmount < 0)
      return res.status(400).json({ error: "Amounts cannot be negative." });
  
    const remainingGoal = targetAmount - savedAmount;
    try {
      const [result] = await dbAsync.query(
        `UPDATE SavingsGoal SET goal_name = ?, target_amount = ?, saved_amount = ?, remaining_goal = ? WHERE goal_id = ?`,
        [goalName, targetAmount, savedAmount, remainingGoal, goalId]
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: "Goal not found." });
      return res.json({ message: "Goal updated.", goalId: parseInt(goalId), remainingGoal });
    } catch (err) {
      return res.status(500).json({ error: "Could not update savings goal." });
    }
  });  

  app.delete("/api/savings/delete/:goalId", async (req, res) => {
    const { goalId } = req.params;
    try {
      const [result] = await dbAsync.query(`DELETE FROM SavingsGoal WHERE goal_id = ?`, [goalId]);
      if (result.affectedRows === 0) return res.status(404).json({ error: "Goal not found." });
      return res.json({ message: "Goal deleted." });
    } catch (err) {
      return res.status(500).json({ error: "Could not delete goal." });
    }
  });  

// Group Budget Planner
app.get("/api/group/my-groups", async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: "userId is required." });
    try {
      const [rows] = await dbAsync.query(
        `SELECT g.group_id, g.group_name, g.invite_code, g.created_by
         FROM GroupBudget g
         JOIN GroupBudgetMember m ON g.group_id = m.group_id
         WHERE m.user_id = ? ORDER BY g.created_at DESC`,
        [userId]
      );
      return res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: "Could not load groups." });
    }
  });  

  app.post("/api/group/create", async (req, res) => {
    const { userId, groupName } = req.body;
    if (!userId || !groupName) return res.status(400).json({ error: "Missing fields." });
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const [result] = await dbAsync.query(
        `INSERT INTO GroupBudget (group_name, invite_code, created_by) VALUES (?, ?, ?)`,
        [groupName, inviteCode, userId]
      );
      const groupId = result.insertId;
      await dbAsync.query(`INSERT INTO GroupBudgetMember (group_id, user_id) VALUES (?, ?)`, [groupId, userId]);
      return res.json({ groupId, groupName, inviteCode });
    } catch (err) {
      return res.status(500).json({ error: "Could not create plan." });
    }
  });
  
  app.post("/api/group/join", async (req, res) => {
    const { userId, inviteCode } = req.body;
    if (!userId || !inviteCode) return res.status(400).json({ error: "Missing fields." });
    try {
      const [groups] = await dbAsync.query(
        `SELECT * FROM GroupBudget WHERE invite_code = ? LIMIT 1`,
        [inviteCode.toUpperCase()]
      );
      if (groups.length === 0) return res.status(404).json({ error: "Invalid invite code." });
      const group = groups[0];
      await dbAsync.query(
        `INSERT IGNORE INTO GroupBudgetMember (group_id, user_id) VALUES (?, ?)`,
        [group.group_id, userId]
      );
      return res.json({ groupId: group.group_id, groupName: group.group_name, inviteCode: group.invite_code, createdBy: group.created_by });
    } catch (err) {
      return res.status(500).json({ error: "Could not join plan." });
    }
  });
  
  app.put("/api/group/update-member", async (req, res) => {
    const { groupId, userId, income, spending } = req.body;
    if (!groupId || !userId) return res.status(400).json({ error: "Missing fields." });
    try {
      await dbAsync.query(
        `UPDATE GroupBudgetMember SET income = ?, spending = ? WHERE group_id = ? AND user_id = ?`,
        [income || 0, spending || 0, groupId, userId]
      );
      return res.json({ message: "Numbers updated." });
    } catch (err) {
      return res.status(500).json({ error: "Could not update numbers." });
    }
  });
  
  app.put("/api/group/set-goal", async (req, res) => {
    const { groupId, goalName, groupGoal } = req.body;
    if (!groupId) return res.status(400).json({ error: "Missing fields." });
    try {
      await dbAsync.query(
        `UPDATE GroupBudget SET goal_name = ?, group_goal = ? WHERE group_id = ?`,
        [goalName || "", groupGoal || 0, groupId]
      );
      return res.json({ message: "Goal updated." });
    } catch (err) {
      return res.status(500).json({ error: "Could not set goal." });
    }
  });
  
  app.get("/api/group/plan/:groupId", async (req, res) => {
    const { groupId } = req.params;
    try {
      const [members] = await dbAsync.query(
        `SELECT u.user_id, u.username, m.income, m.spending,
                COALESCE((SELECT SUM(amount) FROM GroupContribution WHERE group_id = ? AND user_id = u.user_id), 0) AS total_contributed
         FROM GroupBudgetMember m
         JOIN Users u ON m.user_id = u.user_id
         WHERE m.group_id = ?`,
        [groupId, groupId]
      );
      const [groups] = await dbAsync.query(
        `SELECT goal_name, group_goal FROM GroupBudget WHERE group_id = ? LIMIT 1`,
        [groupId]
      );
      const group = groups[0] || {};
      return res.json({ members, goal_name: group.goal_name, group_goal: group.group_goal });
    } catch (err) {
      return res.status(500).json({ error: "Could not load plan." });
    }
  });
  
  app.delete("/api/group/leave", async (req, res) => {
    const { groupId, userId } = req.body;
    if (!groupId || !userId) return res.status(400).json({ error: "Missing fields." });
    try {
      await dbAsync.query(`DELETE FROM GroupBudgetMember WHERE group_id = ? AND user_id = ?`, [groupId, userId]);
      return res.json({ message: "Left group." });
    } catch (err) {
      return res.status(500).json({ error: "Could not leave group." });
    }
  });
  
  app.delete("/api/group/remove-member", async (req, res) => {
    const { groupId, userId } = req.body;
    if (!groupId || !userId) return res.status(400).json({ error: "Missing fields." });
    try {
      await dbAsync.query(`DELETE FROM GroupBudgetMember WHERE group_id = ? AND user_id = ?`, [groupId, userId]);
      return res.json({ message: "Member removed." });
    } catch (err) {
      return res.status(500).json({ error: "Could not remove member." });
    }
  });
  
  // GROUP CONTRIBUTIONS
  
  // Add a contribution toward the group goal
  app.post("/api/group/contribute", async (req, res) => {
    const { groupId, userId, amount, note } = req.body;
    if (!groupId || !userId || amount == null)
      return res.status(400).json({ error: "Missing fields." });
    if (typeof amount !== "number" || amount <= 0)
      return res.status(400).json({ error: "Amount must be a positive number." });
    try {
      const [result] = await dbAsync.query(
        `INSERT INTO GroupContribution (group_id, user_id, amount, note) VALUES (?, ?, ?, ?)`,
        [groupId, userId, amount, note || null]
      );
      // Return new total for this user
      const [totals] = await dbAsync.query(
        `SELECT SUM(amount) AS total FROM GroupContribution WHERE group_id = ? AND user_id = ?`,
        [groupId, userId]
      );
      return res.json({ message: "Contribution added.", contributionId: result.insertId, total: totals[0].total });
    } catch (err) {
      return res.status(500).json({ error: "Could not add contribution." });
    }
  });
  
  // Get all contributions for a group
  app.get("/api/group/contributions/:groupId", async (req, res) => {
    const { groupId } = req.params;
    try {
      const [rows] = await dbAsync.query(
        `SELECT c.contribution_id, u.username, c.amount, c.note, c.created_at
         FROM GroupContribution c
         JOIN Users u ON c.user_id = u.user_id
         WHERE c.group_id = ?
         ORDER BY c.created_at DESC`,
        [groupId]
      );
      return res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: "Could not load contributions." });
    }
  });
  
  // Delete a contribution
  app.delete("/api/group/contribution/:contributionId", async (req, res) => {
    const { contributionId } = req.params;
    try {
      const [result] = await dbAsync.query(
        `DELETE FROM GroupContribution WHERE contribution_id = ?`,
        [contributionId]
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: "Contribution not found." });
      return res.json({ message: "Contribution deleted." });
    } catch (err) {
      return res.status(500).json({ error: "Could not delete contribution." });
    }
  });
  

/* ================= START SERVER ================= */
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});

app.get('/test', (req, res) => {
    res.json({ message: "Server is working!" });
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

/* ================= AUTO PRICE ALERT POLLING ================= */

setInterval(async () => {
    try {
        const [products] = await dbAsync.query(
            `SELECT P.product_id, P.product_name, P.current_price, 
                    P.target_price, P.last_alert_sent, U.email
             FROM Product P
             JOIN Users U ON P.user_id = U.user_id`
        );

        for (let product of products) {
            const currentPrice = Number(product.current_price);
            const targetPrice = Number(product.target_price);

            const lastSent = product.last_alert_sent 
                ? new Date(product.last_alert_sent) 
                : null;

            const now = new Date();
            const COOLDOWN = Infinity; // send only once per price drop

            if (!isNaN(targetPrice) && currentPrice <= targetPrice) {

                // only send if never sent OR cooldown passed
                if (!lastSent || (now - lastSent) > COOLDOWN) {

                    console.log(`🔥 Sending email for ${product.product_name}: $${currentPrice} (target $${targetPrice})`);

                    try {
                        await sendPriceAlert(
                            product.email,
                            product.product_name,
                            currentPrice,
                            targetPrice
                        );

                        await dbAsync.query(
                            'UPDATE Product SET last_alert_sent = NOW() WHERE product_id = ?',
                            [product.product_id]
                        );

                    } catch (err) {
                        console.error("Failed to send email:", err);
                    }
                }
            }

            // if price goes back up/normal reset
            if (!isNaN(targetPrice) && currentPrice > targetPrice && lastSent) {
                await dbAsync.query(
                    'UPDATE Product SET last_alert_sent = NULL WHERE product_id = ?',
                    [product.product_id]
                );
            }
        }

    } catch (err) {
        console.error("Auto price alert error:", err);
    }
}, 60 * 1000);

const mysql = require('mysql2');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: process.env.DB_PASSWORD || 'Santosia1618$',
  database: 'BudgetApp',
  port: 3306
});

db.connect(err => {
  if (err) {
    console.error('❌ DB connection failed:', err);
    process.exit(1);
  }
  console.log('✅ Connected to MySQL Database (BudgetApp)');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/budget/calculate', (req, res) => {
  const { userId, categoryId, income, spending } = req.body;
  
  if (income == null || spending == null) {
    return res.status(400).json({ error: 'Could not complete calculation.' });
  }
  if (typeof income !== 'number' || typeof spending !== 'number') {
    return res.status(400).json({ error: 'Could not complete calculation.' });
  }
  if (income < 0 || spending < 0) {
    return res.status(400).json({ error: 'Could not complete calculation.' });
  }
  
  const remainingBudget = income - spending;
  
  if (userId == null || categoryId == null) {
    return res.json({ remainingBudget });
  }
  
  const query = 'SELECT monthly_limit, weekly_limit FROM Budget WHERE user_id = ? AND category_id = ?';
  db.query(query, [userId, categoryId], (err, rows) => {
    if (err || rows.length === 0) {
      return res.json({ remainingBudget });
    }
    res.json({
      remainingBudget,
      monthly_limit: rows[0].monthly_limit,
      weekly_limit: rows[0].weekly_limit
    });
  });
});

app.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }
  
  const query = 'INSERT INTO Users (username, email, password) VALUES (?, ?, ?)';
  db.query(query, [username, email, password], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Email already exists' });
      }
      return res.status(500).json({ error: 'Database error' });
    }
    res.status(201).json({ message: 'User registered', userId: result.insertId });
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  const query = 'SELECT * FROM Users WHERE email = ? AND password = ?';
  db.query(query, [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ message: 'Login successful', user: results[0] });
  });
});

app.post('/resetPassword', (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password required' });
  }
  
  const query = 'UPDATE Users SET password = ? WHERE email = ?';
  db.query(query, [newPassword, email], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Password reset successfully' });
  });
});

app.post('/verifyUser', (req, res) => {
  const { email, username } = req.body;
  const query = 'SELECT user_id FROM Users WHERE email = ? AND username = ?';
  db.query(query, [email, username], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(401).json({ error: 'User not found' });
    res.json({ message: 'User verified', verified: true });
  });
});
// Check if email exists (for password reset)
app.post('/checkEmail', (req, res) => {
  const { email } = req.body;
  const query = 'SELECT user_id FROM Users WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'Email not found' });
    res.json({ message: 'Email exists', exists: true });
  });
});


app.get('/budgets/:userId', (req, res) => {
  const { userId } = req.params;
  const query = 'SELECT * FROM Budget WHERE user_id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

app.post('/createBudget', (req, res) => {
  const { budget_name, monthly_limit, weekly_limit, user_id, category_id, start_date, end_date } = req.body;
  
  if (!budget_name || !monthly_limit || !user_id || !category_id) {
    return res.status(400).json({ error: 'Required fields missing' });
  }
  
  const remaining_amount = monthly_limit;
  const weeklyLimitCalc = weekly_limit || monthly_limit / 4;
  
  const query = `INSERT INTO Budget (budget_name, monthly_limit, weekly_limit, user_id, category_id, start_date, end_date, remaining_amount, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
  
  db.query(query, [budget_name, monthly_limit, weeklyLimitCalc, user_id, category_id, start_date, end_date, remaining_amount], (err, result) => {
    if (err) {
      console.error('Create budget error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.status(201).json({ 
      message: 'Budget created', 
      budgetId: result.insertId, 
      remaining_amount: remaining_amount 
    });
  });
});

app.post('/addExpense', (req, res) => {
  const { budget_id, expense_amount, description } = req.body;
  if (!budget_id || !expense_amount) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  
  const findBudget = 'SELECT user_id, category_id, remaining_amount FROM Budget WHERE budget_id = ?';
  db.query(findBudget, [budget_id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'Budget not found' });
    
    const { user_id, category_id, remaining_amount } = results[0];
    const newRemaining = remaining_amount - expense_amount;
    
    const insertTransaction = 'INSERT INTO Transactions (transaction_amount, transaction_date, user_id, category_id) VALUES (?, NOW(), ?, ?)';
    
    db.query(insertTransaction, [expense_amount, user_id, category_id], (err2) => {
      if (err2) return res.status(500).json({ error: 'Database error' });
      
      const updateBudget = 'UPDATE Budget SET remaining_amount = ? WHERE budget_id = ?';
      db.query(updateBudget, [newRemaining, budget_id], (err3) => {
        if (err3) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Expense added successfully', remaining_amount: newRemaining });
      });
    });
  });
});

app.get('/transactions/:userId', (req, res) => {
  const { userId } = req.params;
  const query = 'SELECT * FROM Transactions WHERE user_id = ? ORDER BY transaction_date DESC';
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

app.delete('/transaction/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM Transactions WHERE transaction_id = ?';
  db.query(query, [id], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ message: 'Transaction deleted' });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}/health`);
  console.log(`✅ All Features Ready`);
});
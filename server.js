const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const port = 3000;

// Built-in JSON parser
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, 'public')));

// DATABASE CONNECTION

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'yairlopez1819!', 
  database: 'BudgetApp'
});

db.connect(err => {
  if (err) {
    console.error('DB connection failed:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL Database');
});

// AUTH ROUTES

// Register
app.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields required' });

  const query = 'INSERT INTO Users (username, email, password) VALUES (?, ?, ?)';

  db.query(query, [username, email, password], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(409).json({ error: 'Email already exists' });
      return res.status(500).json({ error: 'Database error' });
    }
    res.status(201).json({ message: 'User registered', userId: result.insertId });
  });
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  const query = 'SELECT * FROM Users WHERE email = ? AND password = ?';

  db.query(query, [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0)
      return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ message: 'Login successful', user: results[0] });
  });
});


// BUDGET ROUTES

// Create Budget
app.post('/createBudget', (req, res) => {
  const {
    budget_name,
    monthly_limit,
    weekly_limit,
    user_id,
    category_id,
    start_date,
    end_date
  } = req.body;

  if (!budget_name || !monthly_limit || !user_id)
    return res.status(400).json({ error: 'Missing required fields' });

  if (monthly_limit <= 0)
    return res.status(400).json({ error: 'Monthly limit must be greater than 0' });

  const query = `
    INSERT INTO Budget
    (budget_name, monthly_limit, weekly_limit, user_id, category_id, start_date, end_date, remaining_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [
      budget_name,
      monthly_limit,
      weekly_limit || 0,
      user_id,
      category_id || 1,
      start_date,
      end_date,
      monthly_limit
    ],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      res.status(201).json({
        message: 'Budget created',
        budgetId: result.insertId
      });
    }
  );
});

// Get User Budgets
app.get('/budgets/:userId', (req, res) => {
  const { userId } = req.params;

  db.query(
    'SELECT * FROM Budget WHERE user_id = ?',
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(results);
    }
  );
});

// Delete Budget 
app.delete('/budget/:id', (req, res) => {
  const { id } = req.params;

  db.query(
    'DELETE FROM Budget WHERE budget_id = ?',
    [id],
    (err) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ message: 'Budget deleted' });
    }
  );
});


// TRANSACTION ROUTES

// Add Expense
app.post('/addExpense', (req, res) => {
  const { budget_id, expense_amount, description } = req.body;

  if (!budget_id || !expense_amount || expense_amount <= 0)
    return res.status(400).json({ error: 'Invalid input' });

  const findBudget = `
    SELECT remaining_amount, user_id, category_id, monthly_limit
    FROM Budget WHERE budget_id = ?
  `;

  db.query(findBudget, [budget_id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0)
      return res.status(404).json({ error: 'Budget not found' });

    const budget = results[0];

    if (expense_amount > budget.remaining_amount)
      return res.status(400).json({ error: 'Budget exceeded' });

    const newRemaining = budget.remaining_amount - expense_amount;

    const insertTransaction = `
      INSERT INTO Transactions
      (transaction_amount, transaction_date, user_id, category_id)
      VALUES (?, NOW(), ?, ?)
    `;

    db.query(
      insertTransaction,
      [expense_amount, budget.user_id, budget.category_id],
      (err2) => {
        if (err2) return res.status(500).json({ error: 'Database error' });

        db.query(
          'UPDATE Budget SET remaining_amount = ? WHERE budget_id = ?',
          [newRemaining, budget_id],
          (err3) => {
            if (err3) return res.status(500).json({ error: 'Database error' });

            res.json({
              message: 'Expense added',
              remaining_amount: newRemaining
            });
          }
        );
      }
    );
  });
});

// Get Transactions
app.get('/transactions/:userId', (req, res) => {
  const { userId } = req.params;

  db.query(
    'SELECT * FROM Transactions WHERE user_id = ?',
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(results);
    }
  );
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'yairBudget.html'));
});

//START SERVER
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

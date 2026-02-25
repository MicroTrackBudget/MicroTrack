const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(bodyParser.json());

// DATABASE CONNECTION 
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'yairlopez1819!', // MySQL password
  database: 'BudgetApp'
});

db.connect(err => {
  if (err) {
    console.error('DB connection failed:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL Database');
});

//  ROUTES 

// POST /register
app.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });

  const query = 'INSERT INTO Users (username, email, password) VALUES (?, ?, ?)';
  db.query(query, [username, email, password], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already exists' });
      return res.status(500).json({ error: 'Database error' });
    }
    res.status(201).json({ message: 'User registered', userId: result.insertId });
  });
});

// POST /login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const query = 'SELECT * FROM Users WHERE email = ? AND password = ?';
  db.query(query, [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ message: 'Login successful', user: results[0] });
  });
});

// POST /createBudget
app.post('/createBudget', (req, res) => {
  const { budget_name, monthly_limit, weekly_limit, user_id, category_id, start_date, end_date } = req.body;
  if (!budget_name || !monthly_limit || !weekly_limit || !user_id || !category_id || !start_date || !end_date)
    return res.status(400).json({ error: 'All fields required' });

  if (monthly_limit <= 0) return res.status(400).json({ error: 'Monthly limit must be greater than 0' });

  const query = `
    INSERT INTO Budget 
    (budget_name, monthly_limit, weekly_limit, user_id, category_id, start_date, end_date, remaining_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [budget_name, monthly_limit, weekly_limit, user_id, category_id, start_date, end_date, monthly_limit], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.status(201).json({ message: 'Budget created', budgetId: result.insertId, remaining_amount: monthly_limit });
  });
});

// POST /addExpense
app.post('/addExpense', (req, res) => {
  const { budget_id, expense_amount, description } = req.body;
  if (!budget_id || !expense_amount || expense_amount <= 0) return res.status(400).json({ error: 'Invalid input' });

  // 1. Find budget
  const findBudget = 'SELECT remaining_amount, user_id, category_id FROM Budget WHERE budget_id = ?';
  db.query(findBudget, [budget_id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'Budget not found' });

    const { remaining_amount, user_id, category_id } = results[0];
    if (expense_amount > remaining_amount) return res.status(400).json({ error: 'Budget exceeded' });

    const newRemaining = remaining_amount - expense_amount;

    // 2. Insert transaction
    const insertTransaction = 'INSERT INTO Transactions (transaction_amount, transaction_date, user_id, category_id) VALUES (?, NOW(), ?, ?)';
    db.query(insertTransaction, [expense_amount, user_id, category_id], (err2) => {
      if (err2) return res.status(500).json({ error: 'Database error' });

      // 3. Update remaining_amount
      const updateBudget = 'UPDATE Budget SET remaining_amount = ? WHERE budget_id = ?';
      db.query(updateBudget, [newRemaining, budget_id], (err3) => {
        if (err3) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Expense added', remaining_amount: newRemaining });
      });
    });
  });
});

// GET /budgets/:userId
app.get('/budgets/:userId', (req, res) => {
  const { userId } = req.params;
  const query = 'SELECT * FROM Budget WHERE user_id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// GET /transactions/:userId
app.get('/transactions/:userId', (req, res) => {
  const { userId } = req.params;
  const query = 'SELECT * FROM Transactions WHERE user_id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// PUT /transaction/:id
app.put('/transaction/:id', (req, res) => {
  const { id } = req.params;
  const { transaction_amount, transaction_date, category_id } = req.body;
  const query = 'UPDATE Transactions SET transaction_amount = ?, transaction_date = ?, category_id = ? WHERE transaction_id = ?';
  db.query(query, [transaction_amount, transaction_date, category_id, id], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ message: 'Transaction updated' });
  });
});

// DELETE /transaction/:id
app.delete('/transaction/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM Transactions WHERE transaction_id = ?';
  db.query(query, [id], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ message: 'Transaction deleted' });
  });
});

app.get('/', (req, res) => {
  res.send('Welcome to the Budget App API');
});

// START SERVER
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
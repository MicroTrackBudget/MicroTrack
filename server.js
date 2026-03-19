const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.json());
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

// REGISTER USER

app.post('/register', (req,res)=>{

  const {username,email,password} = req.body;

  if(!username || !email || !password)
    return res.status(400).json({error:"All fields required"});

  const query = `
  INSERT INTO Users (username,email,password)
  VALUES (?,?,?)
  `;

  db.query(query,[username,email,password],(err,result)=>{

    if(err){

      if(err.code === 'ER_DUP_ENTRY')
        return res.status(409).json({error:"Email already exists"});

      return res.status(500).json({error:"Database error"});
    }

    res.json({
      message:"User registered",
      userId: result.insertId
    });

  });
});


// LOGIN

app.post('/login',(req,res)=>{

  const {email,password} = req.body;

  if(!email || !password)
    return res.status(400).json({error:"Missing fields"});

  const query = `
  SELECT * FROM Users
  WHERE email=? AND password=?
  `;

  db.query(query,[email,password],(err,results)=>{

    if(err) return res.status(500).json({error:"Database error"});

    if(results.length===0)
      return res.status(401).json({error:"Invalid login"});

    res.json({
      message:"Login successful",
      user: results[0]
    });

  });
});

// CREATE BUDGET

app.post('/createBudget',(req,res)=>{

  const {monthly_limit,weekly_limit,user_id,category_id} = req.body;

  if(monthly_limit === undefined || user_id === undefined || category_id === undefined)
    return res.status(400).json({error:"Missing required fields"});

  const query = `
  INSERT INTO Budget
  (monthly_limit,weekly_limit,user_id,category_id)
  VALUES (?,?,?,?)
  `;

  db.query(query,
    [monthly_limit,weekly_limit || 0,user_id,category_id],
    (err,result)=>{

      if(err) return res.status(500).json({error:"Database error"});

      res.json({
        message:"Budget created",
        budgetId: result.insertId
      });

    }
  );
});

//Categories
app.post("/getOrCreateCategory", (req, res) => {
  
  const { category_name } = req.body;

  // Check if exists
  db.query(
    "SELECT category_id FROM SpendCategory WHERE category_name = ?",
    [category_name], (err, results) => {
      if (err) return res.status(500).json({ error: "DB error" });
      if (results.length > 0) {
        return res.json({ category_id: results[0].category_id });
      }
      
      // Create it
      db.query( 
        "INSERT INTO SpendCategory (category_name) VALUES (?)",
        [category_name], (err, result) => {
          if (err) return res.status(500).json({ error: "Insert error" });
          res.json({ category_id: result.insertId });
        }
      );
    }
  );
});

// GET USER BUDGETS

app.get('/budgets/:userId',(req,res)=>{

  const {userId} = req.params;

  const query = `
  SELECT
    B.budget_id,
    S.category_name,
    B.monthly_limit,
    IFNULL(SUM(T.transaction_amount),0) AS spent
  FROM Budget B
  JOIN SpendCategory S
    ON B.category_id = S.category_id
  LEFT JOIN Transactions T
    ON T.category_id = B.category_id
    AND T.user_id = B.user_id
  WHERE B.user_id = ?
  GROUP BY B.budget_id
  `;

  db.query(query,[userId],(err,results)=>{

    if(err) return res.status(500).json({error:"Database error"});

    res.json(results);

  });
});

// DELETE BUDGET

app.delete('/budget/:id',(req,res)=>{

  const {id} = req.params;

  db.query(
    `DELETE FROM Budget WHERE budget_id=?`,
    [id],err => {
      
      if(err) return res.status(500).json({error:"Database error"});

      res.json({message:"Budget deleted"});

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


// START SERVER

app.listen(port,()=>{
  console.log(`Server running at http://localhost:${port}`);
});
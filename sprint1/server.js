const mysql = require("mysql2/promise");
const express = require("express");
const app = express();
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "PASSWORD",
  database: "BudgetApp",
  port: 3306,
});

app.use(express.json());

// Test route
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Input calculation route
app.post("/budget/calculate", async (req, res) => {
  const { userId, categoryId, income, spending } = req.body;

  if (income == null || spending == null) {
    return res.status(400).json({ error: "Could not complete calculation." });
  }

  if (typeof income !== "number" || typeof spending !== "number") {
    return res.status(400).json({ error: "Could not complete calculation." });
  }

  if (income < 0 || spending < 0) {
    return res.status(400).json({ error: "Could not complete calculation." });
  }

  const remainingBudget = income - spending;

  // If DB is not ready yet, return calculation only
  if (userId == null || categoryId == null) {
    return res.json({ remainingBudget });
  }

  try {
    const [rows] = await pool.query(
      `SELECT monthly_limit, weekly_limit
       FROM Budget
       WHERE user_id = ? AND category_id = ?`,
      [userId, categoryId]
    );

    if (rows.length === 0) {
      return res.json({ remainingBudget });
    }

    return res.json({
      remainingBudget,
      monthly_limit: rows[0].monthly_limit,
      weekly_limit: rows[0].weekly_limit,
    });
  } catch (err) {
    return res.json({ remainingBudget });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000: http://localhost:3000/health");
});
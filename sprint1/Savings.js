const mysql = require("mysql2/promise");
const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());

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

// Calculate remaining savings goal
app.post("/api/savings/calculate", async (req, res) => {
  const { userId, goalId, targetAmount, savedAmount } = req.body;

  if (targetAmount == null || savedAmount == null) {
    return res.status(400).json({ error: "Could not complete calculation." });
  }

  if (typeof targetAmount !== "number" || typeof savedAmount !== "number") {
    return res.status(400).json({ error: "Could not complete calculation." });
  }

  if (targetAmount < 0 || savedAmount < 0) {
    return res.status(400).json({ error: "Could not complete calculation." });
  }

  const remainingGoal = targetAmount - savedAmount;

  // If DB values are not provided yet, just return the calculation
  if (userId == null || goalId == null) {
    return res.json({ remainingGoal });
  }

  try {
    const [rows] = await pool.query(
      `SELECT goal_name, target_amount, saved_amount
       FROM SavingsGoal
       WHERE user_id = ? AND goal_id = ?`,
      [userId, goalId]
    );

    if (rows.length === 0) {
      return res.json({ remainingGoal });
    }

    return res.json({
      remainingGoal,
      goal_name: rows[0].goal_name,
      target_amount: rows[0].target_amount,
      saved_amount: rows[0].saved_amount,
    });
  } catch (err) {
    return res.json({ remainingGoal });
  }
});

// Save a savings goal entry
app.post("/api/savings/save", async (req, res) => {
  const { userId, goalName, targetAmount, savedAmount } = req.body;

  if (
    userId == null ||
    goalName == null ||
    targetAmount == null ||
    savedAmount == null
  ) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  if (typeof targetAmount !== "number" || typeof savedAmount !== "number") {
    return res.status(400).json({ error: "Amounts must be numbers." });
  }

  if (targetAmount < 0 || savedAmount < 0) {
    return res.status(400).json({ error: "Amounts cannot be negative." });
  }

  const remainingGoal = targetAmount - savedAmount;

  try {
    const [result] = await pool.query(
      `INSERT INTO SavingsGoal
       (user_id, goal_name, target_amount, saved_amount, remaining_goal, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [userId, goalName, targetAmount, savedAmount, remainingGoal]
    );

    return res.json({
      message: "Savings goal saved successfully.",
      goalId: result.insertId,
      remainingGoal,
    });
  } catch (err) {
    return res.status(500).json({ error: "Could not save savings goal." });
  }
});

// Get latest saved savings goal
app.get("/api/savings/latest", async (req, res) => {
  const userId = req.query.userId;

  if (userId == null) {
    return res.status(400).json({ error: "userId is required." });
  }

  try {
    const [rows] = await pool.query(
      `SELECT goal_id, goal_name, target_amount, saved_amount, remaining_goal, created_at
       FROM SavingsGoal
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "No savings goals found." });
    }

    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "Could not load latest savings goal." });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000: http://localhost:3000/health");
});
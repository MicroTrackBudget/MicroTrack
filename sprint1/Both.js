const mysql = require("mysql2/promise");
const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());
app.use(express.json());

require("dotenv").config({ path: __dirname + "/.env" });

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     3306,
});

// HEALTH 

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/test",   (req, res) => res.json({ status: "ok" }));

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
    const [rows] = await pool.query(
      `SELECT monthly_limit, weekly_limit FROM Budget WHERE user_id = ? AND category_id = ?`,
      [userId, categoryId]
    );
    if (rows.length === 0) return res.json({ remainingBudget });
    return res.json({ remainingBudget, monthly_limit: rows[0].monthly_limit, weekly_limit: rows[0].weekly_limit });
  } catch (err) {
    return res.json({ remainingBudget });
  }
});

// SAVINGS GOALS 

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
    const [rows] = await pool.query(
      `SELECT goal_name, target_amount, saved_amount FROM SavingsGoal WHERE user_id = ? AND goal_id = ?`,
      [userId, goalId]
    );
    if (rows.length === 0) return res.json({ remainingGoal });
    return res.json({ remainingGoal, goal_name: rows[0].goal_name, target_amount: rows[0].target_amount, saved_amount: rows[0].saved_amount });
  } catch (err) {
    return res.json({ remainingGoal });
  }
});

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
    const [result] = await pool.query(
      `INSERT INTO SavingsGoal (user_id, goal_name, target_amount, saved_amount, remaining_goal, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
      [userId, goalName, targetAmount, savedAmount, remainingGoal]
    );
    return res.json({ message: "Savings goal saved successfully.", goalId: result.insertId, remainingGoal });
  } catch (err) {
    return res.status(500).json({ error: "Could not save savings goal." });
  }
});

app.get("/api/savings/latest", async (req, res) => {
  const userId = req.query.userId;
  if (userId == null) return res.status(400).json({ error: "userId is required." });
  try {
    const [rows] = await pool.query(
      `SELECT goal_id, goal_name, target_amount, saved_amount, remaining_goal, created_at FROM SavingsGoal WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No savings goals found." });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "Could not load latest savings goal." });
  }
});

app.get("/api/savings/all", async (req, res) => {
  const userId = req.query.userId;
  if (userId == null) return res.status(400).json({ error: "userId is required." });
  try {
    const [rows] = await pool.query(
      `SELECT goal_id, goal_name, target_amount, saved_amount, remaining_goal, created_at FROM SavingsGoal WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No savings goals found." });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Could not load savings goals." });
  }
});

app.get("/api/savings/check-name", async (req, res) => {
  const { userId, goalName } = req.query;
  if (!userId || !goalName) return res.status(400).json({ error: "Missing fields." });
  try {
    const [rows] = await pool.query(
      `SELECT goal_id FROM SavingsGoal WHERE user_id = ? AND goal_name = ? LIMIT 1`,
      [userId, goalName]
    );
    if (rows.length === 0) return res.json({ exists: false });
    return res.json({ exists: true, goalId: rows[0].goal_id });
  } catch (err) {
    return res.status(500).json({ error: "Could not check name." });
  }
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
    const [result] = await pool.query(
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
    const [result] = await pool.query(`DELETE FROM SavingsGoal WHERE goal_id = ?`, [goalId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Goal not found." });
    return res.json({ message: "Goal deleted." });
  } catch (err) {
    return res.status(500).json({ error: "Could not delete goal." });
  }
});

// USERS

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: "All fields are required." });
  try {
    const [result] = await pool.query(
      `INSERT INTO Users (username, email, password) VALUES (?, ?, ?)`,
      [username, email, password]
    );
    return res.json({ message: "Account created.", userId: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(400).json({ error: "An account with this email already exists." });
    return res.status(500).json({ error: "Could not create account." });
  }
});

app.get("/api/user/id", async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "email is required." });
  try {
    const [rows] = await pool.query(`SELECT user_id FROM Users WHERE email = ? LIMIT 1`, [email]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found." });
    return res.json({ userId: rows[0].user_id });
  } catch (err) {
    return res.status(500).json({ error: "Could not fetch user." });
  }
});

app.post("/api/user/sync", async (req, res) => {
  const { email, username } = req.body;
  if (!email) return res.status(400).json({ error: "email is required." });
  try {
    await pool.query(
      `INSERT IGNORE INTO Users (username, email, password) VALUES (?, ?, 'localStorage')`,
      [username || email, email]
    );
    const [rows] = await pool.query(`SELECT user_id FROM Users WHERE email = ? LIMIT 1`, [email]);
    return res.json({ userId: rows[0].user_id });
  } catch (err) {
    return res.status(500).json({ error: "Could not sync user." });
  }
});

// GROUP BUDGET PLANNER

app.get("/api/group/my-groups", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "userId is required." });
  try {
    const [rows] = await pool.query(
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
    const [result] = await pool.query(
      `INSERT INTO GroupBudget (group_name, invite_code, created_by) VALUES (?, ?, ?)`,
      [groupName, inviteCode, userId]
    );
    const groupId = result.insertId;
    await pool.query(`INSERT INTO GroupBudgetMember (group_id, user_id) VALUES (?, ?)`, [groupId, userId]);
    return res.json({ groupId, groupName, inviteCode });
  } catch (err) {
    return res.status(500).json({ error: "Could not create plan." });
  }
});

app.post("/api/group/join", async (req, res) => {
  const { userId, inviteCode } = req.body;
  if (!userId || !inviteCode) return res.status(400).json({ error: "Missing fields." });
  try {
    const [groups] = await pool.query(
      `SELECT * FROM GroupBudget WHERE invite_code = ? LIMIT 1`,
      [inviteCode.toUpperCase()]
    );
    if (groups.length === 0) return res.status(404).json({ error: "Invalid invite code." });
    const group = groups[0];
    await pool.query(
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
    await pool.query(
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
    await pool.query(
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
    const [members] = await pool.query(
      `SELECT u.user_id, u.username, m.income, m.spending,
              COALESCE((SELECT SUM(amount) FROM GroupContribution WHERE group_id = ? AND user_id = u.user_id), 0) AS total_contributed
       FROM GroupBudgetMember m
       JOIN Users u ON m.user_id = u.user_id
       WHERE m.group_id = ?`,
      [groupId, groupId]
    );
    const [groups] = await pool.query(
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
    await pool.query(`DELETE FROM GroupBudgetMember WHERE group_id = ? AND user_id = ?`, [groupId, userId]);
    return res.json({ message: "Left group." });
  } catch (err) {
    return res.status(500).json({ error: "Could not leave group." });
  }
});

app.delete("/api/group/remove-member", async (req, res) => {
  const { groupId, userId } = req.body;
  if (!groupId || !userId) return res.status(400).json({ error: "Missing fields." });
  try {
    await pool.query(`DELETE FROM GroupBudgetMember WHERE group_id = ? AND user_id = ?`, [groupId, userId]);
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
    const [result] = await pool.query(
      `INSERT INTO GroupContribution (group_id, user_id, amount, note) VALUES (?, ?, ?, ?)`,
      [groupId, userId, amount, note || null]
    );
    // Return new total for this user
    const [totals] = await pool.query(
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
    const [rows] = await pool.query(
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
    const [result] = await pool.query(
      `DELETE FROM GroupContribution WHERE contribution_id = ?`,
      [contributionId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Contribution not found." });
    return res.json({ message: "Contribution deleted." });
  } catch (err) {
    return res.status(500).json({ error: "Could not delete contribution." });
  }
});

// START

app.listen(3000, () => {
  console.log("Server running on port 3000: http://localhost:3000/health");
});
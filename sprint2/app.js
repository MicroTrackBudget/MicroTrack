// app.js
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

// Create Express app
const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public')); // serve HTML, CSS, JS if in 'public' folder

// Create MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'DataRojo1962?!',
    database: 'BudgetApp'
});

db.connect((err) => {
    if (err) {
        console.error('❌ MySQL connection failed:', err.message);
        return;
    }
    console.log('✅ Connected to MySQL database!');
});

// --- PriceTracker API routes ---

// Get all tracked products
app.get('/api/products', (req, res) => {
    db.query('SELECT * FROM Product', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Add a new product
app.post('/api/products', (req, res) => {
    const { product_name, store_location } = req.body;
    db.query(
        'INSERT INTO Product (product_name, store_location) VALUES (?, ?)',
        [product_name, store_location],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, productId: result.insertId });
        }
    );
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
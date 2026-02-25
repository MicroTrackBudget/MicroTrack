const pool = require('./db');

async function testConnection() {
  try {
    console.log('⏳ Attempting to connect...');
    const [rows] = await pool.query('SELECT DATABASE() AS db');
    console.log('✅ Connected successfully to MySQL database:', rows[0].db);
  } catch (err) {
    console.error('❌ Connection failed!');
    console.error(err);
  } finally {
    console.log('Closing connection...');
    await pool.end();
  }
}

testConnection();
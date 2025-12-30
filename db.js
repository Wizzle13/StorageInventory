require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

const dbName = process.env.DB_NAME || 'storageinventory';

let pool;

async function initializeDatabase() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.end();

    pool = mysql.createPool({
      ...dbConfig,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('Successfully connected to the database.');
    return pool;
  } catch (error) {
    console.error('Error during database initialization:', error);
    process.exit(1); // Exit the process if the database cannot be initialized
  }
}

module.exports = initializeDatabase();
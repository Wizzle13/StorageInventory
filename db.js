require('dotenv').config();
const mysql = require('mysql2');

// Create a connection to the database
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Connect to the database
connection.connect(error => {
  if (error) {
    console.error('Error connecting to the database: ', error);
    return;
  }
  console.log('Successfully connected to the database.');
});

module.exports = connection;
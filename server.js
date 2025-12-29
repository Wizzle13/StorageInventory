require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.SERVER_PORT || 3000; // Use port from .env or default to 3000

app.use(cors());
app.use(express.json());

// Endpoint for user login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error('Error querying the database:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const user = results[0];

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error('Error comparing passwords:', err);
                return res.status(500).json({ success: false, message: 'Internal server error' });
            }

            if (isMatch) {
                res.json({ success: true, message: 'Login successful' });
            } else {
                res.status(401).json({ success: false, message: 'Invalid username or password' });
            }
        });
    });
});

// Endpoint for creating a new user
app.post('/create-user', (req, res) => {
    const { name, email, username, password } = req.body;

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }

        db.query('INSERT INTO users (name, email, username, password) VALUES (?, ?, ?, ?)', [name, email, username, hashedPassword], (err, results) => {
            if (err) {
                console.error('Error inserting user into the database:', err);
                // Check for duplicate entry
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ success: false, message: 'Username or email already exists' });
                }
                return res.status(500).json({ success: false, message: 'Internal server error' });
            }

            res.json({ success: true, message: 'User created successfully' });
        });
    });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
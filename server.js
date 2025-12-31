require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dbPromise = require('./db');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.SERVER_PORT || 3000;

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

async function main() {
    const db = await dbPromise;

    // Create users table if it doesn't exist
    await db.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            username VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create locations table if it doesn't exist
    await db.execute(`
        CREATE TABLE IF NOT EXISTS locations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            picture_path VARCHAR(255),
            user_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Create containers table if it doesn't exist
    await db.execute(`
        CREATE TABLE IF NOT EXISTS containers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            picture_path VARCHAR(255),
            location_id INT,
            user_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Create items table if it doesn't exist
    await db.execute(`
        CREATE TABLE IF NOT EXISTS items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            picture_path VARCHAR(255),
            container_id INT,
            user_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Endpoint for user login
    app.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            const [results] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);

            if (results.length === 0) {
                return res.status(401).json({ success: false, message: 'Invalid username or password' });
            }

            const user = results[0];
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                const payload = { id: user.id, username: user.username };
                const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
                res.json({ success: true, message: 'Login successful', token: token });
            } else {
                res.status(401).json({ success: false, message: 'Invalid username or password' });
            }
        } catch (err) {
            console.error('Error during login:', err);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    // Endpoint for creating a new user
    app.post('/create-user', async (req, res) => {
        try {
            const { name, email, username, password } = req.body;
            const hashedPassword = await bcrypt.hash(password, 10);

            await db.execute('INSERT INTO users (name, email, username, password) VALUES (?, ?, ?, ?)', [name, email, username, hashedPassword]);
            res.json({ success: true, message: 'User created successfully' });
        } catch (err) {
            console.error('Error creating user:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: 'Username or email already exists' });
            }
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    // Endpoint for getting user's name by username
    app.get('/get-user-by-username', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const [results] = await db.execute('SELECT name, email FROM users WHERE id = ?', [userId]);

            if (results.length === 0) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            const user = results[0];
            res.json({ success: true, name: user.name, email: user.email });
        } catch (err) {
            console.error('Error fetching user data:', err);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    // Endpoint for adding a new location
    app.post('/add-location', authenticateToken, upload.single('picture'), async (req, res) => {
        try {
            const { name, description } = req.body;
            const picture_path = req.file ? req.file.path : null;
            const userId = req.user.id;

            if (!name) {
                return res.status(400).json({ success: false, message: 'Location name is required' });
            }

            await db.execute('INSERT INTO locations (name, description, picture_path, user_id) VALUES (?, ?, ?, ?)', [name, description, picture_path, userId]);
            res.json({ success: true, message: 'Location added successfully' });
        } catch (err) {
            console.error('Error adding location:', err);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    // Endpoint for getting all locations for a user
    app.get('/get-locations', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const [results] = await db.execute('SELECT * FROM locations WHERE user_id = ?', [userId]);
            res.json({ success: true, locations: results });
        } catch (err) {
            console.error('Error fetching locations:', err);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    // Endpoint for adding a new container
    app.post('/add-container', authenticateToken, upload.single('picture'), async (req, res) => {
        try {
            const { name, description, location_id } = req.body;
            const picture_path = req.file ? req.file.path : null;
            const userId = req.user.id;

            if (!name || !location_id) {
                return res.status(400).json({ success: false, message: 'Container name and location are required' });
            }

            await db.execute('INSERT INTO containers (name, description, picture_path, location_id, user_id) VALUES (?, ?, ?, ?, ?)', [name, description, picture_path, location_id, userId]);
            res.json({ success: true, message: 'Container added successfully' });
        } catch (err) {
            console.error('Error adding container:', err);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    // Endpoint for getting all containers for a user
    app.get('/get-containers', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const [results] = await db.execute('SELECT * FROM containers WHERE user_id = ?', [userId]);
            res.json({ success: true, containers: results });
        } catch (err) {
            console.error('Error fetching containers:', err);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    // Endpoint for adding a new item
    app.post('/add-item', authenticateToken, upload.single('picture'), async (req, res) => {
        try {
            const { name, description, container_id } = req.body;
            const picture_path = req.file ? req.file.path : null;
            const userId = req.user.id;

            if (!name || !container_id) {
                return res.status(400).json({ success: false, message: 'Item name and container are required' });
            }

            await db.execute('INSERT INTO items (name, description, picture_path, container_id, user_id) VALUES (?, ?, ?, ?, ?)', [name, description, picture_path, container_id, userId]);
            res.json({ success: true, message: 'Item added successfully' });
        } catch (err) {
            console.error('Error adding item:', err);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    return { app, db };
}

if (require.main === module) {
    main().then(({ app }) => {
        app.listen(port, () => {
            console.log(`Server listening at http://localhost:${port}`);
        });
    });
}

module.exports = main;
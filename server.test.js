const request = require('supertest');
const main = require('./server');
const fs = require('fs');
const path = require('path');

let app, db;
let tempImagePath;

const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123'
};

beforeAll(async () => {
    const server = await main();
    app = server.app;
    db = server.db;
    // Drop tables to ensure fresh schema
    await db.execute('DROP TABLE IF EXISTS items');
    await db.execute('DROP TABLE IF EXISTS containers');
    await db.execute('DROP TABLE IF EXISTS locations');
    await db.execute('DROP TABLE IF EXISTS users');
    // Re-initialize tables
    await main();

    // Create a dummy image file for upload tests
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
    }
    tempImagePath = path.join(uploadsDir, 'test-image.png');
    fs.writeFileSync(tempImagePath, 'dummy image data');
});

afterAll(async () => {
    // Clean up test user and locations after all tests
    await db.execute('DELETE FROM users WHERE username = ?', [testUser.username]);
    await db.execute('DELETE FROM locations WHERE name = ?', ['Test Location']);
    await db.execute('DELETE FROM locations WHERE name = ?', ['Another Test Location']);
    await db.end();

    // Clean up the dummy image file
    if (fs.existsSync(tempImagePath)) {
        fs.unlinkSync(tempImagePath);
    }
});

describe('User Authentication API', () => {

    it('should create a new user successfully', async () => {
        const response = await request(app)
            .post('/create-user')
            .send(testUser);
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('User created successfully');
        
        // Clean up
        await db.execute('DELETE FROM users WHERE username = ?', [testUser.username]);
    });

    it('should not create a user with a duplicate username', async () => {
        // Mock console.error to suppress expected error message
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // First, create the user
        await request(app).post('/create-user').send(testUser);
        // Then, try to create the same user again
        const response = await request(app)
            .post('/create-user')
            .send(testUser);

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Username or email already exists');

        // Clean up
        await db.execute('DELETE FROM users WHERE username = ?', [testUser.username]);

        // Restore console.error
        consoleErrorSpy.mockRestore();
    });

    it('should log in an existing user with correct credentials', async () => {
        // Ensure user exists
        await request(app).post('/create-user').send(testUser);

        const response = await request(app)
            .post('/login')
            .send({
                username: testUser.username,
                password: testUser.password
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Login successful');
        expect(response.body).toHaveProperty('token');

        // Clean up
        await db.execute('DELETE FROM users WHERE username = ?', [testUser.username]);
    });

    it('should not log in with an incorrect password', async () => {
        // Ensure user exists
        await request(app).post('/create-user').send(testUser);

        const response = await request(app)
            .post('/login')
            .send({
                username: testUser.username,
                password: 'wrongpassword'
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Invalid username or password');

        // Clean up
        await db.execute('DELETE FROM users WHERE username = ?', [testUser.username]);
    });

    it('should not log in with a non-existent username', async () => {
        const response = await request(app)
            .post('/login')
            .send({
                username: 'nonexistentuser',
                password: 'password'
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Invalid username or password');
    });
});

describe('Location API', () => {
    let token;
    let userId;

    beforeAll(async () => {
        // Create user and login to get token
        await request(app).post('/create-user').send(testUser);
        const response = await request(app)
            .post('/login')
            .send({
                username: testUser.username,
                password: testUser.password
            });
        token = response.body.token;
        const [rows] = await db.execute('SELECT id FROM users WHERE username = ?', [testUser.username]);
        userId = rows[0].id;
    });

    it('should add a new location without a picture successfully', async () => {
        const response = await request(app)
            .post('/add-location')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Test Location',
                description: 'A test description'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Location added successfully');

        const [rows] = await db.execute('SELECT * FROM locations WHERE name = ?', ['Test Location']);
        expect(rows.length).toBe(1);
        expect(rows[0].description).toBe('A test description');
        expect(rows[0].picture_path).toBeNull();
        expect(rows[0].user_id).toBe(userId);
    });

    it('should add a new location with a picture successfully', async () => {
        const response = await request(app)
            .post('/add-location')
            .set('Authorization', `Bearer ${token}`)
            .attach('picture', tempImagePath)
            .field('name', 'Another Test Location')
            .field('description', 'Another test description');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Location added successfully');

        const [rows] = await db.execute('SELECT * FROM locations WHERE name = ?', ['Another Test Location']);
        expect(rows.length).toBe(1);
        expect(rows[0].description).toBe('Another test description');
        expect(rows[0].picture_path).not.toBeNull();
        expect(rows[0].user_id).toBe(userId);
        expect(fs.existsSync(path.join(__dirname, rows[0].picture_path))).toBe(true);

        // Clean up the uploaded picture
        if (fs.existsSync(path.join(__dirname, rows[0].picture_path))) {
            fs.unlinkSync(path.join(__dirname, rows[0].picture_path));
        }
    });

    it('should return 400 if location name is missing', async () => {
        const response = await request(app)
            .post('/add-location')
            .set('Authorization', `Bearer ${token}`)
            .send({
                description: 'Description without name'
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Location name is required');
    });

    it('should retrieve all locations for the user', async () => {
        // Add a location first to ensure there's data
        await request(app)
            .post('/add-location')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Location for Retrieval', description: 'Description' });
        
        const response = await request(app)
            .get('/get-locations')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.locations).toBeInstanceOf(Array);
        expect(response.body.locations.length).toBeGreaterThanOrEqual(1);
        expect(response.body.locations.some(loc => loc.name === 'Location for Retrieval')).toBe(true);
    });
});

const testUser2 = {
    name: 'Test User 2',
    email: 'test2@example.com',
    username: 'testuser2',
    password: 'password123'
};

describe('Container API', () => {
    let token;
    let userId;
    let locationId;

    beforeAll(async () => {
        // Create user and login to get token
        await request(app).post('/create-user').send(testUser2);
        const response = await request(app)
            .post('/login')
            .send({
                username: testUser2.username,
                password: testUser2.password
            });
        token = response.body.token;
        const [userRows] = await db.execute('SELECT id FROM users WHERE username = ?', [testUser2.username]);
        userId = userRows[0].id;

        // Create a location to be used in tests
        await request(app)
            .post('/add-location')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Test Location for Containers', description: 'A test description' });
        const [locationRows] = await db.execute('SELECT id FROM locations WHERE name = ?', ['Test Location for Containers']);
        locationId = locationRows[0].id;
    });

    afterAll(async () => {
        await db.execute('DELETE FROM users WHERE username = ?', [testUser2.username]);
    });


    it('should add a new container without a picture successfully', async () => {
        const response = await request(app)
            .post('/add-container')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Test Container',
                description: 'A test description',
                location_id: locationId
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Container added successfully');

        const [rows] = await db.execute('SELECT * FROM containers WHERE name = ?', ['Test Container']);
        expect(rows.length).toBe(1);
        expect(rows[0].description).toBe('A test description');
        expect(rows[0].picture_path).toBeNull();
        expect(rows[0].user_id).toBe(userId);
        expect(rows[0].location_id).toBe(locationId);
    });

    it('should add a new container with a picture successfully', async () => {
        const response = await request(app)
            .post('/add-container')
            .set('Authorization', `Bearer ${token}`)
            .attach('picture', tempImagePath)
            .field('name', 'Another Test Container')
            .field('description', 'Another test description')
            .field('location_id', locationId);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Container added successfully');

        const [rows] = await db.execute('SELECT * FROM containers WHERE name = ?', ['Another Test Container']);
        expect(rows.length).toBe(1);
        expect(rows[0].description).toBe('Another test description');
        expect(rows[0].picture_path).not.toBeNull();
        expect(rows[0].user_id).toBe(userId);
        expect(rows[0].location_id).toBe(locationId);
        expect(fs.existsSync(path.join(__dirname, rows[0].picture_path))).toBe(true);

        // Clean up the uploaded picture
        if (fs.existsSync(path.join(__dirname, rows[0].picture_path))) {
            fs.unlinkSync(path.join(__dirname, rows[0].picture_path));
        }
    });

    it('should return 400 if container name or location is missing', async () => {
        const response = await request(app)
            .post('/add-container')
            .set('Authorization', `Bearer ${token}`)
            .send({
                description: 'Description without name or location'
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Container name and location are required');
    });

    it('should retrieve containers by location for the user', async () => {
        // Add a container first to ensure there's data for the location
        await request(app)
            .post('/add-container')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Container by Location', description: 'Description', location_id: locationId });
        
        const response = await request(app)
            .get(`/get-containers-by-location?location_id=${locationId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.containers).toBeInstanceOf(Array);
        expect(response.body.containers.length).toBeGreaterThanOrEqual(1);
        expect(response.body.containers.some(cont => cont.name === 'Container by Location')).toBe(true);

        // Clean up
        await db.execute('DELETE FROM containers WHERE name = ?', ['Container by Location']);
    });
});

describe('Item API', () => {
    let token;
    let userId;
    let locationId;
    let containerId;

    beforeAll(async () => {
        // Create user and login to get token
        const testUser3 = { name: 'Test User 3', email: 'test3@example.com', username: 'testuser3', password: 'password123' };
        await request(app).post('/create-user').send(testUser3);
        const response = await request(app)
            .post('/login')
            .send({
                username: testUser3.username,
                password: testUser3.password
            });
        token = response.body.token;
        const [userRows] = await db.execute('SELECT id FROM users WHERE username = ?', [testUser3.username]);
        userId = userRows[0].id;

        // Create a location
        await request(app)
            .post('/add-location')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Test Location for Items', description: 'A test description' });
        const [locationRows] = await db.execute('SELECT id FROM locations WHERE name = ?', ['Test Location for Items']);
        locationId = locationRows[0].id;

        // Create a container
        await request(app)
            .post('/add-container')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Test Container for Items', description: 'A test description', location_id: locationId });
        const [containerRows] = await db.execute('SELECT id FROM containers WHERE name = ?', ['Test Container for Items']);
        containerId = containerRows[0].id;
    });

    afterAll(async () => {
        await db.execute('DELETE FROM users WHERE username = ?', ['testuser3']);
    });

    it('should add a new item without a picture successfully', async () => {
        const response = await request(app)
            .post('/add-item')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Test Item',
                description: 'A test description',
                container_id: containerId
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Item added successfully');

        const [rows] = await db.execute('SELECT * FROM items WHERE name = ?', ['Test Item']);
        expect(rows.length).toBe(1);
        expect(rows[0].description).toBe('A test description');
        expect(rows[0].picture_path).toBeNull();
        expect(rows[0].user_id).toBe(userId);
        expect(rows[0].container_id).toBe(containerId);
    });

    it('should add a new item with a picture successfully', async () => {
        const response = await request(app)
            .post('/add-item')
            .set('Authorization', `Bearer ${token}`)
            .attach('picture', tempImagePath)
            .field('name', 'Another Test Item')
            .field('description', 'Another test description')
            .field('container_id', containerId);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Item added successfully');

        const [rows] = await db.execute('SELECT * FROM items WHERE name = ?', ['Another Test Item']);
        expect(rows.length).toBe(1);
        expect(rows[0].description).toBe('Another test description');
        expect(rows[0].picture_path).not.toBeNull();
        expect(rows[0].user_id).toBe(userId);
        expect(rows[0].container_id).toBe(containerId);
        expect(fs.existsSync(path.join(__dirname, rows[0].picture_path))).toBe(true);

        // Clean up the uploaded picture
        if (fs.existsSync(path.join(__dirname, rows[0].picture_path))) {
            fs.unlinkSync(path.join(__dirname, rows[0].picture_path));
        }
    });

    it('should return 400 if item name or container is missing', async () => {
        const response = await request(app)
            .post('/add-item')
            .set('Authorization', `Bearer ${token}`)
            .send({
                description: 'Description without name or container'
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Item name and container are required');
    });
});


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
    // Ensure test user and locations are clean before tests
    await db.execute('DELETE FROM users WHERE username = ?', [testUser.username]);
    await db.execute('DELETE FROM locations WHERE name = ?', ['Test Location']);
    await db.execute('DELETE FROM locations WHERE name = ?', ['Another Test Location']);

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

    it('should add a new location without a picture successfully', async () => {
        const response = await request(app)
            .post('/add-location')
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
    });

    it('should add a new location with a picture successfully', async () => {
        const response = await request(app)
            .post('/add-location')
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
        expect(fs.existsSync(path.join(__dirname, rows[0].picture_path))).toBe(true);

        // Clean up the uploaded picture
        if (fs.existsSync(path.join(__dirname, rows[0].picture_path))) {
            fs.unlinkSync(path.join(__dirname, rows[0].picture_path));
        }
    });

    it('should return 400 if location name is missing', async () => {
        const response = await request(app)
            .post('/add-location')
            .send({
                description: 'Description without name'
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Location name is required');
    });

    it('should retrieve all locations', async () => {
        // Add a location first to ensure there's data
        await request(app)
            .post('/add-location')
            .send({ name: 'Location for Retrieval', description: 'Description' });
        
        const response = await request(app)
            .get('/get-locations');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.locations).toBeInstanceOf(Array);
        expect(response.body.locations.length).toBeGreaterThanOrEqual(1);
        expect(response.body.locations.some(loc => loc.name === 'Location for Retrieval')).toBe(true);

        await db.execute('DELETE FROM locations WHERE name = ?', ['Location for Retrieval']);
    });
});

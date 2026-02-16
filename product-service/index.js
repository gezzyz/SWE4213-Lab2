const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const PORT = 3002;

// TODO: Create a PostgreSQL connection pool
// HINT: Look at how user-service/index.js creates its pool
// You need to use the environment variables: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
// The defaults should match what you configure in docker-compose.yml
const pool = new Pool({
  host: process.env.DB_HOST || 'product-db',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'productdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        price NUMERIC(10, 2) NOT NULL
      );
    `);
    console.log('Database initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }

  try {
    const checkEmpty = await pool.query('SELECT 1 FROM products LIMIT 1');
    if (checkEmpty.rows.length === 0) {
      await pool.query(`
        INSERT INTO products (name, description, price) VALUES
        ('Laptop', 'A powerful laptop for developers', 999.99),
        ('Headphones', 'Noise-cancelling wireless headphones', 199.99);
      `);
      console.log('Sample products inserted');
    }
  } catch (err) {
    console.error('Error inserting sample products:', err);
    process.exit(1);
  }
};
// Wait for database to be ready (provided for you)
const waitForDB = async (retries = 10, delay = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('Connected to database');
      return;
    } catch (err) {
      console.log(`Waiting for database... attempt ${i + 1}/${retries}`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error('Could not connect to database');
};

// TODO: Implement GET /products - List all products
// HINT: Look at the GET /users endpoint in user-service/index.js
// Query: SELECT * FROM products ORDER BY id
app.get('/products', async (req, res) => {
  try{
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// TODO: Implement POST /products - Create a new product
// HINT: Look at the POST /users endpoint in user-service/index.js
// Required fields: name, description, price
// Query: INSERT INTO products (name, description, price) VALUES ($1, $2, $3) RETURNING *
app.post('/products', async (req, res) => {
  const { name, description, price } = req.body;

  if (!name || !description || !price || isNaN(price)) {
    return res.status(400).json({ error: 'Name, description, and price are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO products (name, description, price) VALUES ($1, $2, $3) RETURNING *',
      [name, description, parseFloat(price)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// TODO: Implement GET /products/:id - Get product by ID
// HINT: Look at the GET /users/:id endpoint in user-service/index.js
// Query: SELECT * FROM products WHERE id = $1
app.get('/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server after DB is ready
waitForDB().then(() => {
  initDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Product Service running on port ${PORT}`);
    });
  });
});

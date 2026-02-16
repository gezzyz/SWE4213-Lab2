const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const PORT = 3003;

// TODO: Create a PostgreSQL connection pool
// HINT: Same pattern as user-service and product-service
const pool = new Pool({
  host: process.env.DB_HOST || 'order-db',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'orderdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        total_price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`);
    console.log('Database initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
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

// Helper: Validate that a user exists by calling the User Service
// HINT: Use fetch() to call http://user-service:3001/users/:id
// Return the user object if found, or null if not
const validateUser = async (userId) => {
  try {
    const response = await fetch(`http://user-service:3001/users/${userId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('Error validating user:', err);
    return null;
  }
};

// Helper: Validate that a product exists by calling the Product Service
// HINT: Use fetch() to call http://product-service:3002/products/:id
// Return the product object if found, or null if not
const validateProduct = async (productId) => {
  try{
    const response = await fetch(`http://product-service:3002/products/${productId}`);
    if (!response.ok) return null;
    return await response.json(); 
  } catch (err) {
    console.error('Error validating product:', err);
    return null;
  }
};

// TODO: Implement GET /orders - List all orders
// Query: SELECT * FROM orders ORDER BY id
app.get('/orders', async (req, res) => {
  try{
    const result = await pool.query('SELECT * FROM orders ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// TODO: Implement POST /orders - Create a new order
// This is the most complex endpoint! Steps:
//   1. Extract user_id, product_id, quantity from req.body
//   2. Validate all fields are present
//   3. Call validateUser(user_id) - return 404 if user not found
//   4. Call validateProduct(product_id) - return 404 if product not found
//   5. Calculate total_price = product.price * quantity
//   6. Insert into orders table
// Query: INSERT INTO orders (user_id, product_id, quantity, total_price) VALUES ($1, $2, $3, $4) RETURNING *
app.post('/orders', async (req, res) => {
  const { user_id, product_id, quantity } = req.body;
  if (!user_id || !product_id || !quantity) {
    return res.status(400).json({ error: 'user_id, product_id, and quantity are required' });
  }
  try {
    const user = await validateUser(user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const product = await validateProduct(product_id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const total_price = product.price * quantity;
    const result = await pool.query(
      'INSERT INTO orders (user_id, product_id, quantity, total_price) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, product_id, quantity, total_price]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// TODO: Implement GET /orders/:id - Get order by ID
// Query: SELECT * FROM orders WHERE id = $1
app.get('/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server after DB is ready
waitForDB().then(() => {
  initDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Order Service running on port ${PORT}`);
    });
  });
});

const express = require('express');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3000;

const VALID_TOKEN = 'token123';

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.substring(7); 
  if (token !== VALID_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
  }
  next();
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: { error: 'Too Many Requests', message: 'You have exceeded the rate limit. Please try again later.' },
  standardHeaders: true, 
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Maximum 100 requests per 15 minutes.',
    });
  },
});

// Proxy routes to microservices
app.use('/api/users', limiter, authenticate, createProxyMiddleware({
  target: 'http://user-service:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/users': '/users' },
}));

app.use('/api/products', limiter, authenticate, createProxyMiddleware({
  target: 'http://product-service:3002',
  changeOrigin: true,
  pathRewrite: { '^/api/products': '/products' },
}));

app.use('/api/orders', limiter, authenticate, createProxyMiddleware({
  target: 'http://order-service:3003',
  changeOrigin: true,
  pathRewrite: { '^/api/orders': '/orders' },
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Gateway is running' });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

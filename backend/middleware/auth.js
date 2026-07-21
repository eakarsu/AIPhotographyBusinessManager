const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const JWT_SECRET = String(process.env.JWT_SECRET || '');
if (JWT_SECRET.length < 32 || /replace|change|example|generate|secret-key-2024/i.test(JWT_SECRET)) {
  throw new Error('JWT_SECRET must be a non-placeholder value of at least 32 characters.');
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Rate limiter for AI endpoints: 20 requests per hour per user/IP
const aiRequestCounts = new Map();

function aiRateLimiter(req, res, next) {
  const key = (req.user && req.user.id) ? `user_${req.user.id}` : `ip_${req.ip}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour

  if (!aiRequestCounts.has(key)) {
    aiRequestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  const record = aiRequestCounts.get(key);
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
    return next();
  }

  if (record.count >= 20) {
    return res.status(429).json({ error: 'Rate limit exceeded. Max 20 AI requests per hour.' });
  }

  record.count++;
  next();
}

module.exports = { authenticateToken, aiRateLimiter, JWT_SECRET };

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/galleries', require('./routes/galleries'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/shoots', require('./routes/shoots'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/social', require('./routes/social'));
app.use('/api/packages', require('./routes/packages'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/workflows', require('./routes/workflows'));
app.use('/api/emails', require('./routes/emails'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/testimonials', require('./routes/testimonials'));
app.use('/api/mileage', require('./routes/mileage'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/tasks', require('./routes/tasks'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n📸 Photography Business Manager API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});

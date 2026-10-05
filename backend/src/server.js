const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();
const { version: backendVersion } = require('../package.json');

const authRoutes = require('./routes/auth.routes');
const itemsRoutes = require('./routes/items.routes');
const ordersRoutes = require('./routes/orders.routes');
const shipmentsRoutes = require('./routes/shipments.routes');
const settingsRoutes = require('./routes/settings.routes');
const statsRoutes = require('./routes/stats.routes');
const questionsRoutes = require('./routes/questions.routes');
const usersRoutes = require('./routes/users.routes');
const pairRoutes = require('./routes/pair.routes');
const mobileRoutes = require('./routes/mobile.routes');
const { attachDevice } = require('./middleware/device');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('dev'));

// Resolves the paired mobile device (if any) for every request. It never
// rejects, so the existing web routes behave exactly as before.
app.use(attachDevice);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/shipments', shipmentsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/pair', pairRoutes);
app.use('/api/mobile', mobileRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Mercado Libre Manager API',
    version: backendVersion,
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
  });
});

if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.listen(PORT, () => {
    console.log(` Mercado Libre Manager Backend corriendo en http://localhost:${PORT}`);
    console.log(` Modo Demo y Rutas de API listas.`);
  });
}

module.exports = app;

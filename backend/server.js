const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

const { authenticateToken } = require('./middleware/auth');

// Public routes
app.use('/api/auth', require('./routes/auth'));

// Protected routes
app.use('/api/clients', authenticateToken, require('./routes/clients'));
app.use('/api/galleries', authenticateToken, require('./routes/galleries'));
app.use('/api/contracts', authenticateToken, require('./routes/contracts'));
app.use('/api/invoices', authenticateToken, require('./routes/invoices'));
app.use('/api/shoots', authenticateToken, require('./routes/shoots'));
app.use('/api/ai', authenticateToken, require('./routes/ai'));
app.use('/api/sessions', authenticateToken, require('./routes/sessions'));
app.use('/api/photos', authenticateToken, require('./routes/photos'));
app.use('/api/social', authenticateToken, require('./routes/social'));
app.use('/api/packages', authenticateToken, require('./routes/packages'));
app.use('/api/equipment', authenticateToken, require('./routes/equipment'));
app.use('/api/expenses', authenticateToken, require('./routes/expenses'));
app.use('/api/portfolio', authenticateToken, require('./routes/portfolio'));
app.use('/api/workflows', authenticateToken, require('./routes/workflows'));
app.use('/api/emails', authenticateToken, require('./routes/emails'));
app.use('/api/analytics', authenticateToken, require('./routes/analytics'));
app.use('/api/testimonials', authenticateToken, require('./routes/testimonials'));
app.use('/api/mileage', authenticateToken, require('./routes/mileage'));
app.use('/api/bookings', authenticateToken, require('./routes/bookings'));
app.use('/api/tasks', authenticateToken, require('./routes/tasks'));
app.use('/api/integrations', authenticateToken, require('./routes/integrations'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// === Custom Feature Mounts (batch_06) ===
app.use('/api/cf-agentic-shoot-orchestration', require('./routes/customFeat01_AgenticShootOrchestration'));
app.use('/api/cf-computer-vision-photo-analysis', require('./routes/customFeat02_ComputerVisionPhotoAnalysis'));
app.use('/api/cf-client-communication-automation', require('./routes/customFeat03_ClientCommunicationAutomation'));
app.use('/api/cf-pricing-intelligence', require('./routes/customFeat04_PricingIntelligence'));
app.use('/api/cf-video-highlight-reel-generation', require('./routes/customFeat05_VideoHighlightReelGeneration'));


// === Batch 06 Gaps & Frontend Mounts ===
app.use('/api/gap-shoots-without-shoot', require('./routes/gapFeat_shoots_without_shoot'));
app.use('/api/gap-clients-without-client', require('./routes/gapFeat_clients_without_client'));
app.use('/api/gap-galleries-without-gallery', require('./routes/gapFeat_galleries_without_gallery'));
app.use('/api/gap-testimonials-without-review', require('./routes/gapFeat_testimonials_without_review'));
app.use('/api/gap-limited-storage-integration-integrations-stub', require('./routes/gapFeat_limited_storage_integration_integrations_stub'));
app.use('/api/gap-no-client-proofing-workflow-advanced-markup-approv', require('./routes/gapFeat_no_client_proofing_workflow_advanced_markup_approv'));
app.use('/api/gap-no-photographer-schedule-optimization', require('./routes/gapFeat_no_photographer_schedule_optimization'));
app.use('/api/gap-no-integration-with-lightroom-capture-one-editing-', require('./routes/gapFeat_no_integration_with_lightroom_capture_one_editing_'));
app.use('/api/gap-no-marketplace-selling-prints-products', require('./routes/gapFeat_no_marketplace_selling_prints_products'));
app.use('/api/gap-no-notifications-module-grep-0', require('./routes/gapFeat_no_notifications_module_grep_0'));
app.use('/api/gap-no-audit-logging-grep-0', require('./routes/gapFeat_no_audit_logging_grep_0'));
app.use('/api/gap-no-webhooks-for-booking-events', require('./routes/gapFeat_no_webhooks_for_booking_events'));

app.listen(PORT, () => {
  console.log(`\nPhotography Business Manager API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});

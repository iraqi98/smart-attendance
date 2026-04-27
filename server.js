/**
 * Smart Attendance - Online Server
 * نظام الحضور والانصراف الذكي - السيرفر أونلاين
 *
 * كيفية الاستخدام:
 * 1. npm install
 * 2. npm start
 * 3. افتح: http://localhost:8080
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/settings', require('./routes/settings'));

// Static files
app.use(express.static(path.join(__dirname)));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'خطأ في السيرفر' });
});

app.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIP = 'localhost';

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIP = iface.address;
                break;
            }
        }
        if (localIP !== 'localhost') break;
    }

    console.log('\n========================================');
    console.log('  🚀 Smart Attendance Server - Online');
    console.log('========================================\n');
    console.log(`  💻 الكمبيوتر: http://localhost:${PORT}`);
    console.log(`  📱 الهاتف:    http://${localIP}:${PORT}`);
    console.log(`  🌐 API:       http://localhost:${PORT}/api`);
    console.log('\n========================================');
    console.log('  اضغط Ctrl+C لإيقاف السيرفر');
    console.log('========================================\n');
});


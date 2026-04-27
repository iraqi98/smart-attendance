const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

// Get location settings
router.get('/location', (req, res) => {
    db.get("SELECT value FROM settings WHERE key = 'location'", [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.json({ enabled: false, lat: null, lng: null, radius: 500, name: 'المكتب الرئيسي' });
        res.json(JSON.parse(row.value));
    });
});

// Update location settings (Admin only)
router.put('/location', requireRole(['admin']), (req, res) => {
    const { enabled, lat, lng, radius, name } = req.body;
    const config = JSON.stringify({ enabled, lat, lng, radius, name });

    db.run("UPDATE settings SET value = ? WHERE key = 'location'", [config], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'تم حفظ إعدادات الموقع بنجاح' });
    });
});

// Get all settings
router.get('/', requireRole(['admin']), (req, res) => {
    db.all("SELECT * FROM settings", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach(row => {
            try {
                settings[row.key] = JSON.parse(row.value);
            } catch {
                settings[row.key] = row.value;
            }
        });
        res.json(settings);
    });
});

module.exports = router;


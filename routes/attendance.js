const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

// Helper: calculate distance in meters
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Get all attendance (with filters)
router.get('/', (req, res) => {
    let sql = 'SELECT a.*, e.name as employee_name, e.department FROM attendance a JOIN employees e ON a.employee_id = e.id';
    const params = [];
    const conditions = [];

    if (req.query.date) {
        conditions.push('a.date = ?');
        params.push(req.query.date);
    }
    if (req.query.status) {
        conditions.push('a.status = ?');
        params.push(req.query.status);
    }
    if (req.query.employee_id) {
        conditions.push('a.employee_id = ?');
        params.push(req.query.employee_id);
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY a.date DESC, a.id DESC';

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get today's attendance
router.get('/today', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    db.all(
        `SELECT a.*, e.name as employee_name, e.department FROM attendance a 
         JOIN employees e ON a.employee_id = e.id WHERE a.date = ?`,
        [today],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// Check location before attendance
router.post('/check-location', async (req, res) => {
    const { lat, lng } = req.body;

    db.get("SELECT value FROM settings WHERE key = 'location'", [], (err, row) => {
        if (err || !row) {
            return res.json({ allowed: true, message: 'التحقق من الموقع معطل' });
        }

        const config = JSON.parse(row.value);
        if (!config.enabled) {
            return res.json({ allowed: true, distance: 0, message: 'التحقق من الموقع معطل' });
        }
        if (config.lat == null || config.lng == null) {
            return res.json({ allowed: false, distance: null, message: 'لم يتم تحديد موقع المكتب بعد' });
        }

        const distance = calculateDistance(lat, lng, config.lat, config.lng);
        if (distance <= config.radius) {
            return res.json({ allowed: true, distance: Math.round(distance), message: `أنت على بعد ${Math.round(distance)} متر من المكتب` });
        } else {
            return res.json({ allowed: false, distance: Math.round(distance), message: `أنت بعيد عن المكتب بمسافة ${Math.round(distance)} متر. الحد المسموح: ${config.radius} متر.` });
        }
    });
});

// Record check-in
router.post('/checkin', (req, res) => {
    const { employee_id, check_in, status, notes, location, distance, lat, lng } = req.body;
    const dateStr = new Date().toISOString().split('T')[0];

    // Check location server-side too
    db.get("SELECT value FROM settings WHERE key = 'location'", [], (err, row) => {
        if (row) {
            const config = JSON.parse(row.value);
            if (config.enabled && config.lat != null && config.lng != null) {
                if (lat != null && lng != null) {
                    const dist = calculateDistance(lat, lng, config.lat, config.lng);
                    if (dist > config.radius) {
                        return res.status(403).json({ error: `أنت خارج النطاق المسموح. المسافة: ${Math.round(dist)} متر` });
                    }
                }
            }
        }

        // Check if already checked in today
        db.get('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, dateStr], (err, existing) => {
            if (err) return res.status(500).json({ error: err.message });
            if (existing) {
                return res.status(400).json({ error: 'تم تسجيل الحضور مسبقاً لهذا اليوم' });
            }

            db.run(
                `INSERT INTO attendance (employee_id, date, check_in, check_out, status, hours, notes, location, distance)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [employee_id, dateStr, check_in || new Date().toISOString(), null, status || 'present', 0, notes || '', location || '', distance || 0],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ id: this.lastID, message: 'تم تسجيل الحضور بنجاح' });
                }
            );
        });
    });
});

// Record check-out
router.post('/checkout', (req, res) => {
    const { employee_id, check_out, notes, location, distance, lat, lng } = req.body;
    const dateStr = new Date().toISOString().split('T')[0];

    // Check location server-side too
    db.get("SELECT value FROM settings WHERE key = 'location'", [], (err, row) => {
        if (row) {
            const config = JSON.parse(row.value);
            if (config.enabled && config.lat != null && config.lng != null) {
                if (lat != null && lng != null) {
                    const dist = calculateDistance(lat, lng, config.lat, config.lng);
                    if (dist > config.radius) {
                        return res.status(403).json({ error: `أنت خارج النطاق المسموح. المسافة: ${Math.round(dist)} متر` });
                    }
                }
            }
        }

        db.get('SELECT * FROM attendance WHERE employee_id = ? AND date = ? AND check_out IS NULL', [employee_id, dateStr], (err, record) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!record) {
                return res.status(400).json({ error: 'لم يتم العثور على سجل حضور لليوم' });
            }

            const checkOutTime = new Date(check_out || new Date());
            const checkInTime = new Date(record.check_in);
            const hours = (checkOutTime - checkInTime) / (1000 * 60 * 60);

            db.run(
                `UPDATE attendance SET check_out = ?, hours = ?, notes = ?, location = ?, distance = ? WHERE id = ?`,
                [checkOutTime.toISOString(), Math.round(hours * 100) / 100, notes || record.notes, location || record.location, distance || record.distance, record.id],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'تم تسجيل الانصراف بنجاح', hours: Math.round(hours * 100) / 100 });
                }
            );
        });
    });
});

// Delete attendance record
router.delete('/:id', requireRole(['admin', 'hr_manager', 'supervisor']), (req, res) => {
    db.run('DELETE FROM attendance WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'تم حذف السجل بنجاح' });
    });
});

module.exports = router;


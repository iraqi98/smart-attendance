const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

// Get all leaves
router.get('/', (req, res) => {
    let sql = `SELECT l.*, e.name as employee_name FROM leaves l JOIN employees e ON l.employee_id = e.id`;
    const params = [];

    if (req.query.status) {
        sql += ' WHERE l.status = ?';
        params.push(req.query.status);
    }
    sql += ' ORDER BY l.from_date DESC';

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create leave request
router.post('/', (req, res) => {
    const { employee_id, type, from_date, to_date, days, reason } = req.body;

    if (!employee_id || !from_date || !to_date) {
        return res.status(400).json({ error: 'يرجى ملء الحقول المطلوبة' });
    }

    const dayCount = days || (Math.ceil((new Date(to_date) - new Date(from_date)) / (1000 * 60 * 60 * 24)) + 1);

    db.run(
        `INSERT INTO leaves (employee_id, type, from_date, to_date, days, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [employee_id, type || 'annual', from_date, to_date, dayCount > 0 ? dayCount : 1, reason || ''],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, message: 'تم إرسال طلب الإجازة بنجاح' });
        }
    );
});

// Approve leave
router.put('/:id/approve', requireRole(['admin', 'hr_manager', 'supervisor']), (req, res) => {
    db.run("UPDATE leaves SET status = 'approved' WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'تم اعتماد طلب الإجازة' });
    });
});

// Reject leave
router.put('/:id/reject', requireRole(['admin', 'hr_manager', 'supervisor']), (req, res) => {
    db.run("UPDATE leaves SET status = 'rejected' WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'تم رفض طلب الإجازة' });
    });
});

// Delete leave
router.delete('/:id', requireRole(['admin', 'hr_manager']), (req, res) => {
    db.run('DELETE FROM leaves WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'تم حذف طلب الإجازة' });
    });
});

module.exports = router;


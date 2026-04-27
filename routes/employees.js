const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

// Get all employees
router.get('/', (req, res) => {
    db.all('SELECT * FROM employees ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get single employee
router.get('/:id', (req, res) => {
    db.get('SELECT * FROM employees WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'الموظف غير موجود' });
        res.json(row);
    });
});

// Create employee (Admin/HR only)
router.post('/', requireRole(['admin', 'hr_manager']), (req, res) => {
    const { name, code, email, phone, department, position, role, hire_date, salary, status } = req.body;

    if (!name || !code || !department || !position) {
        return res.status(400).json({ error: 'يرجى ملء الحقول المطلوبة' });
    }

    db.run(
        `INSERT INTO employees (name, code, email, phone, department, position, role, hire_date, salary, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, code, email || '', phone || '', department, position, role || 'employee', hire_date || '', salary || 0, status || 'active'],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'الرقم الوظيفي موجود مسبقاً' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, message: 'تم إضافة الموظف بنجاح' });
        }
    );
});

// Update employee
router.put('/:id', requireRole(['admin', 'hr_manager']), (req, res) => {
    const { name, code, email, phone, department, position, role, hire_date, salary, status } = req.body;

    db.run(
        `UPDATE employees SET name = ?, code = ?, email = ?, phone = ?, department = ?, position = ?, role = ?, hire_date = ?, salary = ?, status = ?
         WHERE id = ?`,
        [name, code, email || '', phone || '', department, position, role || 'employee', hire_date || '', salary || 0, status || 'active', req.params.id],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'الرقم الوظيفي موجود مسبقاً' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'تم تحديث بيانات الموظف' });
        }
    );
});

// Delete employee
router.delete('/:id', requireRole(['admin', 'hr_manager']), (req, res) => {
    db.run('DELETE FROM employees WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        // Also delete related records
        db.run('DELETE FROM attendance WHERE employee_id = ?', [req.params.id]);
        db.run('DELETE FROM leaves WHERE employee_id = ?', [req.params.id]);
        res.json({ message: 'تم حذف الموظف بنجاح' });
    });
});

module.exports = router;


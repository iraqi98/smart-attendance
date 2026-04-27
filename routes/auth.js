const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const router = express.Router();

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في قاعدة البيانات' });
        }
        if (!user) {
            return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, name: user.name, role: user.role, employee_id: user.employee_id },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                employee_id: user.employee_id
            }
        });
    });
});

// Register (Admin only - can be called directly for first setup)
router.post('/register', (req, res) => {
    const { username, password, name, role, employee_id } = req.body;

    if (!username || !password || !name) {
        return res.status(400).json({ error: 'يرجى ملء جميع الحقول المطلوبة' });
    }

    const hash = bcrypt.hashSync(password, 10);

    db.run(
        'INSERT INTO users (username, password, name, role, employee_id) VALUES (?, ?, ?, ?, ?)',
        [username, hash, name, role || 'employee', employee_id || null],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' });
                }
                return res.status(500).json({ error: 'خطأ في إنشاء الحساب' });
            }
            res.json({ id: this.lastID, message: 'تم إنشاء الحساب بنجاح' });
        }
    );
});

// Get current user
router.get('/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'غير مسجل الدخول' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'التوكن غير صالح' });
        }
        res.json({ user });
    });
});

module.exports = router;


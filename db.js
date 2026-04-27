const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database.');
        initTables();
    }
});

function initTables() {
    db.serialize(() => {
        // Users table (for login accounts)
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT DEFAULT 'employee',
                employee_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Employees table
        db.run(`
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                email TEXT,
                phone TEXT,
                department TEXT,
                position TEXT,
                role TEXT DEFAULT 'employee',
                hire_date TEXT,
                salary REAL DEFAULT 0,
                status TEXT DEFAULT 'active',
                photo TEXT,
                face_descriptor TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Attendance table
        db.run(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                check_in TEXT,
                check_out TEXT,
                status TEXT,
                hours REAL DEFAULT 0,
                notes TEXT,
                location TEXT,
                distance INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(id)
            )
        `);

        // Leaves table
        db.run(`
            CREATE TABLE IF NOT EXISTS leaves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                type TEXT,
                from_date TEXT,
                to_date TEXT,
                days INTEGER,
                reason TEXT,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(id)
            )
        `);

        // Settings table (for location config, etc.)
        db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT
            )
        `);

        // Insert default admin user if not exists
        db.get("SELECT * FROM users WHERE username = 'admin'", [], (err, row) => {
            if (!row) {
                const bcrypt = require('bcryptjs');
                const hash = bcrypt.hashSync('admin', 10);
                db.run(
                    "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)",
                    ['admin', hash, 'مدير النظام', 'admin']
                );
            }
        });

        // Insert default location settings if not exists
        db.get("SELECT * FROM settings WHERE key = 'location'", [], (err, row) => {
            if (!row) {
                db.run(
                    "INSERT INTO settings (key, value) VALUES (?, ?)",
                    ['location', JSON.stringify({ enabled: false, lat: null, lng: null, radius: 500, name: 'المكتب الرئيسي' })]
                );
            }
        });

        // Insert demo employees if table is empty
        db.get("SELECT COUNT(*) as count FROM employees", [], (err, row) => {
            if (row && row.count === 0) {
                const demoEmployees = [
                    ['أحمد محمد عبدالله', 'EMP001', 'ahmed@company.com', '0501234567', 'IT', 'مطور برمجيات', 'admin', '2023-01-15', 15000, 'active'],
                    ['سارة خالد العلي', 'EMP002', 'sara@company.com', '0557654321', 'HR', 'أخصائي موارد بشرية', 'hr_manager', '2023-03-01', 12000, 'active'],
                    ['محمد سعد الراشد', 'EMP003', 'mohammed@company.com', '0561112222', 'Finance', 'محاسب', 'supervisor', '2022-11-20', 11000, 'active'],
                    ['نورة فهد السالم', 'EMP004', 'noura@company.com', '0573334444', 'Marketing', 'مسؤول تسويق', 'employee', '2023-06-10', 13000, 'active'],
                    ['فهد عبدالرحمن الدوسري', 'EMP005', 'fahad@company.com', '0585556666', 'Sales', 'مندوب مبيعات', 'employee', '2022-09-05', 10000, 'active']
                ];

                const stmt = db.prepare(`
                    INSERT INTO employees (name, code, email, phone, department, position, role, hire_date, salary, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                demoEmployees.forEach(emp => stmt.run(emp));
                stmt.finalize();

                // Insert demo attendance
                const today = new Date();
                for (let i = 0; i < 5; i++) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    const dateStr = date.toISOString().split('T')[0];

                    for (let empId = 1; empId <= 5; empId++) {
                        if (Math.random() > 0.2) {
                            const checkIn = new Date(date);
                            checkIn.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30));
                            const checkOut = new Date(date);
                            checkOut.setHours(16 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30));
                            const hours = (checkOut - checkIn) / (1000 * 60 * 60);
                            const status = checkIn.getHours() > 8 ? 'late' : 'present';

                            db.run(
                                "INSERT INTO attendance (employee_id, date, check_in, check_out, status, hours, notes, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                                [empId, dateStr, checkIn.toISOString(), checkOut.toISOString(), status, Math.round(hours * 100) / 100, '', 'المكتب الرئيسي']
                            );
                        } else {
                            db.run(
                                "INSERT INTO attendance (employee_id, date, check_in, check_out, status, hours, notes, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                                [empId, dateStr, null, null, 'absent', 0, 'غياب بدون عذر', '-']
                            );
                        }
                    }
                }

                // Insert demo leaves
                db.run(
                    "INSERT INTO leaves (employee_id, type, from_date, to_date, days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [1, 'annual', '2024-02-01', '2024-02-05', 5, 'إجازة سنوية', 'approved']
                );
                db.run(
                    "INSERT INTO leaves (employee_id, type, from_date, to_date, days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [3, 'sick', '2024-01-15', '2024-01-17', 3, 'مرضي', 'approved']
                );
                db.run(
                    "INSERT INTO leaves (employee_id, type, from_date, to_date, days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [4, 'emergency', '2024-03-10', '2024-03-10', 1, 'ظروف طارئة', 'pending']
                );
            }
        });
    });
}

module.exports = db;


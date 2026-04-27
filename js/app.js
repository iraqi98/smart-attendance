/**
 * Smart Attendance - Main Application
 * نظام الحضور والانصراف الذكي - المنطق الرئيسي
 */

const API_URL = ''; // Empty = same origin

async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('sa_token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    const res = await fetch(`${API_URL}/api${endpoint}`, {
        ...options,
        headers
    });

    if (res.status === 401) {
        localStorage.removeItem('sa_token');
        app.currentUser = null;
        location.reload();
        return;
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'خطأ في الاتصال بالسيرفر' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
}

const app = {
    version: '2.0.0',
    currentUser: null,
    currentPage: 'dashboard',
    sidebarCollapsed: false,
    darkMode: false,

    async init() {
        this.loadTheme();
        this.updateDate();
        setInterval(() => this.updateDate(), 60000);

        // Check auth
        const token = localStorage.getItem('sa_token');
        if (token) {
            try {
                const data = await apiFetch('/auth/me');
                this.currentUser = data.user;
                this.showMainApp();
            } catch (e) {
                localStorage.removeItem('sa_token');
                document.getElementById('loading-overlay').style.display = 'none';
            }
        } else {
            document.getElementById('loading-overlay').style.display = 'none';
        }

        // Global search
        document.getElementById('global-search')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.globalSearch(e.target.value);
        });

        // Initialize modules
        setTimeout(() => {
            dashboard.init();
            employees.init();
            attendance.init();
            faceAuth.init();
            leaves.init();
            reports.init();
            backup.init();
            settings.init();
            employeePortal.init();
        }, 500);
    },

    async login() {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const data = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            localStorage.setItem('sa_token', data.token);
            this.currentUser = data.user;
            this.showMainApp();
            this.toast('success', 'مرحباً! تم تسجيل الدخول بنجاح');
        } catch (e) {
            this.toast('error', e.message || 'خطأ في اسم المستخدم أو كلمة المرور');
        }
    },

    async employeeLogin() {
        const code = document.getElementById('emp-login-code').value.trim();
        if (!code) {
            this.toast('error', 'يرجى إدخال الرقم الوظيفي');
            return;
        }

        try {
            // Find employee by code from API
            const employees = await apiFetch('/employees');
            const emp = employees.find(e => e.code === code && e.status === 'active');
            if (!emp) {
                this.toast('error', 'الرقم الوظيفي غير موجود أو الموظف غير نشط');
                return;
            }

            // Create/login user account for employee if not exists
            try {
                const loginData = await apiFetch('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ username: code, password: code })
                });
                localStorage.setItem('sa_token', loginData.token);
                this.currentUser = loginData.user;
            } catch (e) {
                // If login fails, register first
                await apiFetch('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ username: code, password: code, name: emp.name, role: emp.role || 'employee', employee_id: emp.id })
                });
                const loginData = await apiFetch('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ username: code, password: code })
                });
                localStorage.setItem('sa_token', loginData.token);
                this.currentUser = loginData.user;
            }
            this.showMainApp();
            this.toast('success', `مرحباً ${emp.name}! تم تسجيل الدخول بنجاح`);
        } catch (e) {
            this.toast('error', e.message || 'خطأ في تسجيل الدخول');
        }
    },

    isAdmin() {
        return this.currentUser?.role === 'admin';
    },

    hasPermission(permission) {
        const role = this.currentUser?.role || 'employee';
        const permissions = {
            admin: ['dashboard', 'employees', 'attendance', 'face_auth', 'leaves', 'reports', 'backup', 'settings', 'employee_portal'],
            hr_manager: ['dashboard', 'employees', 'attendance', 'face_auth', 'leaves', 'reports', 'employee_portal'],
            supervisor: ['dashboard', 'attendance', 'face_auth', 'leaves', 'reports', 'employee_portal'],
            employee: ['employee_portal', 'face_auth']
        };
        return permissions[role]?.includes(permission) || false;
    },

    switchLoginMode(mode) {
        const isEmployee = mode === 'employee';
        document.getElementById('admin-login-form').classList.toggle('hidden', isEmployee);
        document.getElementById('employee-login-form').classList.toggle('hidden', !isEmployee);
        
        // Update tab styles
        const adminTab = document.getElementById('tab-admin');
        const empTab = document.getElementById('tab-employee');
        
        if (isEmployee) {
            empTab.style.background = 'var(--primary)';
            empTab.style.color = '#fff';
            adminTab.style.background = 'transparent';
            adminTab.style.color = 'var(--text-color)';
        } else {
            adminTab.style.background = 'var(--primary)';
            adminTab.style.color = '#fff';
            empTab.style.background = 'transparent';
            empTab.style.color = 'var(--text-color)';
        }
    },

    logout() {
        this.currentUser = null;
        localStorage.removeItem('sa_token');
        localStorage.removeItem('sa_user');
        location.reload();
    },

    showMainApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('user-name').textContent = this.currentUser?.name || 'مدير النظام';
        
        // Show/hide nav items based on role permissions
        const pagePermissions = {
            'dashboard': 'dashboard',
            'employees': 'employees',
            'attendance': 'attendance',
            'face-auth': 'face_auth',
            'leaves': 'leaves',
            'reports': 'reports',
            'backup': 'backup',
            'settings': 'settings',
            'employee-portal': 'employee_portal'
        };
        
        document.querySelectorAll('.nav-item').forEach(item => {
            const page = item.dataset.page;
            const permission = pagePermissions[page];
            if (permission) {
                item.classList.toggle('hidden', !this.hasPermission(permission));
            }
        });
        
        // Navigate to appropriate default page based on role
        if (this.hasPermission('dashboard')) {
            this.navigate('dashboard');
        } else if (this.hasPermission('employee_portal')) {
            this.navigate('employee-portal');
        } else {
            this.navigate('face-auth');
        }
    },

    navigate(page) {
        this.currentPage = page;
        
        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Show/hide pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`)?.classList.add('active');

        // Update title
        const titles = {
            dashboard: 'لوحة التحكم',
            employees: 'الموظفين',
            attendance: 'الحضور والانصراف',
            'face-auth': 'بصمة الوجه',
            leaves: 'الإجازات',
            reports: 'التقارير',
            backup: 'النسخ الاحتياطي',
            settings: 'الإعدادات',
            'employee-portal': 'بوابة الموظف'
        };
        document.getElementById('page-title').textContent = titles[page] || '';

        // Refresh page data
        if (page === 'dashboard') dashboard.refresh();
        if (page === 'employees') employees.refresh();
        if (page === 'attendance') attendance.refresh();
        if (page === 'face-auth') faceAuth.refresh();
        if (page === 'leaves') leaves.refresh();
        if (page === 'settings') settings.refresh();
        if (page === 'employee-portal') employeePortal.refresh();
    },

    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        document.getElementById('sidebar').classList.toggle('collapsed', this.sidebarCollapsed);
    },

    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        document.body.classList.toggle('dark-mode', this.darkMode);
        document.body.classList.toggle('light-mode', !this.darkMode);
        localStorage.setItem('sa_dark_mode', this.darkMode);
        document.getElementById('theme-icon').className = this.darkMode ? 'fas fa-sun' : 'fas fa-moon';
    },

    loadTheme() {
        const saved = localStorage.getItem('sa_dark_mode') === 'true';
        this.darkMode = saved;
        document.body.classList.toggle('dark-mode', saved);
        document.body.classList.toggle('light-mode', !saved);
        document.getElementById('theme-icon').className = saved ? 'fas fa-sun' : 'fas fa-moon';
    },

    updateDate() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const el = document.getElementById('current-date');
        if (el) el.textContent = now.toLocaleDateString('ar-SA', options);
    },

    toast(type, message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-circle' };
        toast.innerHTML = `
            <i class="fas fa-${icons[type] || 'info-circle'}"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },

    confirm(title, message, onConfirm) {
        if (window.confirm(message)) {
            onConfirm();
        }
    },

    showNotifications() {
        const count = parseInt(document.getElementById('notif-count').textContent);
        if (count === 0) {
            this.toast('info', 'لا توجد إشعارات جديدة');
        } else {
            this.toast('info', `لديك ${count} إشعارات جديدة`);
        }
    },

    globalSearch(query) {
        if (!query.trim()) return;
        const emp = storage.getEmployees().find(e => 
            e.name.includes(query) || e.code.includes(query) || e.phone?.includes(query)
        );
        if (emp) {
            app.navigate('employees');
            setTimeout(() => {
                document.getElementById('emp-search').value = query;
                employees.filter();
            }, 200);
        } else {
            this.toast('warning', 'لم يتم العثور على موظف مطابق');
        }
    },

    formatDate(date) {
        const d = new Date(date);
        return d.toLocaleDateString('ar-SA');
    },

    formatTime(date) {
        const d = new Date(date);
        return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    },

    formatDuration(hours) {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}س ${m}د`;
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },

    // Location / Geolocation Helpers
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('المتصفح لا يدعم تحديد الموقع الجغرافي'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
                (err) => {
                    const msgs = {
                        1: 'تم رفض إذن الوصول للموقع. يرجى السماح بالوصول من إعدادات المتصفح.',
                        2: 'تعذر تحديد الموقع. تأكد من تفعيل GPS.',
                        3: 'انتهى الوقت المخصص لتحديد الموقع.'
                    };
                    reject(new Error(msgs[err.code] || 'خطأ في تحديد الموقع'));
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        });
    },

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Earth radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // distance in meters
    },

    async checkLocation() {
        const config = storage.getLocationConfig();
        if (!config.enabled) {
            return { allowed: true, distance: 0, message: 'التحقق من الموقع معطل' };
        }
        if (config.lat == null || config.lng == null) {
            return { allowed: false, distance: null, message: 'لم يتم تحديد موقع المكتب بعد. اتصل بالمسؤول.' };
        }
        try {
            const pos = await this.getCurrentPosition();
            const distance = this.calculateDistance(pos.lat, pos.lng, config.lat, config.lng);
            if (distance <= config.radius) {
                return { allowed: true, distance: Math.round(distance), message: `أنت على بعد ${Math.round(distance)} متر من المكتب` };
            } else {
                return { allowed: false, distance: Math.round(distance), message: `أنت بعيد عن المكتب بمسافة ${Math.round(distance)} متر. الحد المسموح: ${config.radius} متر.` };
            }
        } catch (err) {
            return { allowed: false, distance: null, message: err.message };
        }
    }
};

/**
 * Storage Module - API Based
 */
const storage = {
    async getEmployees() {
        try { return await apiFetch('/employees'); } catch (e) { return []; }
    },

    async saveEmployee(employee) {
        if (employee.id) {
            return await apiFetch(`/employees/${employee.id}`, { method: 'PUT', body: JSON.stringify(employee) });
        } else {
            return await apiFetch('/employees', { method: 'POST', body: JSON.stringify(employee) });
        }
    },

    async deleteEmployee(id) {
        return await apiFetch(`/employees/${id}`, { method: 'DELETE' });
    },

    async getAttendance() {
        try { return await apiFetch('/attendance'); } catch (e) { return []; }
    },

    async getAttendanceFiltered(params = {}) {
        const qs = new URLSearchParams(params).toString();
        try { return await apiFetch(`/attendance?${qs}`); } catch (e) { return []; }
    },

    async saveAttendance(record) {
        // Use dedicated endpoints
        if (record.checkOut) {
            return await apiFetch('/attendance/checkout', { method: 'POST', body: JSON.stringify(record) });
        } else {
            return await apiFetch('/attendance/checkin', { method: 'POST', body: JSON.stringify(record) });
        }
    },

    async deleteAttendance(id) {
        return await apiFetch(`/attendance/${id}`, { method: 'DELETE' });
    },

    async getLeaves() {
        try { return await apiFetch('/leaves'); } catch (e) { return []; }
    },

    async saveLeave(leave) {
        return await apiFetch('/leaves', { method: 'POST', body: JSON.stringify(leave) });
    },

    async getSettings() {
        try { return await apiFetch('/settings'); } catch (e) { return {}; }
    },

    async getLocationConfig() {
        try {
            return await apiFetch('/settings/location');
        } catch (e) {
            return { enabled: false, lat: null, lng: null, radius: 500, name: 'المكتب الرئيسي' };
        }
    },

    async saveLocationConfig(config) {
        return await apiFetch('/settings/location', { method: 'PUT', body: JSON.stringify(config) });
    },

    async getEmployeeAttendance(employeeId, from, to) {
        const params = { employee_id: employeeId };
        if (from) params.from = from;
        if (to) params.to = to;
        return this.getAttendanceFiltered(params);
    },

    async getTodayAttendance() {
        try { return await apiFetch('/attendance/today'); } catch (e) { return []; }
    },

    async exportAll() {
        const [employees, attendance, leaves] = await Promise.all([
            this.getEmployees(),
            this.getAttendance(),
            this.getLeaves()
        ]);
        return { employees, attendance, leaves, exportedAt: new Date().toISOString() };
    },

    async importAll(data) {
        // Re-import by creating records one by one
        if (data.employees) {
            for (const emp of data.employees) {
                await this.saveEmployee(emp);
            }
        }
        return { message: 'تم الاستيراد' };
    },

    async reset() {
        // Admin only - handled server-side if needed
        return { message: 'تم إعادة التعيين' };
    },

    getDepartments() {
        return ['IT', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations'];
    }
};

// Initialize app on load
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

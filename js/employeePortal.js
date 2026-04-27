/**
 * Employee Portal Module
 * بوابة الموظف - تسجيل الحضور والانصراف
 */

const employeePortal = {
    init() {
        this.refresh();
    },

    async refresh() {
        if (app.currentPage !== 'employee-portal') return;
        await this.loadEmployeeInfo();
        await this.loadAttendanceHistory();
    },

    async loadEmployeeInfo() {
        const allEmployees = await storage.getEmployees();
        const emp = allEmployees.find(e => e.id == app.currentUser?.employee_id);
        if (!emp) return;

        document.getElementById('emp-welcome-name').textContent = `مرحباً ${emp.name}!`;
        document.getElementById('emp-welcome-info').textContent = `${emp.department} - ${emp.position} | الرقم الوظيفي: ${emp.code}`;
    },

    async loadAttendanceHistory() {
        const tbody = document.getElementById('emp-attendance-history');
        if (!tbody) return;

        const records = (await storage.getEmployeeAttendance(app.currentUser?.employee_id))
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10); // Last 10 records

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا يوجد سجلات</td></tr>';
            return;
        }

        tbody.innerHTML = records.map(record => {
            const statusClass = `status-${record.status}`;
            const statusText = { present: 'حاضر', absent: 'غائب', late: 'متأخر' }[record.status] || record.status;

            return `
                <tr>
                    <td>${app.formatDate(record.date)}</td>
                    <td>${record.check_in ? app.formatTime(record.check_in) : '-'}</td>
                    <td>${record.check_out ? app.formatTime(record.check_out) : '-'}</td>
                    <td><span class="badge-status ${statusClass}">${statusText}</span></td>
                    <td>${record.hours ? app.formatDuration(record.hours) : '-'}</td>
                </tr>
            `;
        }).join('');
    },

    async checkIn() {
        // Check location first
        const loc = await app.checkLocation();
        if (!loc.allowed) {
            app.toast('error', loc.message);
            return;
        }

        const employeeId = app.currentUser?.employee_id;
        if (!employeeId) {
            app.toast('error', 'خطأ في تحديد الموظف');
            return;
        }

        const now = new Date();
        const status = now.getHours() > 8 ? 'late' : 'present';

        let pos = { lat: null, lng: null };
        try { pos = await app.getCurrentPosition(); } catch (e) {}

        try {
            await apiFetch('/attendance/checkin', {
                method: 'POST',
                body: JSON.stringify({
                    employee_id: parseInt(employeeId),
                    check_in: now.toISOString(),
                    status,
                    notes: 'تسجيل من بوابة الموظف',
                    location: loc.distance > 0 ? `على بعد ${loc.distance} متر` : 'المكتب الرئيسي',
                    lat: pos.lat,
                    lng: pos.lng
                })
            });
            await this.refresh();
            dashboard.refresh();
            app.toast('success', `تم تسجيل الحضور بنجاح! ${loc.message}`);
        } catch (e) {
            app.toast('error', e.message || 'خطأ في تسجيل الحضور');
        }
    },

    async checkOut() {
        // Check location first
        const loc = await app.checkLocation();
        if (!loc.allowed) {
            app.toast('error', loc.message);
            return;
        }

        const employeeId = app.currentUser?.employee_id;
        if (!employeeId) {
            app.toast('error', 'خطأ في تحديد الموظف');
            return;
        }

        const now = new Date();

        let pos = { lat: null, lng: null };
        try { pos = await app.getCurrentPosition(); } catch (e) {}

        try {
            await apiFetch('/attendance/checkout', {
                method: 'POST',
                body: JSON.stringify({
                    employee_id: parseInt(employeeId),
                    check_out: now.toISOString(),
                    location: loc.distance > 0 ? `على بعد ${loc.distance} متر` : 'المكتب الرئيسي',
                    lat: pos.lat,
                    lng: pos.lng
                })
            });
            await this.refresh();
            dashboard.refresh();
            app.toast('success', `تم تسجيل الانصراف بنجاح! ${loc.message}`);
        } catch (e) {
            app.toast('error', e.message || 'خطأ في تسجيل الانصراف');
        }
    }
};


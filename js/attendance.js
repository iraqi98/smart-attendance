/**
 * Attendance Module
 * تسجيل الحضور والانصراف
 */

const attendance = {
    currentAction: null, // 'checkin' or 'checkout'

    init() {
        this.refresh();
    },

    async refresh() {
        await this.renderTable();
        await this.populateEmployeeSelect();
    },

    async renderTable() {
        const tbody = document.getElementById('attendance-table');
        let records = await storage.getAttendance();
        const employees = await storage.getEmployees();

        const dateFilter = document.getElementById('att-date-filter')?.value;
        const statusFilter = document.getElementById('att-status-filter')?.value;

        if (dateFilter) {
            records = records.filter(r => r.date === dateFilter);
        }
        if (statusFilter) {
            records = records.filter(r => r.status === statusFilter);
        }

        // Sort by date desc
        records.sort((a, b) => new Date(b.date) - new Date(a.date));

        tbody.innerHTML = records.map(record => {
            const emp = employees.find(e => e.id == record.employee_id);
            if (!emp) return '';

            const statusClass = `status-${record.status}`;
            const statusText = { present: 'حاضر', absent: 'غائب', late: 'متأخر' }[record.status] || record.status;

            return `
                <tr>
                    <td>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=667eea&color=fff&size=32" 
                                 style="width:32px;height:32px;border-radius:50%;" alt="">
                            ${emp.name}
                        </div>
                    </td>
                    <td>${app.formatDate(record.date)}</td>
                    <td>${record.check_in ? app.formatTime(record.check_in) : '-'}</td>
                    <td>${record.check_out ? app.formatTime(record.check_out) : '-'}</td>
                    <td><span class="badge-status ${statusClass}">${statusText}</span></td>
                    <td>${record.hours ? app.formatDuration(record.hours) : '-'}</td>
                    <td>${record.location || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick="attendance.edit('${record.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="attendance.delete('${record.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">لا يوجد سجلات</td></tr>';
        }
    },

    async populateEmployeeSelect() {
        const select = document.getElementById('att-employee');
        if (select) {
            select.innerHTML = '<option value="">اختر الموظف</option>' + await employees.getSelectOptions();
        }
    },

    filter() {
        this.renderTable();
    },

    async quickCheckIn() {
        const loc = await app.checkLocation();
        if (!loc.allowed) {
            app.toast('error', loc.message);
            return;
        }
        this.currentAction = 'checkin';
        document.getElementById('att-modal-title').textContent = 'تسجيل حضور';
        document.getElementById('att-confirm-btn').textContent = 'تسجيل الحضور';
        document.getElementById('att-confirm-btn').className = 'btn btn-success';
        const now = new Date();
        document.getElementById('att-time').value = now.toTimeString().slice(0, 5);
        document.getElementById('attendance-modal').classList.add('active');
    },

    async quickCheckOut() {
        const loc = await app.checkLocation();
        if (!loc.allowed) {
            app.toast('error', loc.message);
            return;
        }
        this.currentAction = 'checkout';
        document.getElementById('att-modal-title').textContent = 'تسجيل انصراف';
        document.getElementById('att-confirm-btn').textContent = 'تسجيل الانصراف';
        document.getElementById('att-confirm-btn').className = 'btn btn-danger';
        const now = new Date();
        document.getElementById('att-time').value = now.toTimeString().slice(0, 5);
        document.getElementById('attendance-modal').classList.add('active');
    },

    async confirm() {
        const employeeId = document.getElementById('att-employee').value;
        if (!employeeId) {
            app.toast('error', 'يرجى اختيار الموظف');
            return;
        }

        const timeStr = document.getElementById('att-time').value;
        const notes = document.getElementById('att-notes').value;
        const now = new Date();
        const [hours, minutes] = timeStr.split(':');
        const dateStr = now.toISOString().split('T')[0];

        // Get location
        let pos = { lat: null, lng: null };
        try { pos = await app.getCurrentPosition(); } catch (e) {}

        if (this.currentAction === 'checkin') {
            const checkInTime = new Date(now);
            checkInTime.setHours(parseInt(hours), parseInt(minutes));
            const status = checkInTime.getHours() > 8 ? 'late' : 'present';

            try {
                await apiFetch('/attendance/checkin', {
                    method: 'POST',
                    body: JSON.stringify({
                        employee_id: parseInt(employeeId),
                        check_in: checkInTime.toISOString(),
                        status,
                        notes,
                        location: 'المكتب الرئيسي',
                        lat: pos.lat,
                        lng: pos.lng
                    })
                });
                app.toast('success', 'تم تسجيل الحضور بنجاح');
            } catch (e) {
                app.toast('error', e.message || 'خطأ في تسجيل الحضور');
                return;
            }

        } else if (this.currentAction === 'checkout') {
            const checkOutTime = new Date(now);
            checkOutTime.setHours(parseInt(hours), parseInt(minutes));

            try {
                await apiFetch('/attendance/checkout', {
                    method: 'POST',
                    body: JSON.stringify({
                        employee_id: parseInt(employeeId),
                        check_out: checkOutTime.toISOString(),
                        notes,
                        location: 'المكتب الرئيسي',
                        lat: pos.lat,
                        lng: pos.lng
                    })
                });
                app.toast('success', 'تم تسجيل الانصراف بنجاح');
            } catch (e) {
                app.toast('error', e.message || 'خطأ في تسجيل الانصراف');
                return;
            }
        }

        this.closeModal();
        await this.refresh();
        dashboard.refresh();
    },

    edit(id) {
        app.toast('info', 'استخدم نموذج الحضور/الانصراف لتعديل الوقت');
    },

    delete(id) {
        app.confirm('', 'هل أنت متأكد من حذف هذا السجل؟', async () => {
            try {
                await storage.deleteAttendance(id);
                await this.refresh();
                dashboard.refresh();
                app.toast('success', 'تم حذف السجل');
            } catch (e) {
                app.toast('error', e.message || 'خطأ في حذف السجل');
            }
        });
    },

    closeModal() {
        document.getElementById('attendance-modal').classList.remove('active');
        this.currentAction = null;
    }
};


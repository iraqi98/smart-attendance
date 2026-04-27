/**
 * Reports Module
 * التقارير والتصدير
 */

const reports = {
    async init() {
        await this.populateEmployees();
    },

    async populateEmployees() {
        const select = document.getElementById('report-employee');
        if (!select) return;
        
        select.innerHTML = '<option value="">كل الموظفين</option>';
        const employees = await storage.getEmployees();
        employees.forEach(emp => {
            select.innerHTML += `<option value="${emp.id}">${emp.name}</option>`;
        });
    },

    async generate() {
        const employeeId = document.getElementById('report-employee').value;
        const from = document.getElementById('report-from').value;
        const to = document.getElementById('report-to').value;

        if (!from || !to) {
            app.toast('error', 'يرجى تحديد الفترة الزمنية');
            return;
        }

        if (new Date(from) > new Date(to)) {
            app.toast('error', 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
            return;
        }

        document.getElementById('report-content').classList.remove('hidden');

        let records;
        if (employeeId) {
            records = await storage.getEmployeeAttendance(employeeId, from, to);
        } else {
            records = await storage.getAttendanceFiltered({ from, to });
        }

        const employees = await storage.getEmployees();
        const employee = employeeId ? employees.find(e => e.id == employeeId) : null;

        // Update report header
        document.getElementById('report-date').textContent = new Date().toLocaleDateString('ar-SA');
        document.getElementById('report-emp-name').textContent = employee ? employee.name : 'جميع الموظفين';
        document.getElementById('report-period').textContent = `${app.formatDate(from)} - ${app.formatDate(to)}`;

        // Calculate stats
        const workDays = records.filter(r => r.status !== 'absent').length;
        const present = records.filter(r => r.status === 'present').length;
        const absent = records.filter(r => r.status === 'absent').length;
        const late = records.filter(r => r.status === 'late').length;
        const totalHours = records.reduce((sum, r) => sum + (r.hours || 0), 0);

        document.getElementById('r-work-days').textContent = workDays;
        document.getElementById('r-present').textContent = present;
        document.getElementById('r-absent').textContent = absent;
        document.getElementById('r-late').textContent = late;
        document.getElementById('r-hours').textContent = app.formatDuration(totalHours);

        // Render table
        const tbody = document.getElementById('report-table');
        tbody.innerHTML = '';

        records.sort((a, b) => new Date(a.date) - new Date(b.date));

        records.forEach(record => {
            const emp = employees.find(e => e.id == record.employee_id);
            const statusClass = `status-${record.status}`;
            const statusText = { present: 'حاضر', absent: 'غائب', late: 'متأخر' }[record.status] || record.status;

            tbody.innerHTML += `
                <tr>
                    <td>${app.formatDate(record.date)}</td>
                    <td>${record.check_in ? app.formatTime(record.check_in) : '-'}</td>
                    <td>${record.check_out ? app.formatTime(record.check_out) : '-'}</td>
                    <td><span class="badge-status ${statusClass}">${statusText}</span></td>
                    <td>${record.hours ? app.formatDuration(record.hours) : '-'}</td>
                </tr>
            `;
        });

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد بيانات للفترة المحددة</td></tr>';
        }

        app.toast('success', 'تم إنشاء التقرير بنجاح');
    },

    exportPDF() {
        const element = document.querySelector('.report-card');
        if (!element || element.classList.contains('hidden')) {
            app.toast('error', 'يرجى إنشاء التقرير أولاً');
            return;
        }

        const opt = {
            margin: 10,
            filename: `attendance-report-${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save()
            .then(() => app.toast('success', 'تم تصدير PDF بنجاح'))
            .catch(() => app.toast('error', 'خطأ في تصدير PDF'));
    },

    async exportExcel() {
        const employeeId = document.getElementById('report-employee').value;
        const from = document.getElementById('report-from').value;
        const to = document.getElementById('report-to').value;

        if (!from || !to) {
            app.toast('error', 'يرجى تحديد الفترة الزمنية أولاً');
            return;
        }

        let records;
        if (employeeId) {
            records = await storage.getEmployeeAttendance(employeeId, from, to);
        } else {
            records = await storage.getAttendanceFiltered({ from, to });
        }

        const employees = await storage.getEmployees();

        const data = records.map(r => {
            const emp = employees.find(e => e.id == r.employee_id);
            return {
                'الموظف': emp?.name || '-',
                'التاريخ': r.date,
                'وقت الحضور': r.check_in ? app.formatTime(r.check_in) : '-',
                'وقت الانصراف': r.check_out ? app.formatTime(r.check_out) : '-',
                'الحالة': { present: 'حاضر', absent: 'غائب', late: 'متأخر' }[r.status] || r.status,
                'الساعات': r.hours || 0,
                'الملاحظات': r.notes || ''
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');

        // Auto-width
        const colWidths = [
            { wch: 25 }, // الموظف
            { wch: 12 }, // التاريخ
            { wch: 12 }, // وقت الحضور
            { wch: 12 }, // وقت الانصراف
            { wch: 10 }, // الحالة
            { wch: 10 }, // الساعات
            { wch: 30 }  // الملاحظات
        ];
        ws['!cols'] = colWidths;

        XLSX.writeFile(wb, `attendance-report-${from}-to-${to}.xlsx`);
        app.toast('success', 'تم تصدير Excel بنجاح');
    }
};


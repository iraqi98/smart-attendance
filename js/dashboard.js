/**
 * Dashboard Module
 * لوحة التحكم والإحصائيات
 */

const dashboard = {
    attendanceChart: null,
    departmentsChart: null,

    init() {
        this.refresh();
    },

    async refresh() {
        await this.updateStats();
        await this.updateTodayTable();
        this.renderCharts();
    },

    async updateStats() {
        const employees = await storage.getEmployees();
        const todayAttendance = await storage.getTodayAttendance();
        
        document.getElementById('total-employees').textContent = employees.length;
        document.getElementById('today-present').textContent = todayAttendance.filter(r => r.status === 'present').length;
        document.getElementById('today-absent').textContent = todayAttendance.filter(r => r.status === 'absent').length;
        document.getElementById('today-late').textContent = todayAttendance.filter(r => r.status === 'late').length;

        // Update notification badge
        const leaves = await storage.getLeaves();
        const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
        const notifCount = document.getElementById('notif-count');
        if (notifCount) {
            notifCount.textContent = pendingLeaves;
            notifCount.style.display = pendingLeaves > 0 ? 'block' : 'none';
        }
    },

    async updateTodayTable() {
        const tbody = document.getElementById('today-attendance-table');
        const todayRecords = await storage.getTodayAttendance();
        const employees = await storage.getEmployees();

        if (todayRecords.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">لا يوجد سجل حضور لليوم</td></tr>';
            return;
        }

        tbody.innerHTML = todayRecords.map(record => {
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
                    <td>${emp.department}</td>
                    <td>${record.check_in ? app.formatTime(record.check_in) : '-'}</td>
                    <td>${record.check_out ? app.formatTime(record.check_out) : '-'}</td>
                    <td><span class="badge-status ${statusClass}">${statusText}</span></td>
                    <td>${record.hours ? app.formatDuration(record.hours) : '-'}</td>
                </tr>
            `;
        }).join('');
    },

    renderCharts() {
        this.renderAttendanceChart();
        this.renderDepartmentsChart();
    },

    async renderAttendanceChart() {
        const ctx = document.getElementById('attendance-chart');
        if (!ctx) return;

        const attendance = await storage.getAttendance();
        const last7Days = [];
        const presentData = [];
        const absentData = [];
        const lateData = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayRecords = attendance.filter(r => r.date === dateStr);
            
            last7Days.push(date.toLocaleDateString('ar-SA', { weekday: 'short' }));
            presentData.push(dayRecords.filter(r => r.status === 'present').length);
            absentData.push(dayRecords.filter(r => r.status === 'absent').length);
            lateData.push(dayRecords.filter(r => r.status === 'late').length);
        }

        if (this.attendanceChart) {
            this.attendanceChart.destroy();
        }

        this.attendanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: last7Days,
                datasets: [
                    { label: 'حاضر', data: presentData, backgroundColor: '#48bb78', borderRadius: 6 },
                    { label: 'غائب', data: absentData, backgroundColor: '#f56565', borderRadius: 6 },
                    { label: 'متأخر', data: lateData, backgroundColor: '#ed8936', borderRadius: 6 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { family: 'Tajawal' } } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    x: { grid: { display: false } }
                }
            }
        });
    },

    async renderDepartmentsChart() {
        const ctx = document.getElementById('departments-chart');
        if (!ctx) return;

        const employees = await storage.getEmployees();
        const deptCounts = {};
        employees.forEach(emp => {
            deptCounts[emp.department] = (deptCounts[emp.department] || 0) + 1;
        });

        const colors = ['#667eea', '#764ba2', '#48bb78', '#ed8936', '#f56565', '#4299e1'];

        if (this.departmentsChart) {
            this.departmentsChart.destroy();
        }

        this.departmentsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(deptCounts),
                datasets: [{
                    data: Object.values(deptCounts),
                    backgroundColor: colors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { family: 'Tajawal' }, padding: 15 } }
                }
            }
        });
    },

    refreshChart() {
        this.renderCharts();
        app.toast('success', 'تم تحديث الرسوم البيانية');
    }
};


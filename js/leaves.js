/**
 * Leaves Module
 * طلبات الإجازات
 */

const leaves = {
    init() {
        this.refresh();
    },

    async refresh() {
        await this.renderTable();
        await this.populateEmployeeSelect();
    },

    async populateEmployeeSelect() {
        const select = document.getElementById('leave-employee');
        if (!select) return;
        select.innerHTML = '<option value="">اختر الموظف</option>' + await employees.getSelectOptions();
    },

    async renderTable() {
        const tbody = document.getElementById('leaves-table');
        let leaves = await storage.getLeaves();
        const employees = await storage.getEmployees();

        const statusFilter = document.getElementById('leave-status-filter')?.value;

        if (statusFilter) {
            leaves = leaves.filter(l => l.status === statusFilter);
        }

        leaves.sort((a, b) => new Date(b.from_date) - new Date(a.from_date));

        tbody.innerHTML = leaves.map(leave => {
            const emp = employees.find(e => e.id == leave.employee_id);
            if (!emp) return '';

            const statusClass = `status-${leave.status}`;
            const statusText = { pending: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض' }[leave.status] || leave.status;

            return `
                <tr>
                    <td>${emp.name}</td>
                    <td>${this.getLeaveTypeName(leave.type)}</td>
                    <td>${app.formatDate(leave.from_date)}</td>
                    <td>${app.formatDate(leave.to_date)}</td>
                    <td>${leave.days} يوم</td>
                    <td>${leave.reason || '-'}</td>
                    <td><span class="badge-status ${statusClass}">${statusText}</span></td>
                    <td>
                        ${leave.status === 'pending' ? `
                            <button class="btn btn-sm btn-success" onclick="leaves.approve('${leave.id}')" title="اعتماد">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="leaves.reject('${leave.id}')" title="رفض">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-danger" onclick="leaves.delete('${leave.id}')" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (leaves.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">لا توجد طلبات إجازة</td></tr>';
        }
    },

    filter() {
        this.renderTable();
    },

    openModal() {
        document.getElementById('leave-form').reset();
        this.updateDays();
        document.getElementById('leave-modal').classList.add('active');
    },

    updateDays() {
        const from = document.getElementById('leave-from').value;
        const to = document.getElementById('leave-to').value;

        if (from && to) {
            const d1 = new Date(from);
            const d2 = new Date(to);
            const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
            document.getElementById('leave-days').value = diff > 0 ? diff : 0;
        }
    },

    async save() {
        const employeeId = document.getElementById('leave-employee').value;
        const type = document.getElementById('leave-type').value;
        const from = document.getElementById('leave-from').value;
        const to = document.getElementById('leave-to').value;
        const days = parseInt(document.getElementById('leave-days').value) || 0;
        const reason = document.getElementById('leave-reason').value;

        if (!employeeId || !from || !to) {
            app.toast('error', 'يرجى ملء جميع الحقول المطلوبة');
            return;
        }

        if (new Date(from) > new Date(to)) {
            app.toast('error', 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
            return;
        }

        try {
            await storage.saveLeave({
                employee_id: parseInt(employeeId),
                type,
                from_date: from,
                to_date: to,
                days: days > 0 ? days : 1,
                reason
            });
            this.closeModal();
            await this.refresh();
            dashboard.refresh();
            app.toast('success', 'تم إرسال طلب الإجازة بنجاح');
        } catch (e) {
            app.toast('error', e.message || 'خطأ في إرسال الطلب');
        }
    },

    async approve(id) {
        try {
            await apiFetch(`/leaves/${id}/approve`, { method: 'PUT' });
            await this.refresh();
            dashboard.refresh();
            app.toast('success', 'تم اعتماد طلب الإجازة');
        } catch (e) {
            app.toast('error', e.message || 'خطأ في الاعتماد');
        }
    },

    async reject(id) {
        try {
            await apiFetch(`/leaves/${id}/reject`, { method: 'PUT' });
            await this.refresh();
            app.toast('success', 'تم رفض طلب الإجازة');
        } catch (e) {
            app.toast('error', e.message || 'خطأ في الرفض');
        }
    },

    delete(id) {
        app.confirm('', 'هل أنت متأكد من حذف هذا الطلب؟', async () => {
            try {
                await apiFetch(`/leaves/${id}`, { method: 'DELETE' });
                await this.refresh();
                dashboard.refresh();
                app.toast('success', 'تم حذف الطلب');
            } catch (e) {
                app.toast('error', e.message || 'خطأ في الحذف');
            }
        });
    },

    closeModal() {
        document.getElementById('leave-modal').classList.remove('active');
    },

    getLeaveTypeName(type) {
        const types = {
            annual: 'سنوية',
            sick: 'مرضية',
            emergency: 'طارئة',
            unpaid: 'بدون راتب'
        };
        return types[type] || type;
    }
};

// Auto-update days calculation
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('leave-from')?.addEventListener('change', () => leaves.updateDays());
        document.getElementById('leave-to')?.addEventListener('change', () => leaves.updateDays());
    }, 1000);
});


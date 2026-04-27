/**
 * Employees Module
 * إدارة الموظفين
 */

const employees = {
    currentEditId: null,

    init() {
        this.populateDepartmentFilter();
        this.refresh();
    },

    async refresh() {
        await this.renderTable();
        this.populateDepartmentFilter();
    },

    populateDepartmentFilter() {
        const select = document.getElementById('dept-filter');
        const empDept = document.getElementById('emp-department');
        const departments = storage.getDepartments();
        
        if (select) {
            select.innerHTML = '<option value="">كل الأقسام</option>';
            departments.forEach(d => {
                select.innerHTML += `<option value="${d}">${d}</option>`;
            });
        }

        if (empDept && !empDept.innerHTML.includes(departments[0])) {
            empDept.innerHTML = '<option value="">اختر القسم</option>';
            departments.forEach(d => {
                empDept.innerHTML += `<option value="${d}">${d}</option>`;
            });
        }
    },

    async renderTable() {
        const tbody = document.getElementById('employees-table');
        let employees = await storage.getEmployees();
        
        const deptFilter = document.getElementById('dept-filter')?.value;
        const search = document.getElementById('emp-search')?.value.toLowerCase();

        if (deptFilter) {
            employees = employees.filter(e => e.department === deptFilter);
        }
        if (search) {
            employees = employees.filter(e => 
                e.name.toLowerCase().includes(search) || 
                e.code.toLowerCase().includes(search)
            );
        }

        const roleLabels = {
            admin: 'مدير النظام',
            hr_manager: 'مدير موارد بشرية',
            supervisor: 'مشرف',
            employee: 'موظف'
        };

        tbody.innerHTML = employees.map((emp, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=667eea&color=fff&size=40" 
                         style="width:40px;height:40px;border-radius:50%;" alt="">
                </td>
                <td><strong>${emp.name}</strong></td>
                <td>${emp.code}</td>
                <td><span class="badge-status status-active">${emp.department}</span></td>
                <td>${emp.position}</td>
                <td>${roleLabels[emp.role] || emp.role || 'موظف'}</td>
                <td>${app.formatDate(emp.hire_date || emp.hireDate)}</td>
                <td>${emp.salary?.toLocaleString() || 0} ر.س</td>
                <td><span class="badge-status ${emp.status === 'active' ? 'status-active' : 'status-inactive'}">
                    ${emp.status === 'active' ? 'نشط' : 'غير نشط'}
                </span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="employees.edit('${emp.id}')" title="تعديل">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="employees.delete('${emp.id}')" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        if (employees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">لا يوجد موظفين</td></tr>';
        }
    },

    filter() {
        this.renderTable();
    },

    openModal() {
        this.currentEditId = null;
        document.getElementById('employee-form').reset();
        document.getElementById('emp-modal-title').textContent = 'إضافة موظف جديد';
        document.getElementById('employee-modal').classList.add('active');
    },

    async edit(id) {
        const allEmployees = await storage.getEmployees();
        const emp = allEmployees.find(e => e.id == id);
        if (!emp) return;

        this.currentEditId = id;
        document.getElementById('emp-id').value = emp.id;
        document.getElementById('emp-name').value = emp.name;
        document.getElementById('emp-code').value = emp.code;
        document.getElementById('emp-email').value = emp.email || '';
        document.getElementById('emp-phone').value = emp.phone || '';
        document.getElementById('emp-department').value = emp.department;
        document.getElementById('emp-role').value = emp.role || 'employee';
        document.getElementById('emp-position').value = emp.position;
        document.getElementById('emp-hire-date').value = emp.hire_date || emp.hireDate;
        document.getElementById('emp-salary').value = emp.salary || '';

        document.getElementById('emp-modal-title').textContent = 'تعديل بيانات الموظف';
        document.getElementById('employee-modal').classList.add('active');
    },

    async save() {
        const name = document.getElementById('emp-name').value.trim();
        const code = document.getElementById('emp-code').value.trim();
        const department = document.getElementById('emp-department').value;
        const role = document.getElementById('emp-role').value;
        const position = document.getElementById('emp-position').value.trim();
        const hireDate = document.getElementById('emp-hire-date').value;

        if (!name || !code || !department || !role || !position || !hireDate) {
            app.toast('error', 'يرجى ملء جميع الحقول المطلوبة');
            return;
        }

        const employee = {
            id: this.currentEditId,
            name,
            code,
            email: document.getElementById('emp-email').value.trim(),
            phone: document.getElementById('emp-phone').value.trim(),
            department,
            role,
            position,
            hire_date: hireDate,
            salary: parseFloat(document.getElementById('emp-salary').value) || 0,
            status: 'active',
            photo: null,
            faceDescriptor: null
        };

        try {
            await storage.saveEmployee(employee);
            this.closeModal();
            await this.refresh();
            dashboard.refresh();
            app.toast('success', this.currentEditId ? 'تم تحديث بيانات الموظف' : 'تم إضافة الموظف بنجاح');
        } catch (e) {
            app.toast('error', e.message || 'خطأ في حفظ الموظف');
        }
    },

    delete(id) {
        app.confirm('', 'هل أنت متأكد من حذف هذا الموظف؟ سيتم حذف جميع بياناته.', async () => {
            try {
                await storage.deleteEmployee(id);
                await this.refresh();
                dashboard.refresh();
                app.toast('success', 'تم حذف الموظف بنجاح');
            } catch (e) {
                app.toast('error', e.message || 'خطأ في حذف الموظف');
            }
        });
    },

    closeModal() {
        document.getElementById('employee-modal').classList.remove('active');
        this.currentEditId = null;
    },

    async getSelectOptions() {
        const employees = await storage.getEmployees();
        return employees.map(emp => 
            `<option value="${emp.id}">${emp.name} (${emp.code})</option>`
        ).join('');
    }
};


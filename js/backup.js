/**
 * Backup & Restore Module
 * النسخ الاحتياطي والاستعادة
 */

const backup = {
    init() {
        // Module initialized
    },

    async exportData() {
        try {
            const data = await storage.exportAll();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `smart-attendance-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            app.toast('success', 'تم تصدير البيانات بنجاح');
        } catch (e) {
            app.toast('error', e.message || 'خطأ في التصدير');
        }
    },

    importData() {
        const fileInput = document.getElementById('backup-file');
        const file = fileInput?.files[0];

        if (!file) {
            app.toast('error', 'يرجى اختيار ملف النسخة الاحتياطية');
            return;
        }

        app.confirm('', 'هل أنت متأكد من استيراد البيانات؟ سيتم استبدال جميع البيانات الحالية!', async () => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (!data.employees || !data.attendance) {
                        app.toast('error', 'ملف غير صالح أو تالف');
                        return;
                    }

                    await storage.importAll(data);
                    
                    // Refresh all modules
                    dashboard.refresh();
                    employees.refresh();
                    attendance.refresh();
                    faceAuth.refresh();
                    leaves.refresh();
                    reports.populateEmployees();

                    app.toast('success', 'تم استيراد البيانات بنجاح');
                    fileInput.value = '';
                } catch (err) {
                    console.error('Import error:', err);
                    app.toast('error', 'خطأ في قراءة الملف');
                }
            };

            reader.onerror = () => {
                app.toast('error', 'خطأ في قراءة الملف');
            };

            reader.readAsText(file);
        });
    },

    resetAll() {
        app.confirm('تحذير!', 'هل أنت متأكد من إعادة تعيين النظام؟ سيتم حذف جميع البيانات نهائياً ولا يمكن التراجع!', async () => {
            try {
                await storage.reset();
                localStorage.removeItem('sa_user');
                localStorage.removeItem('sa_dark_mode');
                app.toast('success', 'تم إعادة تعيين النظام');
                setTimeout(() => location.reload(), 1500);
            } catch (e) {
                app.toast('error', e.message || 'خطأ في إعادة التعيين');
            }
        });
    }
};


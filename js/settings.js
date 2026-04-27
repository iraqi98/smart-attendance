/**
 * Settings Module
 * إعدادات النظام
 */

const settings = {
    init() {
        this.refresh();
    },

    async refresh() {
        const config = await storage.getLocationConfig();
        
        // Update checkbox
        document.getElementById('loc-enabled').checked = config.enabled;
        
        // Show/hide config section
        document.getElementById('location-config').classList.toggle('hidden', !config.enabled);
        
        // Fill inputs
        document.getElementById('loc-lat').value = config.lat || '';
        document.getElementById('loc-lng').value = config.lng || '';
        document.getElementById('loc-radius').value = config.radius || 500;
        document.getElementById('loc-name').value = config.name || 'المكتب الرئيسي';
        
        // Update info display
        const infoEl = document.getElementById('location-info');
        if (config.enabled && config.lat != null && config.lng != null) {
            infoEl.classList.remove('hidden');
            document.getElementById('current-loc-name').textContent = config.name;
            document.getElementById('current-loc-coords').textContent = `${config.lat.toFixed(5)}, ${config.lng.toFixed(5)}`;
            document.getElementById('current-loc-radius').textContent = config.radius;
            document.getElementById('current-loc-status').textContent = 'مفعل';
            document.getElementById('current-loc-status').style.color = 'var(--success)';
        } else {
            infoEl.classList.add('hidden');
        }
    },

    toggleLocation() {
        const enabled = document.getElementById('loc-enabled').checked;
        document.getElementById('location-config').classList.toggle('hidden', !enabled);
    },

    async detectCurrentLocation() {
        const statusEl = document.getElementById('loc-status');
        statusEl.textContent = 'جاري تحديد الموقع...';
        
        try {
            const pos = await app.getCurrentPosition();
            document.getElementById('loc-lat').value = pos.lat.toFixed(5);
            document.getElementById('loc-lng').value = pos.lng.toFixed(5);
            statusEl.textContent = `تم تحديد الموقع بدقة ${Math.round(pos.accuracy)} متر`;
            statusEl.style.color = 'var(--success)';
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.style.color = 'var(--danger)';
        }
    },

    async saveLocation() {
        const config = {
            enabled: document.getElementById('loc-enabled').checked,
            lat: parseFloat(document.getElementById('loc-lat').value) || null,
            lng: parseFloat(document.getElementById('loc-lng').value) || null,
            radius: parseInt(document.getElementById('loc-radius').value) || 500,
            name: document.getElementById('loc-name').value.trim() || 'المكتب الرئيسي'
        };

        if (config.enabled && (config.lat == null || config.lng == null)) {
            app.toast('error', 'يرجى تحديد إحداثيات الموقع أولاً');
            return;
        }

        try {
            await storage.saveLocationConfig(config);
            await this.refresh();
            app.toast('success', 'تم حفظ إعدادات الموقع بنجاح');
        } catch (e) {
            app.toast('error', e.message || 'خطأ في الحفظ');
        }
    }
};


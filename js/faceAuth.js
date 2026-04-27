/**
 * Face Authentication Module
 * بصمة الوجه للحضور والانصراف
 */

const faceAuth = {
    video: null,
    canvas: null,
    stream: null,
    modelsLoaded: false,

    async init() {
        this.video = document.getElementById('face-video');
        this.canvas = document.getElementById('face-canvas');
        
        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model');
            await faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model');
            await faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model');
            this.modelsLoaded = true;
            console.log('Face API models loaded');
        } catch (e) {
            console.warn('Face API models failed to load, using simulation mode');
            this.modelsLoaded = false;
        }

        this.refresh();
    },

    async refresh() {
        await this.renderRegisteredFaces();
    },

    async renderRegisteredFaces() {
        const container = document.getElementById('faces-list');
        const employees = await storage.getEmployees();
        const registered = employees.filter(e => e.face_descriptor);

        if (registered.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">لا يوجد موظفين مسجلين ببصمة الوجه</p>';
            return;
        }

        container.innerHTML = registered.map(emp => `
            <div class="face-item">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=667eea&color=fff&size=45" alt="">
                <div class="face-info">
                    <h4>${emp.name}</h4>
                    <p>${emp.department} - ${emp.position}</p>
                </div>
                <button class="btn btn-sm btn-danger" onclick="faceAuth.removeFace('${emp.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    },

    async startCamera() {
        document.getElementById('face-status').textContent = 'جاري تشغيل الكاميرا...';
        
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user', width: 640, height: 480 } 
            });
            this.video.srcObject = this.stream;
            this.video.style.display = 'block';
            document.getElementById('face-overlay').style.background = 'transparent';

            document.getElementById('btn-start-camera').classList.add('hidden');
            document.getElementById('btn-capture').classList.remove('hidden');
            document.getElementById('btn-stop-camera').classList.remove('hidden');
            document.getElementById('face-status').textContent = 'ضع وجهك في الإطار ثم اضغط "تسجيل الحضور"';

            // Start face detection loop
            if (this.modelsLoaded) {
                this.detectFaces();
            }
        } catch (err) {
            console.error('Camera error:', err);
            document.getElementById('face-status').textContent = 'لا يمكن الوصول للكاميرا. يرجى السماح بالوصول.';
            app.toast('error', 'خطأ في الوصول للكاميرا');
        }
    },

    async detectFaces() {
        if (!this.stream) return;

        const detections = await faceapi.detectAllFaces(this.video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        const canvas = faceapi.createCanvasFromMedia(this.video);
        faceapi.draw.drawDetections(this.canvas, detections);

        if (detections.length > 0) {
            document.getElementById('face-status').textContent = `تم العثور على ${detections.length} وجه`;
        }

        if (this.stream) {
            requestAnimationFrame(() => this.detectFaces());
        }
    },

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.video.srcObject = null;
        this.video.style.display = 'none';
        document.getElementById('face-overlay').style.background = 'rgba(0,0,0,0.3)';
        document.getElementById('face-status').textContent = 'اضغط "تشغيل الكاميرا" للبدء';

        document.getElementById('btn-start-camera').classList.remove('hidden');
        document.getElementById('btn-capture').classList.add('hidden');
        document.getElementById('btn-stop-camera').classList.add('hidden');
    },

    async capture() {
        if (!this.stream) return;

        document.getElementById('face-status').textContent = 'جاري تحليل الوجه...';

        try {
            if (this.modelsLoaded) {
                const detections = await faceapi.detectAllFaces(this.video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptors();

                if (detections.length === 0) {
                    document.getElementById('face-status').textContent = 'لم يتم العثور على وجه. حاول مرة أخرى.';
                    return;
                }

                if (detections.length > 1) {
                    document.getElementById('face-status').textContent = 'يوجد أكثر من وجه واحد. يرجى الاقتراب.';
                    return;
                }

                const descriptor = detections[0].descriptor;
                const matchedEmployee = await this.matchFace(descriptor);

                if (matchedEmployee) {
                    await this.recordAttendance(matchedEmployee);
                    document.getElementById('face-status').textContent = `تم التعرف على: ${matchedEmployee.name}`;
                    app.toast('success', `تم تسجيل الحضور: ${matchedEmployee.name}`);
                } else {
                    document.getElementById('face-status').textContent = 'وجه غير معروف. يرجى التسجيل أولاً.';
                    app.toast('warning', 'لم يتم التعرف على الوجه');
                }
            } else {
                // Simulation mode - for demo without camera/models
                this.simulateFaceRecognition();
            }
        } catch (err) {
            console.error('Face recognition error:', err);
            app.toast('error', 'خطأ في التعرف على الوجه');
        }
    },

    async matchFace(descriptor) {
        const employees = await storage.getEmployees();
        const registered = employees.filter(e => e.face_descriptor);
        let bestMatch = null;
        let bestDistance = Infinity;

        for (const emp of registered) {
            const distance = faceapi.euclideanDistance(descriptor, new Float32Array(JSON.parse(emp.face_descriptor)));
            if (distance < 0.6 && distance < bestDistance) {
                bestDistance = distance;
                bestMatch = emp;
            }
        }

        return bestMatch;
    },

    async recordAttendance(employee) {
        // Check location restriction first
        const locCheck = await app.checkLocation();
        if (!locCheck.allowed) {
            app.toast('error', locCheck.message);
            return;
        }

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];

        // Try to get actual GPS coordinates for the record
        let pos = { lat: null, lng: null };
        try { pos = await app.getCurrentPosition(); } catch (e) {}

        let locationStr = 'المكتب الرئيسي';
        if (pos.lat != null) {
            locationStr = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
        }

        // Check if already checked in
        const existing = (await storage.getAttendance()).find(r => 
            r.employee_id == employee.id && r.date === dateStr
        );

        if (existing && !existing.check_out) {
            // Check out
            try {
                await apiFetch('/attendance/checkout', {
                    method: 'POST',
                    body: JSON.stringify({
                        employee_id: employee.id,
                        check_out: now.toISOString(),
                        location: locationStr,
                        lat: pos.lat,
                        lng: pos.lng
                    })
                });
                app.toast('success', `تم تسجيل الانصراف: ${employee.name}`);
            } catch (e) {
                app.toast('error', e.message || 'خطأ في تسجيل الانصراف');
            }
        } else if (!existing) {
            // Check in
            const status = now.getHours() > 8 ? 'late' : 'present';
            try {
                await apiFetch('/attendance/checkin', {
                    method: 'POST',
                    body: JSON.stringify({
                        employee_id: employee.id,
                        check_in: now.toISOString(),
                        status,
                        notes: 'تسجيل ببصمة الوجه',
                        location: locationStr,
                        lat: pos.lat,
                        lng: pos.lng
                    })
                });
                app.toast('success', `تم تسجيل الحضور: ${employee.name}`);
            } catch (e) {
                app.toast('error', e.message || 'خطأ في تسجيل الحضور');
            }
        } else {
            app.toast('warning', 'تم تسجيل الحضور والانصراف مسبقاً اليوم');
        }

        dashboard.refresh();
    },

    async simulateFaceRecognition() {
        // Demo mode when models/camera not available
        const employees = await storage.getEmployees();
        const randomEmp = employees[Math.floor(Math.random() * employees.length)];
        
        if (randomEmp) {
            document.getElementById('face-status').textContent = `تم التعرف على: ${randomEmp.name} (وضع تجريبي)`;
            await this.recordAttendance(randomEmp);
        }
    },

    async registerFace(employeeId) {
        if (!this.stream) {
            app.toast('error', 'شغل الكاميرا أولاً');
            return;
        }

        if (!this.modelsLoaded) {
            app.toast('error', 'نماذج التعرف غير محملة');
            return;
        }

        const detections = await faceapi.detectAllFaces(this.video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        if (detections.length === 0) {
            app.toast('error', 'لم يتم العثور على وجه');
            return;
        }

        try {
            const allEmployees = await storage.getEmployees();
            const emp = allEmployees.find(e => e.id == employeeId);
            if (emp) {
                // Update employee with face descriptor - need API endpoint
                emp.face_descriptor = JSON.stringify(Array.from(detections[0].descriptor));
                await apiFetch(`/employees/${emp.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(emp)
                });
                await this.refresh();
                app.toast('success', 'تم تسجيل بصمة الوجه بنجاح');
            }
        } catch (e) {
            app.toast('error', e.message || 'خطأ في تسجيل الوجه');
        }
    },

    async removeFace(employeeId) {
        app.confirm('', 'هل تريد حذف بصمة الوجه؟', async () => {
            try {
                const allEmployees = await storage.getEmployees();
                const emp = allEmployees.find(e => e.id == employeeId);
                if (emp) {
                    emp.face_descriptor = null;
                    await apiFetch(`/employees/${emp.id}`, {
                        method: 'PUT',
                        body: JSON.stringify(emp)
                    });
                    await this.refresh();
                    app.toast('success', 'تم حذف بصمة الوجه');
                }
            } catch (e) {
                app.toast('error', e.message || 'خطأ في الحذف');
            }
        });
    }
};


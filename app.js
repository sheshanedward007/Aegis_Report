const app = {
    state: {
        currentUser: null,
        reports: [],
        view: 'register-view' // Default
    },
    deferredPrompt: null, // Store prompt here



    currentLocation: null,
    init: async function () {
        try {
            await db.init();
        } catch (e) {
            console.error("DB Init failed", e);
        }

        await this.loadState();
        this.checkAuth();
        this.bindEvents();
        this.checkConnection();
        this.getGeolocation();


        // Register SW
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js');
        }
    },

    loadState: async function () {
        try {
            const user = localStorage.getItem('aegis_user');
            if (user) this.state.currentUser = JSON.parse(user);

            // Load reports from IndexedDB
            const loadedReports = await db.getReports();
            // Ensure Newest First (Sort by ID desc)
            this.state.reports = loadedReports.sort((a, b) => b.id - a.id);
            this.renderMyReports(); // Refresh UI
        } catch (e) {
            console.error("Error loading state", e);
            // localStorage.clear(); // Removing this as it might wipe user session unnecessarily
        }
    },

    checkAuth: function () {
        if (this.state.currentUser) {
            this.showDashboard();
        } else {
            this.showView('register-view');
        }
    },

    bindEvents: function () {
        // Registration
        const regForm = document.getElementById('register-form');
        if (regForm) {
            regForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAuth();
            });
        }

        // New Report
        const incidentForm = document.getElementById('incident-form');
        if (incidentForm) {
            incidentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitReport();
            });
        }

        // Severity Slider
        const severityInput = document.getElementById('severity');
        if (severityInput) {
            severityInput.addEventListener('input', (e) => {
                this.updateSeverityDisplay(e.target.value);
            });
            // Init default state
            this.updateSeverityDisplay(severityInput.value);
        }

        // PWA Install Logic
        const installBtn = document.getElementById('pwa-install-btn');

        // Check if event fired before this ran
        if (this.deferredPrompt && installBtn) {
            installBtn.style.display = 'flex';
        }

        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (this.deferredPrompt) {
                    this.deferredPrompt.prompt();
                    const { outcome } = await this.deferredPrompt.userChoice;
                    console.log(`User response to the install prompt: ${outcome}`);
                    this.deferredPrompt = null;
                    installBtn.style.display = 'none'; // Hide after use
                }
            });
        }

        // Expose for onclick handlers in HTML
        window.app = this;
    },

    // --- Auth Logic ---
    authMode: 'register',

    toggleAuthMode: function () {
        this.authMode = this.authMode === 'register' ? 'login' : 'register';

        const isLogin = this.authMode === 'login';
        const formTitle = document.querySelector('.auth-card h2');
        const formDesc = document.querySelector('.auth-card p');
        const emailGroup = document.getElementById('group-email');
        const confirmGroup = document.getElementById('group-confirm');
        const submitBtn = document.getElementById('auth-submit-btn');
        const toggleLink = document.querySelector('.auth-card p a');
        const toggleText = document.getElementById('auth-toggle-text');

        // UI Updates
        if (formTitle) formTitle.textContent = isLogin ? 'Welcome Back' : 'Incident Reporting System';
        if (formDesc) formDesc.textContent = isLogin ? 'Login to continue' : 'Register to report incidents';

        if (emailGroup) emailGroup.style.display = isLogin ? 'none' : 'block';
        if (confirmGroup) confirmGroup.style.display = isLogin ? 'none' : 'block';

        // Remove 'required' attributes when hidden to avoid form validation blocking
        document.getElementById('reg-email').required = !isLogin;
        document.getElementById('reg-password-confirm').required = !isLogin;

        if (submitBtn) submitBtn.textContent = isLogin ? 'Login' : 'Register';

        if (toggleText) toggleText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
        if (toggleLink) toggleLink.textContent = isLogin ? 'Register' : 'Login';
    },

    handleAuth: function () {
        if (this.authMode === 'register') {
            this.register();
        } else {
            this.login();
        }
    },

    register: async function () {
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value.trim();
        const confirmPassword = document.getElementById('reg-password-confirm').value.trim();

        if (!username || !email || !password || !confirmPassword) {
            this.showToast('Please fill in all fields');
            return;
        }

        if (password.length !== 8 || !/^\d+$/.test(password)) {
            this.showToast('PIN must be exactly 8 digits');
            return;
        }

        if (password !== confirmPassword) {
            this.showToast('PINs do not match');
            return;
        }

        const user = { username, email, password, joined: new Date().toISOString() };

        try {
            await db.addUser(user);
            this.state.currentUser = user;
            localStorage.setItem('aegis_user', JSON.stringify(user));
            this.showToast('Registration Successful!');
            this.showDashboard();
        } catch (e) {
            console.error("Registration error", e);
            this.showToast('Registration failed. Username might be taken.');
        }
    },

    login: async function () {
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value.trim();

        if (!username || !password) {
            this.showToast('Please enter username and PIN');
            return;
        }

        try {
            const user = await db.getUser(username);

            if (user && user.password === password) {
                this.state.currentUser = user;
                localStorage.setItem('aegis_user', JSON.stringify(user));
                this.showToast('Login Successful!');
                this.showDashboard();
            } else {
                this.showToast('Invalid Username or PIN');
            }
        } catch (e) {
            console.error("Login error", e);
            this.showToast('Login failed. Please try again.');
        }
    },

    logout: function () {
        this.state.currentUser = null;
        localStorage.removeItem('aegis_user');
        this.showView('register-view');

        // Clear input fields
        document.getElementById('reg-username').value = '';
        document.getElementById('reg-email').value = '';
        document.getElementById('reg-password').value = '';
        document.getElementById('reg-password-confirm').value = '';
    },

    // --- Navigation & UI ---
    showView: function (viewId) {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        const target = document.getElementById(viewId);
        if (target) target.classList.add('active');
    },

    showDashboard: function () {
        const user = this.state.currentUser;
        if (!user) {
            this.logout();
            return;
        }

        // Update Header
        const nameEl = document.getElementById('display-name');
        const avatarEl = document.getElementById('user-avatar');

        if (nameEl) nameEl.textContent = user.username;
        if (avatarEl) avatarEl.textContent = user.username.charAt(0).toUpperCase();

        this.showView('dashboard-view');
        this.switchTab('new-report'); // Default tab
    },

    switchTab: function (tabName) {
        // Tabs UI
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = Array.from(document.querySelectorAll('.tab-btn'))
            .find(btn => btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName));
        if (activeBtn) activeBtn.classList.add('active');

        // Content UI
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
        const target = document.getElementById(`tab-${tabName}`);
        if (target) {
            target.style.display = 'block';
            if (tabName === 'my-reports') this.renderMyReports();
        }
    },

    // --- Report Logic ---
    updateSeverityDisplay: function (val) {
        const el = document.getElementById('severity-val');
        if (!el) return;

        let text = val;
        let color = '#10B981'; // Default Green

        // 1 & 2 = Low (Green)
        if (val <= 2) {
            text += ' - Low';
            color = '#10B981';
        }
        // 3 = Medium (Yellow/Orange)
        else if (val == 3) {
            text += ' - Medium';
            color = '#F59E0B';
        }
        // 4 & 5 = Critical (Red)
        else {
            text += ' - Critical';
            color = '#EF4444';
        }

        el.textContent = text;
        el.style.color = color;
        el.style.fontWeight = 'bold';
    },

    // --- Helper ---
    fileToBase64: function (file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    },

    // --- Report Logic ---
    submitReport: async function () {
        // SECURITY CHECK: Ensure user is logged in
        if (!this.state.currentUser) {
            this.showToast('You must be registered to submit reports!');
            this.showView('register-view');
            return;
        }

        const submitBtn = document.querySelector('#incident-form .btn-primary');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }

        const typeEl = document.querySelector('input[name="type"]:checked');
        const sev = document.getElementById('severity').value;
        const notes = document.getElementById('notes').value;
        const fileInput = document.getElementById('photo-input');
        const file = fileInput && fileInput.files[0];

        if (!typeEl) {
            this.showToast('Please select an incident type');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Report';
            }
            return;
        }

        let imageBase64 = null;
        if (file) {
            try {
                imageBase64 = await this.fileToBase64(file);
            } catch (e) {
                console.error("Error converting image", e);
                this.showToast('Error attaching image');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit Report';
                }
                return;
            }
        }

        const report = {
            id: Date.now(),
            type: typeEl.value,
            severity: sev,
            notes: notes,
            image: imageBase64,
            status: 'pending',
            syncStatus: 'pending_sync', // ← FIXED: Always start as pending_sync
            reporter: this.state.currentUser.username,
            coords: this.state.currentLocation || { latitude: 0, longitude: 0 },
            timestamp: new Date().toISOString(),
            formattedDate: new Date().toLocaleString()
        };

        try {
            // Save to IndexedDB first
            await db.addReport(report);

            // Update State
            this.state.reports.unshift(report);
            this.state.reports.sort((a, b) => b.id - a.id);

            // --- FIRESTORE SYNC ---
            console.log('🔍 Checking Firestore sync...');
            console.log('Online?', navigator.onLine);
            console.log('Firestore exists?', typeof window.firestore !== 'undefined');

            if (navigator.onLine && typeof window.firestore !== 'undefined') {
                console.log('🚀 Attempting Firestore save...');
                try {
                    await window.firestore.collection('reports').doc(report.id.toString()).set({
                        type: report.type,
                        severity: report.severity,
                        notes: report.notes,
                        image: report.image || null,
                        status: report.status,
                        reporter: report.reporter,
                        coords: report.coords,
                        timestamp: report.timestamp,
                        formattedDate: report.formattedDate
                    });
                    console.log('✅ Firestore save SUCCESS!');

                    // Update sync status AFTER successful save
                    report.syncStatus = 'synced';
                    await db.updateReport(report);

                    this.showToast('Report Submitted Successfully');
                } catch (e) {
                    console.error("❌ Firestore save failed:", e);
                    report.syncStatus = 'pending_sync';
                    this.showToast('Saved locally. Will sync when online.');
                }
            } else {
                console.log('⚠️ Skipping Firestore - offline or firestore undefined');
                this.showToast('Saved to local storage successfully');
            }

            // Reset form
            document.getElementById('incident-form').reset();
            document.getElementById('severity-val').textContent = '3';
            if (fileInput) fileInput.value = '';

            // Auto switch to list
            setTimeout(() => this.switchTab('my-reports'), 500);

        } catch (e) {
            console.error("Error submitting report", e);
            this.showToast('Failed to save report. Please try again.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Report';
            }
        }
    },

    renderMyReports: function () {
        const container = document.getElementById('reports-list');
        const reports = this.state.reports;

        if (!container) return;

        if (reports.length === 0) {
            container.innerHTML = `<div class="empty-state" style="text-align:center; color:var(--text-muted); padding:2rem;">No reports submitted yet.</div>`;
            return;
        }

        container.innerHTML = reports.map(r => {
            // Determine Color & Icon based on Type
            let iconColor = '#6B7280';
            let iconText = '📄';

            switch (r.type) {
                case 'Floods': iconColor = '#3B82F6'; iconText = '🌊'; break; // Blue
                case 'Landslide': iconColor = '#D97706'; iconText = '⛰️'; break; // Amber
                case 'Fire': iconColor = '#EF4444'; iconText = '🔥'; break; // Red
                case 'Power Line': iconColor = '#F59E0B'; iconText = '⚡'; break; // Orange
            }

            // Severity text
            let sevText = 'Low';
            let statusColor = '#10B981'; // Green
            const severity = parseInt(r.severity);

            if (severity <= 2) {
                sevText = `${severity} - Low`;
                statusColor = '#10B981'; // Green
            } else if (severity == 3) {
                sevText = `${severity} - Medium`;
                statusColor = '#F59E0B'; // Yellow/Orange
            } else {
                sevText = `${severity} - Critical`;
                statusColor = '#EF4444'; // Red
            }

            // Location Text
            const locText = (r.coords && r.coords.latitude)
                ? `${r.coords.latitude.toFixed(4)}, ${r.coords.longitude.toFixed(4)}`
                : 'Unknown Location';

            return `
            <div class="report-card">
                <div class="report-icon" style="background: ${iconColor}20; color: ${iconColor};">
                    ${iconText}
                </div>
                <div class="report-content">
                    <div class="report-header">
                        <div>
                            <h4>${r.type}</h4>
                            <div class="report-date">
                                <span>📅</span> ${r.formattedDate}
                            </div>
                             <div class="report-date" style="font-size:0.75rem;">
                                <span>📍</span> ${locText}
                            </div>
                        </div>
                        <div class="status-badge" style="color: ${statusColor}">
                            <div class="status-dot" style="background: ${statusColor}"></div>
                            ${sevText}
                        </div>
                    </div>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">
                        ${r.notes || "No additional notes provided."}
                    </p>
                    ${r.image ? `<img src="${r.image}" style="width:100%; height:auto; border-radius:8px; margin-top:10px; object-fit:cover; max-height:200px;" alt="Report Image">` : ''}

                     <div style="margin-top:0.5rem; font-size:0.8rem; font-weight:600; color: ${r.syncStatus === 'synced' ? '#10B981' : '#F59E0B'}">
                        ${r.syncStatus === 'synced' ? '✅ Delivered' : '⏳ Waiting for connection...'}
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    showToast: function (msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = msg;
        toast.style.opacity = '1';
        setTimeout(() => toast.style.opacity = '0', 3000);
    },

    // --- Network & Location ---
    checkConnection: function () {
        window.addEventListener('online', () => this.updateStatus(true));
        window.addEventListener('offline', () => this.updateStatus(false));
        this.updateStatus(navigator.onLine);
    },

    getGeolocation: function () {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.state.currentLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };
                    console.log("Location detected:", this.state.currentLocation);
                },
                (error) => {
                    console.error("Error getting location:", error);
                    this.state.currentLocation = null;
                }
            );
        }
    },

    updateStatus: function (isOnline) {
        const header = document.querySelector('.app-header');
        if (!header) return;

        if (isOnline) {
            header.classList.remove('offline');
            header.classList.add('online');
            this.syncOfflineReports(); // Try to sync when back online
        } else {
            header.classList.remove('online');
            header.classList.add('offline');
            this.showToast('You are offline. Reports will be saved locally.');
        }
    },

    syncOfflineReports: async function () {
        // Find pending reports
        const pending = this.state.reports.filter(r => r.syncStatus === 'pending_sync');

        if (pending.length > 0) {
            this.showToast(`Syncing ${pending.length} offline reports...`);

            let syncedCount = 0;

            for (const report of pending) {
                try {

                    // Actual Firestore Sync
                    if (typeof window.firestore !== 'undefined') {
                        await window.firestore.collection('reports').doc(report.id.toString()).set({
                            type: report.type,
                            severity: report.severity,
                            notes: report.notes,
                            image: report.image || null,
                            status: report.status,
                            reporter: report.reporter,
                            coords: report.coords,
                            timestamp: report.timestamp,
                            formattedDate: report.formattedDate
                        });

                        report.syncStatus = 'synced';
                        await db.updateReport(report);
                        syncedCount++;
                        console.log(`Synced report ${report.id} to Firestore`);
                    } else {
                        console.warn("Firestore not initialized, cannot sync");
                    }
                } catch (e) {
                    console.error(`Failed to sync report ${report.id}`, e);
                }
            }

            if (syncedCount > 0) {
                // Refresh source of truth from DB
                const loadedReports = await db.getReports();
                this.state.reports = loadedReports.sort((a, b) => b.id - a.id);
                this.renderMyReports();
                this.showToast(`Reports delivered successfully!`);
            } else {
                this.showToast("Sync failed. Will retry later.");
            }
        }
    }
};

// Capture PWA install prompt early
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    app.deferredPrompt = e;
    // If UI is already ready, show button immediately
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'flex';
});

// Start App when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

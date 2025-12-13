const app = {
    state: {
        currentUser: null,
        reports: [],
        view: 'register-view' // Default
    },
    deferredPrompt: null, // Store prompt here

    init: function () {
        this.loadState();
        this.checkAuth();
        this.bindEvents();
        this.checkConnection();
        this.getGeolocation();


        // Register SW
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js');
        }
    },

    loadState: function () {
        try {
            const user = localStorage.getItem('aegis_user');
            if (user) this.state.currentUser = JSON.parse(user);

            const reports = localStorage.getItem('aegis_reports');
            if (reports) this.state.reports = JSON.parse(reports);
        } catch (e) {
            console.error("Error loading state", e);
            localStorage.clear(); // Reset on corruption
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
                this.register();
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
    register: function () {
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
        this.state.currentUser = user;
        localStorage.setItem('aegis_user', JSON.stringify(user));
        this.showDashboard();
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
    submitReport: function () {
        // SECURITY CHECK: Ensure user is logged in
        if (!this.state.currentUser) {
            this.showToast('You must be registered to submit reports!');
            this.showView('register-view');
            return;
        }

        const typeEl = document.querySelector('input[name="type"]:checked');
        const sev = document.getElementById('severity').value;
        const notes = document.getElementById('notes').value;

        if (!typeEl) {
            this.showToast('Please select an incident type');
            return;
        }

        const report = {
            id: Date.now(),
            type: typeEl.value,
            severity: sev,
            notes: notes,
            status: 'pending', // pending, approved, resolved
            syncStatus: navigator.onLine ? 'synced' : 'pending_sync',
            reporter: this.state.currentUser.username,
            coords: this.state.currentLocation || { latitude: 0, longitude: 0 },
            timestamp: new Date().toISOString(),
            formattedDate: new Date().toLocaleString()
        };

        this.state.reports.unshift(report); // Add to top
        localStorage.setItem('aegis_reports', JSON.stringify(this.state.reports));

        this.showToast('Report Submitted Successfully');

        // Reset form
        document.getElementById('incident-form').reset();
        document.getElementById('severity-val').textContent = '3';

        // Auto switch to list
        setTimeout(() => this.switchTab('my-reports'), 500);
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

            if (severity >= 3) { sevText = 'Medium'; }
            if (severity >= 5) { sevText = 'Critical'; statusColor = '#EF4444'; }

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

    syncOfflineReports: function () {
        // Find pending reports
        const pending = this.state.reports.filter(r => r.syncStatus === 'pending_sync');

        if (pending.length > 0) {
            this.showToast(`Syncing ${pending.length} offline reports...`);

            // Simulate API delay
            setTimeout(() => {
                this.state.reports = this.state.reports.map(r => {
                    if (r.syncStatus === 'pending_sync') r.syncStatus = 'synced';
                    return r;
                });

                localStorage.setItem('aegis_reports', JSON.stringify(this.state.reports));
                this.renderMyReports();
                this.showToast('All reports delivered!');
            }, 1500);
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

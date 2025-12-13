const app = {
    state: {
        currentUser: null,
        reports: [],
        view: 'register-view' // Default
    },

    init: function () {
        this.loadState();
        this.checkAuth();
        this.bindEvents();
        this.checkConnection();

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
        let deferredPrompt;
        const installBtn = document.getElementById('pwa-install-btn');

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            if (installBtn) installBtn.style.display = 'flex'; // Show button
        });

        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log(`User response to the install prompt: ${outcome}`);
                    deferredPrompt = null;
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

        if (username && email) {
            const user = { username, email, joined: new Date().toISOString() };
            this.state.currentUser = user;
            localStorage.setItem('aegis_user', JSON.stringify(user));
            this.showDashboard();
        } else {
            this.showToast('Please fill in all fields');
        }
    },

    logout: function () {
        this.state.currentUser = null;
        localStorage.removeItem('aegis_user');
        this.showView('register-view');

        // Clear input fields
        document.getElementById('reg-username').value = '';
        document.getElementById('reg-email').value = '';
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
            reporter: this.state.currentUser.username, // Track who reported it
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
                        </div>
                        <div class="status-badge" style="color: ${statusColor}">
                            <div class="status-dot" style="background: ${statusColor}"></div>
                            ${sevText}
                        </div>
                    </div>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">
                        ${r.notes || "No additional notes provided."}
                    </p>
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

    // --- Network Status ---
    checkConnection: function () {
        window.addEventListener('online', () => this.updateStatus(true));
        window.addEventListener('offline', () => this.updateStatus(false));
        this.updateStatus(navigator.onLine);
    },

    updateStatus: function (isOnline) {
        const header = document.querySelector('.app-header');
        if (!header) return;

        if (isOnline) {
            header.classList.remove('offline');
            header.classList.add('online');
            // document.getElementById('header-status-text').textContent = "Online"; // Removed text, just color
        } else {
            header.classList.remove('online');
            header.classList.add('offline');
            // document.getElementById('header-status-text').textContent = "Offline"; 
            this.showToast('You are offline. Reports will be saved locally.');
        }
    }
};

// Start App when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

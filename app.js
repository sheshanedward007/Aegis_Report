const app = {
    // State
    currentView: 'home-view',
    gpsCoords: null,

    // Init
    init: function () {
        this.bindEvents();
        this.loadOfflineReports();
        this.checkConnection();
        this.getGeolocation(); // Try to get location on start

        // Mock dashboard data
        this.renderDashboard();
    },

    bindEvents: function () {
        // Navigation clicks are handled by onclick in HTML for simplicity, 
        // but we can add global listeners here if needed.

        // Form Submission
        document.getElementById('incident-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveReport();
        });

        // Online/Offline Listeners
        window.addEventListener('online', () => this.updateStatus(true));
        window.addEventListener('offline', () => this.updateStatus(false));

        // PWA Install Prompt
        let deferredPrompt;
        const installBtn = document.getElementById('install-btn');

        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            deferredPrompt = e;
            // Update UI to notify the user they can add to home screen
            installBtn.style.display = 'block';
        });

        installBtn.addEventListener('click', () => {
            // Hide the app provided install promotion
            installBtn.style.display = 'none';
            // Show the install prompt
            if (deferredPrompt) {
                deferredPrompt.prompt();
                // Wait for the user to respond to the prompt
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted the A2HS prompt');
                    } else {
                        console.log('User dismissed the A2HS prompt');
                    }
                    deferredPrompt = null;
                });
            }
        });
    },

    // --- Navigation ---
    showView: function (viewId) {
        // Hide all views
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        // Show target
        document.getElementById(viewId).classList.add('active');

        // Update Nav Active State
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        // Find the button that links to this view (simple matching)
        const navBtn = Array.from(document.querySelectorAll('.nav-item')).find(btn => btn.getAttribute('onclick').includes(viewId));
        if (navBtn) navBtn.classList.add('active');

        // Refresh lists if entering those views
        if (viewId === 'offline-view') this.loadOfflineReports();
    },

    // --- Geolocation ---
    getGeolocation: function () {
        const el = document.getElementById('gps-coords');
        el.textContent = "Locating...";

        if (!navigator.geolocation) {
            el.textContent = "GPS not supported";
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.gpsCoords = {
                    lat: pos.coords.latitude.toFixed(6),
                    lng: pos.coords.longitude.toFixed(6)
                };
                el.textContent = `${this.gpsCoords.lat}, ${this.gpsCoords.lng}`;
            },
            (err) => {
                el.textContent = "GPS Failed. Tap Retry.";
                console.error(err);
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    },

    // --- Data / LocalStorage ---
    saveReport: function () {
        const type = document.getElementById('incident-type').value;
        const severity = document.getElementById('severity').value;
        const notes = document.getElementById('notes').value;

        if (!type) {
            alert("Please select an incident type.");
            return;
        }

        const report = {
            id: Date.now(),
            type,
            severity,
            notes,
            coords: this.gpsCoords || { lat: '0', lng: '0' },
            timestamp: new Date().toLocaleString(),
            synced: false
        };

        // Save to LocalStorage
        const reports = JSON.parse(localStorage.getItem('aegis_reports') || '[]');
        reports.push(report);
        localStorage.setItem('aegis_reports', JSON.stringify(reports));

        // UI Feedback
        this.showToast("Saved offline");
        document.getElementById('incident-form').reset();
        document.getElementById('gps-coords').textContent = "Detecting location..."; // Reset GPS UI

        // Return to home or pending
        setTimeout(() => this.showView('offline-view'), 1000);
    },

    loadOfflineReports: function () {
        const reports = JSON.parse(localStorage.getItem('aegis_reports') || '[]');
        const container = document.getElementById('offline-list');

        if (reports.length === 0) {
            container.innerHTML = '<div class="empty-state">No pending reports.</div>';
            return;
        }

        container.innerHTML = reports.map(r => `
            <div class="card">
                <h3>${r.type} <small>(Lev ${r.severity})</small></h3>
                <p>📍 ${r.coords.lat}, ${r.coords.lng}</p>
                <p>📝 ${r.notes || "No notes"}</p>
                <div class="meta">
                    <span>${r.timestamp}</span>
                    <span style="color:orange">⚠ Pending</span>
                </div>
            </div>
        `).join('');
    },

    // --- Sync Logic ---
    syncReports: function () {
        const reports = JSON.parse(localStorage.getItem('aegis_reports') || '[]');

        if (reports.length === 0) {
            this.showToast("Nothing to sync");
            return;
        }

        if (!navigator.onLine) {
            this.showToast("You are offline!");
            return;
        }

        // Simulate API Sync
        const btn = document.querySelector('#offline-view .btn-small');
        btn.textContent = "Syncing...";
        btn.disabled = true;

        setTimeout(() => {
            // Success scenario
            console.log("Uploaded reports:", reports);

            // Clear LocalStorage
            localStorage.setItem('aegis_reports', '[]');

            // Refresh UI
            this.loadOfflineReports();
            this.showToast("Synced Successfully");
            btn.textContent = "🔄 Sync Now";
            btn.disabled = false;
        }, 2000);
    },

    updateStatus: function (isOnline) {
        const header = document.getElementById('main-header');
        const statusText = document.getElementById('header-status-text');
        const submitBtn = document.getElementById('submit-btn');

        if (isOnline) {
            header.classList.remove('offline');
            header.classList.add('online');
            statusText.textContent = "Online";

            if (submitBtn) {
                submitBtn.classList.remove('offline');
                submitBtn.classList.add('online');
            }
        } else {
            header.classList.remove('online');
            header.classList.add('offline');
            statusText.textContent = "Offline";

            if (submitBtn) {
                submitBtn.classList.remove('online');
                submitBtn.classList.add('offline');
            }
        }
    },

    checkConnection: function () {
        this.updateStatus(navigator.onLine);
    },

    // --- UI Utilities ---
    showToast: function (msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    renderDashboard: function () {
        const mockData = [
            { type: "Flood", sev: 5, time: "2 mins ago", loc: "River Bank" },
            { type: "RoadBlock", sev: 3, time: "1 hour ago", loc: "Main Hwy" },
            { type: "Fire", sev: 4, time: "3 hours ago", loc: "Sector 7" }
        ];

        document.getElementById('dashboard-list').innerHTML = mockData.map(d => `
            <div class="card" style="border-left-color: ${d.sev >= 4 ? 'red' : 'orange'}">
                <h3>${d.type}</h3>
                <p>${d.loc}</p>
                <div class="meta">
                    <span>${d.time}</span>
                    <span>✅ Active</span>
                </div>
            </div>
        `).join('');
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => app.init());

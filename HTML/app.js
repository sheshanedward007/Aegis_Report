// app.js
// Simple SPA navigation and offline storage handling for Project Aegis

(() => {
  const pages = document.querySelectorAll('.page');
  const navLinks = document.querySelectorAll('.nav-link');
  const sidebar = document.querySelector('.sidebar');

  // Helper to show a page
  function showPage(pageId) {
    pages.forEach(p => p.classList.toggle('active-page', p.id === pageId));
    navLinks.forEach(l => l.classList.toggle('active', l.dataset.page === pageId));
  }

  // Sidebar navigation click handling
  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = link.dataset.page;
      showPage(target);
      // Close sidebar on mobile after navigation
      if (window.innerWidth <= 768) sidebar.classList.remove('open');
    });
  });

  // Buttons inside cards that also navigate
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;
      showPage(target);
    });
  });

  // ---------- Incident Form ----------
  const form = document.getElementById('incident-form');
  const formMessage = document.getElementById('form-message');
  const gpsInput = document.getElementById('gps');

  // Attempt to get GPS when the form loads (optional, offline friendly)
  function fillGPS() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        gpsInput.value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      }, err => {
        gpsInput.value = 'Unavailable';
      });
    } else {
      gpsInput.value = 'Unavailable';
    }
  }

  fillGPS();

  form.addEventListener('submit', e => {
    e.preventDefault();
    const report = {
      id: Date.now(),
      type: form.type.value,
      severity: form.severity.value,
      notes: form.notes.value,
      gps: gpsInput.value,
      photo: form.photo.files[0] ? form.photo.files[0].name : null,
      time: new Date().toISOString()
    };
    // Store in localStorage under a dedicated key array
    const stored = JSON.parse(localStorage.getItem('aegis_reports') || '[]');
    stored.push(report);
    localStorage.setItem('aegis_reports', JSON.stringify(stored));
    formMessage.textContent = 'Report saved offline successfully';
    form.reset();
    fillGPS();
    updatePendingList();
  });

  // ---------- Pending Sync Page ----------
  const pendingList = document.getElementById('pending-list');
  const syncBtn = document.getElementById('sync-btn');
  const syncMessage = document.getElementById('sync-message');

  function updatePendingList() {
    const reports = JSON.parse(localStorage.getItem('aegis_reports') || '[]');
    pendingList.innerHTML = '';
    if (reports.length === 0) {
      pendingList.innerHTML = '<li>No pending reports</li>';
    } else {
      reports.forEach(r => {
        const li = document.createElement('li');
        li.textContent = `#${r.id} – ${r.type} (Severity ${r.severity})`;
        pendingList.appendChild(li);
      });
    }
  }

  syncBtn.addEventListener('click', () => {
    // Simulate upload by clearing storage
    localStorage.removeItem('aegis_reports');
    updatePendingList();
    syncMessage.textContent = 'All reports synced successfully';
    // After sync, also refresh the reports dashboard (which uses sample data)
    loadReportsDashboard();
  });

  // ---------- Reports Dashboard ----------
  const reportsTableBody = document.querySelector('#reports-table tbody');

  // Sample static data (could be replaced with real data after sync)
  const sampleData = [
    { id: 1, type: 'Fire', severity: 4, time: '2025-12-01T10:15:00Z', location: '12.9716, 77.5946' },
    { id: 2, type: 'Flood', severity: 3, time: '2025-12-03T14:30:00Z', location: '34.0522, -118.2437' },
    { id: 3, type: 'Earthquake', severity: 5, time: '2025-12-05T08:45:00Z', location: '35.6895, 139.6917' }
  ];

  function loadReportsDashboard() {
    // Clear existing rows
    reportsTableBody.innerHTML = '';
    // Combine stored reports (if any) with sample data for demo
    const stored = JSON.parse(localStorage.getItem('aegis_reports') || '[]');
    const combined = [...sampleData];
    stored.forEach(r => {
      combined.push({
        id: r.id,
        type: r.type,
        severity: r.severity,
        time: r.time,
        location: r.gps
      });
    });
    combined.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.id}</td>
        <td>${item.type}</td>
        <td>${item.severity}</td>
        <td>${new Date(item.time).toLocaleString()}</td>
        <td>${item.location}</td>
      `;
      reportsTableBody.appendChild(tr);
    });
  }

  // Initial load
  updatePendingList();
  loadReportsDashboard();

  // ---------- Mobile Sidebar Toggle (optional) ----------
  // Add a simple toggle button if needed (not in markup). Users can extend.
})();

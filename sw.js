const CACHE_NAME = 'aegis-v8';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './arrow-to-bottom.png',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js'
];

self.addEventListener('install', e => {
    console.log('[SW] Installing...');
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', e => {
    console.log('[SW] Activating...');
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    // 1. Bypass for non-GET requests (POST, PUT, DELETE, etc.)
    if (e.request.method !== 'GET') {
        e.respondWith(fetch(e.request));
        return;
    }

    // 2. Bypass for Firebase/API requests
    const url = new URL(e.request.url);
    if (url.origin.includes('googleapis.com') || url.origin.includes('firebase')) {
        e.respondWith(fetch(e.request));
        return;
    }

    // 3. Current Strategy: Cache First, falling back to Network
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request))
    );
});

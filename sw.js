const CACHE_NAME = 'aegis-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js'
];

// Install Event - Cache Files
self.addEventListener('install', (e) => {
    console.log('[SW] Installed');
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Activate Event - Clean old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
});

// Fetch Event - Serve from Cache if offline
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request);
        })
    );
});

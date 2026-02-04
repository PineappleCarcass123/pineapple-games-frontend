const CACHE_NAME = 'pineapple-v1';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/config.js',
    './js/index.js',
    './js/gm.js',
    './js/upload.js',
    './img/placeholder.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});

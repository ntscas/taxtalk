self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[PWA] Service Worker Activated');
});

self.addEventListener('fetch', (e) => {
  // Minimal fetch handler to satisfy Chrome PWA installability requirements
});

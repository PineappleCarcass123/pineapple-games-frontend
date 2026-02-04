if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker Registered', reg.scope))
            .catch(err => console.error('Service Worker Registration Failed', err));
    });
}

const CONFIG = {
    // Change this URL to your deployed Cloudflare Worker URL
    API_URL: "https://pineapple-backend.pineapplecarcass123.workers.dev",

    // Helper to sanitize HTML strings
    escapeHtml: (unsafe) => {
        if (!unsafe) return "";
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    // DOM-based sanitization (stricter)
    sanitizeHtml: (str) => {
        if (!str) return "";
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // Protocol-safe URL validation
    validateUrl: (url, baseUrl = window.location.origin) => {
        try {
            const urlObj = new URL(url, baseUrl);
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return null;
            }
            return urlObj.href;
        } catch {
            return null;
        }
    }
};

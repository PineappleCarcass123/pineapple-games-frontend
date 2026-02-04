const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const listDiv = document.getElementById('pending-list');
let adminKey = "";

// Use centralized CONFIG if available, fallback to protocol-aware localhost
const API_URL = (typeof CONFIG !== 'undefined' && CONFIG.API_URL) ? CONFIG.API_URL :
    (window.location.protocol === 'https:' ? 'https://localhost:8787' : 'http://localhost:8787');

// Check session
const sessionStart = sessionStorage.getItem('pineapple_admin_session_start');
const now = Date.now();
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours

if (sessionStorage.getItem('pineapple_admin_key') && sessionStart && (now - sessionStart < SESSION_TIMEOUT)) {
    adminKey = sessionStorage.getItem('pineapple_admin_key');
    showDashboard();
} else {
    logout(); // Clear expired or partial session
}

function login() {
    const input = document.getElementById('admin-key').value;
    if (input) {
        adminKey = input;
        sessionStorage.setItem('pineapple_admin_key', adminKey);
        sessionStorage.setItem('pineapple_admin_session_start', Date.now());
        showDashboard();
    }
}

function logout() {
    sessionStorage.removeItem('pineapple_admin_key');
    sessionStorage.removeItem('pineapple_admin_session_start');
    adminKey = "";
    authSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    document.getElementById('logout-btn').classList.add('hidden');
}

function showDashboard() {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    document.getElementById('logout-btn').classList.remove('hidden');
    loadPending();
    loadStorageOverview();
}

function loadPending() {
    listDiv.innerHTML = "<p>Loading...</p>";

    fetch(`${API_URL}/api/admin/pending`, {
        headers: { 'x-admin-key': adminKey }
    })
        .then(res => {
            if (res.status === 401) {
                logout();
                throw new Error("Unauthorized");
            }
            return res.json();
        })
        .then(games => {
            listDiv.innerHTML = "";
            if (games.length === 0) {
                listDiv.innerHTML = "<p>No games pending approval.</p>";
                return;
            }

            games.forEach(game => {
                const card = document.createElement('div');
                card.className = "pending-card";
                const safeTitle = CONFIG.sanitizeHtml(game.title);
                const safeId = CONFIG.sanitizeHtml(game.id);
                const safeDev = CONFIG.sanitizeHtml(game.developer?.name || 'Unknown');

                card.innerHTML = `
                <h3>${safeTitle}</h3>
                <p class="muted">ID: ${safeId}</p>
                <p>By: ${safeDev}</p>
                <div class="actions">
                    <button class="btn-green" data-action="approve" data-id="${safeId}">Approve</button>
                    <button class="btn-red" data-action="reject" data-id="${safeId}">Reject</button>
                    <button class="btn-blue" data-action="view-files" data-id="${safeId}">Files</button>
                    <a href="gm.html?id=${safeId}" target="_blank" style="color:white; align-self:center; margin-left:auto;">Preview</a>
                </div>
            `;
                listDiv.appendChild(card);
            });
        })
        .catch(err => {
            console.error(err);
            if (err.message !== "Unauthorized") listDiv.innerHTML = `<p class="error">Error: ${err.message}</p>`;
        });
}

function approve(id) {
    if (!confirm("Approve this game?")) return;
    action('approve', id);
}

function reject(id) {
    if (!confirm("DELETE this game AND ALL ITS FILES permanently?")) return;
    action('reject', id);
}

function action(type, id) {
    fetch(`${API_URL}/api/admin/${type}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminKey
        },
        body: JSON.stringify({ id })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert(`Game ${type}d!` + (data.filesDeleted ? ` (${data.filesDeleted} files deleted)` : ''));
                loadPending();
                loadStorageOverview();
            } else {
                alert('Error: ' + data.error);
            }
        });
}

// Storage Overview
async function loadStorageOverview() {
    try {
        const response = await fetch(`${API_URL}/api/admin/storage`, {
            headers: { 'x-admin-key': adminKey }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const data = await response.json();

        document.getElementById('total-files').textContent = data.totalFiles;
        const sizeMB = (data.totalSize / (1024 * 1024)).toFixed(2);
        document.getElementById('total-size').textContent = `${sizeMB} MB`;

        const gamesListDiv = document.getElementById('games-storage-list');
        gamesListDiv.innerHTML = '';

        if (data.games && Object.keys(data.games).length > 0) {
            for (const [gameId, stats] of Object.entries(data.games)) {
                const gameSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
                const gameDiv = document.createElement('div');
                gameDiv.className = 'pending-card';
                gameDiv.innerHTML = `
                    <h4>${gameId}</h4>
                    <p>Files: ${stats.fileCount} | Size: ${gameSizeMB} MB</p>
                    <div class="actions">
                        <button class="btn-blue" data-action="view-files" data-id="${gameId}">View Files</button>
                        <button class="btn-red" data-action="delete-all-files" data-id="${gameId}">Delete All</button>
                    </div>
                `;
                gamesListDiv.appendChild(gameDiv);
            }
        } else {
            gamesListDiv.innerHTML = '<p>No files stored.</p>';
        }

    } catch (err) {
        console.error('Failed to load storage:', err);
    }
}

// View files for a game
async function viewFiles(gameId) {
    try {
        const response = await fetch(`${API_URL}/api/admin/files/${gameId}`, {
            headers: { 'x-admin-key': adminKey }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const data = await response.json();

        document.getElementById('modal-game-id').textContent = gameId;
        const fileListDiv = document.getElementById('file-list');
        fileListDiv.innerHTML = '';

        if (data.files.length === 0) {
            fileListDiv.innerHTML = '<p>No files found for this game.</p>';
        } else {
            data.files.forEach(file => {
                const fileName = file.key.split('/').pop();
                const fileSizeKB = (file.size / 1024).toFixed(2);

                const fileDiv = document.createElement('div');
                fileDiv.className = 'file-item';
                fileDiv.innerHTML = `
                    <div class="file-info">
                        <strong>${fileName}</strong><br>
                        <small>${fileSizeKB} KB</small>
                    </div>
                    <div class="file-actions">
                        <a href="${API_URL}${file.url}" target="_blank" class="btn-blue">View</a>
                        <button data-action="delete-file" data-id="${gameId}" data-filename="${fileName}" class="btn-red">Delete</button>
                    </div>
                `;
                fileListDiv.appendChild(fileDiv);
            });
        }

        document.getElementById('fileModal').classList.remove('hidden');

    } catch (err) {
        console.error('Failed to load files:', err);
        alert('Error loading files: ' + err.message);
    }
}

// Delete a specific file
async function deleteFile(gameId, fileName) {
    if (!confirm(`Delete ${fileName}? This cannot be undone.`)) return;

    try {
        const response = await fetch(`${API_URL}/api/admin/files/${gameId}/${encodeURIComponent(fileName)}`, {
            method: 'DELETE',
            headers: { 'x-admin-key': adminKey }
        });

        if (response.ok) {
            alert('File deleted');
            viewFiles(gameId);
            loadStorageOverview();
        } else {
            throw new Error('Failed to delete file');
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// Delete all files for a game
async function deleteAllFiles(gameId) {
    if (!confirm(`DELETE ALL FILES for ${gameId}? This cannot be undone!`)) return;

    try {
        const filesResponse = await fetch(`${API_URL}/api/admin/files/${gameId}`, {
            headers: { 'x-admin-key': adminKey }
        });

        const data = await filesResponse.json();

        for (const file of data.files) {
            const fileName = file.key.split('/').pop();
            await fetch(`${API_URL}/api/admin/files/${gameId}/${encodeURIComponent(fileName)}`, {
                method: 'DELETE',
                headers: { 'x-admin-key': adminKey }
            });
        }

        alert(`Deleted ${data.files.length} files`);
        loadStorageOverview();

    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function closeFileModal() {
    document.getElementById('fileModal').classList.add('hidden');
}

// --- EVENT DELEGATION FOR SECURITY ---
document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    const link = e.target.closest('a[data-action]'); // For any potential data-action links
    const actionElement = btn || link;

    if (!actionElement) return;

    const actionType = actionElement.dataset.action;
    const id = actionElement.dataset.id;
    const filename = actionElement.dataset.filename;

    if (actionType === 'approve') approve(id);
    else if (actionType === 'reject') reject(id);
    else if (actionType === 'view-files') viewFiles(id);
    else if (actionType === 'delete-file') deleteFile(id, filename);
    else if (actionType === 'delete-all-files') deleteAllFiles(id);
    else if (actionType === 'logout') logout();
    else if (actionType === 'login') login();
    else if (actionType === 'refresh-pending') loadPending();
    else if (actionType === 'refresh-storage') loadStorageOverview();
    else if (actionType === 'close-modal') closeFileModal();
});

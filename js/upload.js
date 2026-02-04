const form = document.getElementById('upload-form');
const typeSelect = document.getElementById('game-type');
const urlLabel = document.getElementById('url-label');
const urlHelp = document.getElementById('url-help');
const filesizeGroup = document.getElementById('filesize-group');
const fileUploadGroup = document.getElementById('file-upload-group');
const gameFile = document.getElementById('game-file');
const playUrlInput = document.getElementById('play-url');
const platformCheckboxes = document.querySelectorAll('input[name="platform"]');

// Handle Type Change
typeSelect.addEventListener('change', () => {
    const type = typeSelect.value;

    // Reset visibility
    filesizeGroup.classList.add('hidden');
    fileUploadGroup.classList.add('hidden');
    playUrlInput.parentElement.classList.remove('hidden');
    playUrlInput.required = true;

    if (type === 'iframe') {
        urlLabel.textContent = "Game URL (Embed/Iframe)";
        urlHelp.textContent = "Direct link to the index.html or iframe source.";
        fileUploadGroup.classList.remove('hidden'); // Allow upload

        // Auto-select Web
        platformCheckboxes.forEach(cb => cb.checked = (cb.value === 'Web'));
    } else if (type === 'download') {
        urlLabel.textContent = "Download URL";
        urlHelp.textContent = "Direct link to the file (zip, exe, apk).";
        filesizeGroup.classList.remove('hidden');
        fileUploadGroup.classList.remove('hidden'); // Allow upload

        // Uncheck Web
        platformCheckboxes.forEach(cb => {
            if (cb.value === 'Web') cb.checked = false;
        });
    } else if (type === 'external') {
        urlLabel.textContent = "External Page URL";
        urlHelp.textContent = "Link to the game page (Itch.io, Steam, etc).";
    }
});

// Toggle URL input if file is selected, validate size
gameFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    const maxSize = 100 * 1024 * 1024; // 100MB

    if (file) {
        if (file.size > maxSize) {
            alert('File too large! Maximum size is 100MB');
            e.target.value = '';
            return;
        }

        // Show file size
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        document.getElementById('file-size').value = `${sizeMB} MB`;

        playUrlInput.parentElement.classList.add('hidden');
        playUrlInput.required = false;
    } else {
        playUrlInput.parentElement.classList.remove('hidden');
        playUrlInput.required = true;
    }
});

form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;

    try {
        const gameId = document.getElementById('game-id').value;
        const title = document.getElementById('game-title').value;
        const category = document.getElementById('game-category').value;
        const devName = document.getElementById('dev-name').value;
        const thumbnail = document.getElementById('thumbnail-url').value;
        const aspectRatio = document.getElementById('aspect-ratio').value;
        const type = document.getElementById('game-type').value;
        // Get selected platforms
        const platforms = Array.from(platformCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        // Input validation
        const gameIdRegex = /^[a-z0-9-]+$/;
        if (!gameIdRegex.test(gameId)) {
            throw new Error('Game ID must be lowercase alphanumeric with dashes only (e.g., my-cool-game)');
        }

        if (thumbnail && !thumbnail.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
            throw new Error('Thumbnail must be a valid image URL (http/https with .jpg, .png, .gif, or .webp)');
        }

        if (platforms.length === 0) {
            throw new Error('Please select at least one platform');
        }

        const API_URL = (typeof CONFIG !== 'undefined' && CONFIG.API_URL) ? CONFIG.API_URL :
            (window.location.protocol === 'https:' ? 'https://localhost:8787' : 'http://localhost:8787');

        let hostingData = {};
        const files = [];

        // Handle File Upload if selected
        if (gameFile.files.length > 0) {
            submitBtn.textContent = "Uploading File...";
            const progressEl = document.getElementById('upload-progress');
            const progressBar = progressEl.querySelector('progress');
            const statusEl = document.getElementById('upload-status');
            progressEl.classList.remove('hidden');

            const file = gameFile.files[0];

            // Use XMLHttpRequest for progress tracking
            const uploadData = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const formData = new FormData();
                formData.append('file', file);

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        progressBar.value = percent;
                        statusEl.textContent = `Uploading: ${percent}%`;
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error(`Upload failed: ${xhr.responseText}`));
                    }
                });

                xhr.addEventListener('error', () => reject(new Error('Network error')));

                xhr.open('POST', `${API_URL}/api/upload`);
                xhr.setRequestHeader('x-game-id', gameId);
                xhr.send(formData);
            });

            hostingData = {
                type: 'r2',
                primaryFile: uploadData.url
            };

            files.push({
                name: file.name,
                url: uploadData.url,
                size: uploadData.size,
                type: uploadData.type
            });

        } else {
            // Legacy/External URL
            const playUrl = playUrlInput.value;
            if (type === 'download') {
                hostingData = { type: 'external', url: playUrl }; // Or keep legacy fields
            } else {
                hostingData = { type: 'external', url: playUrl };
            }
        }

        const gameData = {
            id: gameId,
            title: title,
            category: category,
            tags: [],
            developer: {
                name: devName,
                url: ""
            },
            type: type,
            platform: platforms,
            thumbnail: thumbnail,
            viewport: {
                aspectRatio: aspectRatio,
                fullscreen: false
            },
            dateAdded: new Date().toISOString(), // Add timestamp
            hosting: hostingData,
            files: files
        };

        // Backward compatibility for legacy frontend (optional, but good safety)
        if (hostingData.type === 'r2') {
            gameData.playUrl = hostingData.primaryFile;
            if (type === 'download') gameData.downloadUrl = hostingData.primaryFile;
        } else {
            gameData.playUrl = playUrlInput.value;
            if (type === 'download') gameData.downloadUrl = playUrlInput.value;
        }

        submitBtn.textContent = "Submitting Game...";

        try {
            const response = await fetch(`${API_URL}/api/games`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(gameData)
            });

            const result = await response.json();
            if (result.success) {
                alert("Game submitted successfully! It will appear once approved by a moderator.");
                window.location.href = "index.html";
            } else {
                throw new Error(result.error || "Submission failed");
            }
        } catch (err) {
            console.error("Submission error:", err);
            let msg = `Failed to submit game: ${err.message}`;
            if (hostingData.type === 'r2') {
                msg += "\n\nNote: Your file was uploaded successfully but the submission metadata failed. An admin will need to clean up the orphaned file or you can try again with a different ID.";
            }
            alert(msg);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText; // Revert to original text
        }

    } catch (err) {
        console.error(err);
        // Note: Orphaned files are cleaned up by scheduled backend job
        alert('Error: ' + err.message);
    } finally {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
        document.getElementById('upload-progress').classList.add('hidden');
    }
});


const params = new URLSearchParams(window.location.search);
const gameId = params.get("id");

document.querySelector('.back').addEventListener('click', (e) => {
  e.preventDefault();
  history.back();
});

if (!gameId) return;

const API_URL = (typeof CONFIG !== 'undefined' && CONFIG.API_URL) ? CONFIG.API_URL :
  (window.location.protocol === 'https:' ? 'https://localhost:8787' : 'http://localhost:8787');

fetch(`${API_URL}/api/games?id=${gameId}`)
  .then(res => {
    if (!res.ok) throw Error('Game not found or API error');
    return res.json();
  })
  .then(game => {
    if (!game) return console.error('Game not found');
    renderGameDetails(game);
  })
  .catch(err => {
    console.error("Load error:", err);
    document.querySelector("main").innerHTML = "<p class='error'>Failed to load game data.</p>";
  });

function renderGameDetails(game) {

  // Handle title - check if it's an object with .en or a string
  const title = game.title.en || game.title;
  document.getElementById("game-title").textContent = title;
  document.getElementById("game-dev").textContent = `by ${game.developer.name}`;

  const frame = document.getElementById("game-frame");
  const downloadCard = document.getElementById("download-card");
  const dlTitle = document.getElementById("dl-title");
  const dlPlatform = document.getElementById("dl-platform");
  const dlSize = document.getElementById("dl-size");
  const dlBtn = document.getElementById("dl-btn");

  // Determine the game URL based on hosting type
  const getGameUrl = () => {
    let url = "";
    if (game.hosting && game.hosting.type === 'r2') {
      // R2-hosted: use backend API URL + hosting path
      url = `${API_URL}${game.hosting.primaryFile}`;
    } else {
      // Fallback to legacy fields
      url = game.playUrl || game.downloadUrl || game.url;
    }

    // Safety check: if CONFIG.validateUrl is available, use it
    if (typeof CONFIG !== 'undefined' && CONFIG.validateUrl) {
      return CONFIG.validateUrl(url) || url;
    }
    return url;
  };

  if (game.type === "download" || game.type === "external") {
    // Hide iframe, show download card
    frame.classList.add("hidden");
    downloadCard.classList.remove("hidden");

    if (game.type === "download") {
      dlTitle.textContent = "Download Game";
      dlBtn.textContent = "Download Now";
      dlBtn.href = getGameUrl();
      if (game.fileSize) dlSize.textContent = `File Size: ${game.fileSize}`;
    } else {
      dlTitle.textContent = "Play Externally";
      dlBtn.textContent = "Play on Official Site";
      dlBtn.href = getGameUrl();
      dlSize.textContent = "Opens in a new tab";
    }

    // Show platforms
    if (game.platform && Array.isArray(game.platform)) {
      dlPlatform.innerHTML = game.platform
        .map(p => `<span class="tag">${CONFIG.escapeHtml(p)}</span>`)
        .join(" ");
    } else {
      dlPlatform.textContent = "";
    }

  } else {
    // Default: Iframe
    frame.classList.remove("hidden");
    downloadCard.classList.add("hidden");
    frame.src = getGameUrl();

    if (game.viewport?.aspectRatio) {
      const [w, h] = game.viewport.aspectRatio.split('/');
      frame.style.aspectRatio = `${w}/${h}`;
    }
    if (game.viewport?.fullscreen) frame.setAttribute("allowfullscreen", true);
  }
}
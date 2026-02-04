const grid = document.getElementById("game-grid");
const filters = document.getElementById("filters");
const searchInput = document.getElementById("search");

const logo = document.querySelector('.logo');
if (logo) {
  logo.addEventListener('error', function () {
    this.style.display = 'none';
  });
}

let games = [];
let activeCategory = "all";
let searchQuery = "";

// Load games
const API_URL = (typeof CONFIG !== 'undefined' && CONFIG.API_URL) ? CONFIG.API_URL :
  (window.location.protocol === 'https:' ? 'https://localhost:8787' : 'http://localhost:8787');

fetch(`${API_URL}/api/games`)
  .then(res => {
    if (!res.ok) throw new Error("Failed to fetch games");
    return res.json();
  })
  .then(loadedGames => {
    // API returns the flat list directly
    games = loadedGames;
    createCategoryButtons(games);
    renderFilteredGames();
  })
  .catch(err => {
    console.error("Failed to load games:", err);
    grid.innerHTML = `<p class="error">Failed to load games. Is the backend running?</p>`;
  });

/* CATEGORY BUTTONS */
function createCategoryButtons(gamesList) {
  const categories = new Set(gamesList.map(g => g.category));

  filters.innerHTML = "";

  // "All" button
  const allButton = document.createElement("button");
  allButton.textContent = "All";
  allButton.dataset.category = "all";
  allButton.classList.add("active");
  allButton.onclick = () => {
    activeCategory = "all";
    updateActiveButton(allButton);
    renderFilteredGames();
  };
  filters.appendChild(allButton);

  // "Favorites" button
  const favButton = document.createElement("button");
  favButton.textContent = "Favorites ♥";
  favButton.dataset.category = "favorites";
  favButton.onclick = () => {
    activeCategory = "favorites";
    updateActiveButton(favButton);
    renderFilteredGames();
  };
  filters.appendChild(favButton);

  categories.forEach(category => {
    const button = document.createElement("button");
    button.textContent = category;
    button.dataset.category = category;
    button.onclick = () => {
      activeCategory = category;
      updateActiveButton(button);
      renderFilteredGames();
    };
    filters.appendChild(button);
  });
}

function updateActiveButton(activeBtn) {
  document.querySelectorAll("#filters button").forEach(b =>
    b.classList.remove("active")
  );
  activeBtn.classList.add("active");
}

/* SEARCH */
searchInput.addEventListener("input", e => {
  searchQuery = e.target.value.toLowerCase();
  renderFilteredGames();
});

/* FILTER + RENDER */
function renderFilteredGames() {
  let filtered = games;

  if (activeCategory === "favorites") {
    const favs = getFavorites();
    filtered = filtered.filter(g => favs.includes(g.id));
  } else if (activeCategory !== "all") {
    filtered = filtered.filter(g => g.category === activeCategory);
  }

  if (searchQuery) {
    filtered = filtered.filter(g => {
      const title = g.title.en || g.title || "";
      return title.toLowerCase().includes(searchQuery) ||
        (g.tags && g.tags.some(tag => tag.toLowerCase().includes(searchQuery)));
    });
  }

  renderGames(filtered);
}

function renderGames(gamesToRender) {
  grid.innerHTML = "";

  if (gamesToRender.length === 0) {
    grid.innerHTML = `<p class="no-games">No games found</p>`;
    return;
  }

  gamesToRender.forEach(game => {
    const rawTitle = game.title.en || game.title || "Untitled Game";
    const rawThumbnail = game.thumbnail || "img/placeholder.png";

    // Sanitize for XSS prevention
    const title = CONFIG.sanitizeHtml(rawTitle);
    const thumbnail = CONFIG.validateUrl(rawThumbnail) || "img/placeholder.png";

    const isFavorite = getFavorites().includes(game.id);

    // Check if new (within 14 days)
    const isNew = game.dateAdded && (new Date() - new Date(game.dateAdded)) / (1000 * 60 * 60 * 24) < 14;

    // Check if self-hosted (R2)
    const isHosted = game.hosting && game.hosting.type === 'r2';

    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <div class="card-image-wrapper">
        <img src="${thumbnail}" alt="${title}" onerror="this.src='img/placeholder.png'">
        ${isNew ? '<span class="new-badge">NEW</span>' : ''}
        ${isHosted ? '<span class="hosted-badge">HOSTED</span>' : ''}
        <button class="fav-btn ${isFavorite ? 'active' : ''}" data-id="${game.id}">
          ♥
        </button>
      </div>
    `;

    // Card click navigates to game
    card.querySelector("img").onclick = () => {
      window.location.href = `gm.html?id=${game.id}`;
    };

    // Fav button click toggles favorite
    card.querySelector(".fav-btn").onclick = (e) => {
      e.stopPropagation();
      toggleFavorite(game.id);
      const btn = e.target;
      btn.classList.toggle("active");

      // If we are in "favorites" view, re-render to remove un-favorited item
      if (activeCategory === "favorites") {
        renderFilteredGames();
      }
    };

    grid.appendChild(card);
  });
}

/* FAVORITES SYSTEM */
function getFavorites() {
  return JSON.parse(localStorage.getItem("pineapple_favorites") || "[]");
}

function toggleFavorite(gameId) {
  let favs = getFavorites();
  if (favs.includes(gameId)) {
    favs = favs.filter(id => id !== gameId);
  } else {
    favs.push(gameId);
  }
  localStorage.setItem("pineapple_favorites", JSON.stringify(favs));
}
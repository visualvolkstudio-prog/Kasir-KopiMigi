/* ═════════════════════════════════════════════════════════
   KOPI MIGI — Landing Page JS
   • Staggered word entrance animation
   • Hopper sticker on tap / hover
   • Order Online bottom sheet
   • Built-in Menu bottom sheet — sinkron dengan app POS
═════════════════════════════════════════════════════════ */

// ── MENU DATA — sinkron dengan POS app via localStorage ──
const STORAGE_KEY = "kopishop-pos-menu";

// Urutan dan kategori yang ditampilkan di landing — tetap dan berurutan
const MENU_CATEGORIES = [
  "Kopi",
  "Manual Brew",
  "Americano Series",
  "Botolan",
  "Milk Based",
  "Pastries",
  "Air Minum",
];

// Fallback jika belum ada data dari app
const DEFAULT_MENU = [
  { id: "esp",     name: "Espresso",         category: "Kopi",             price: 18000 },
  { id: "cap",     name: "Cappuccino",        category: "Kopi",             price: 28000 },
  { id: "lat",     name: "Cafe Latte",        category: "Kopi",             price: 30000 },
  { id: "aren",    name: "Kopi Susu Aren",    category: "Kopi",             price: 26000 },
  { id: "v60",     name: "V60",               category: "Manual Brew",      price: 30000 },
  { id: "chemex",  name: "Chemex",            category: "Manual Brew",      price: 32000 },
  { id: "amer",    name: "Americano",         category: "Americano Series", price: 22000 },
  { id: "botol",   name: "Cold Brew Botol",   category: "Botolan",          price: 35000 },
  { id: "matcha",  name: "Matcha Latte",      category: "Milk Based",       price: 32000 },
  { id: "choco",   name: "Iced Chocolate",    category: "Milk Based",       price: 29000 },
  { id: "croi",    name: "Butter Croissant",  category: "Pastries",         price: 24000 },
  { id: "air",     name: "Air Mineral",       category: "Air Minum",        price: 8000  },
];

function getMenuData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return DEFAULT_MENU;
}

function getCategories() {
  // Selalu tampilkan semua 7 kategori — tab tidak hilang meski data kosong
  return MENU_CATEGORIES;
}

// ── HOPPER CONFIG ────────────────────────────────────────
const HOPPER_MAP = {
  locate: ["📍", "🗺️", "🧭"],
  order:  ["🛵", "🚀", "📦"],
  menu:   ["☕", "🍵", "🧋"],
  brand:  ["🐾", "✨", "💙"],
};

function randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── HOPPER ELEMENT ───────────────────────────────────────
const hopper      = document.getElementById("hopper");
const hopperEmoji = document.getElementById("hopperEmoji");
let hopperTimeout = null;

function showHopper(x, y, type) {
  // pick emoji
  const emojis = HOPPER_MAP[type] || ["✨"];
  hopperEmoji.textContent = randFrom(emojis);

  // position
  hopper.style.left = x + "px";
  hopper.style.top  = y + "px";

  // restart bounce animation
  const inner = hopper.querySelector(".hopper-inner");
  inner.style.animation = "none";
  hopperEmoji.style.animation = "none";
  void inner.offsetWidth; // force reflow
  inner.style.animation = "";
  hopperEmoji.style.animation = "";

  hopper.classList.add("visible");

  clearTimeout(hopperTimeout);
  hopperTimeout = setTimeout(() => hopper.classList.remove("visible"), 1200);
}

// ── WORD ENTRANCE ANIMATION ──────────────────────────────
function animateWords() {
  const words = document.querySelectorAll(".word");
  words.forEach((w, i) => {
    w.style.animation = `fadeUp 0.5s ease ${0.2 + i * 0.07}s forwards`;
  });
}

// ── PANEL HELPERS ─────────────────────────────────────────
function openPanel(backdropId, panelId) {
  document.getElementById(backdropId).classList.add("open");
  document.getElementById(panelId).classList.add("open");
  document.getElementById(panelId).setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closePanel(backdropId, panelId) {
  document.getElementById(backdropId).classList.remove("open");
  document.getElementById(panelId).classList.remove("open");
  document.getElementById(panelId).setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

// ── MENU RENDER ───────────────────────────────────────────
function formatPrice(price) {
  return "Rp " + Number(price).toLocaleString("id-ID");
}

function renderMenu(category) {
  const allItems = getMenuData();
  const list = document.getElementById("menuList");
  const items = allItems.filter(item => item.category === category);

  if (!items.length) {
    list.innerHTML = `<p style="padding:1.5rem 0;color:var(--text-muted);font-family:'Barlow Condensed',sans-serif;font-size:1.1rem;letter-spacing:0.05em;text-transform:uppercase;">SEGERA HADIR ✦</p>`;
    return;
  }

  list.innerHTML = items.map(item => `
    <div class="menu-item">
      <div class="menu-item-info">
        <div class="menu-item-name">${item.name}</div>
      </div>
      <div class="menu-item-price">${formatPrice(item.price)}</div>
    </div>
  `).join("");
}

function buildMenuTabs() {
  const categories = getCategories();
  const allItems = getMenuData();
  const tabContainer = document.querySelector(".menu-tabs");

  tabContainer.innerHTML = categories.map((cat, i) => `
    <button class="menu-tab${i === 0 ? " active" : ""}"
            data-category="${cat}"
            role="tab"
            aria-selected="${i === 0}">
      ${cat}
    </button>
  `).join("");

  // Re-attach click events
  tabContainer.querySelectorAll(".menu-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      tabContainer.querySelectorAll(".menu-tab").forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      renderMenu(tab.dataset.category);
    });
  });

  // Render first category
  if (categories.length) renderMenu(categories[0]);
}

// ── INIT ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  // Stagger entrance
  animateWords();

  // Build dynamic menu tabs & render from localStorage
  buildMenuTabs();

  // ── Hopper on link tap/hover ────────────────────────────
  document.querySelectorAll("[data-action], .word.brand").forEach(el => {
    const getPos = () => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top - 16 };
    };

    const trigger = () => {
      const pos  = getPos();
      const type = el.dataset.action || "brand";
      showHopper(pos.x, pos.y, type);
    };

    el.addEventListener("mouseenter", trigger);
    el.addEventListener("touchstart", trigger, { passive: true });
  });

  // ── ORDER ONLINE ─────────────────────────────────────────
  document.querySelector('[data-action="order"]').addEventListener("click", (e) => {
    e.preventDefault();
    openPanel("orderBackdrop", "orderPanel");
  });

  document.getElementById("orderClose").addEventListener("click", () => closePanel("orderBackdrop", "orderPanel"));
  document.getElementById("orderBackdrop").addEventListener("click", () => closePanel("orderBackdrop", "orderPanel"));

  // ── MENU (fullscreen) ─────────────────────────────────
  document.querySelector('[data-action="menu"]').addEventListener("click", (e) => {
    e.preventDefault();
    buildMenuTabs();
    // Fullscreen: hanya panel yang terbuka, backdrop tidak perlu
    const panel = document.getElementById("menuPanel");
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  });

  document.getElementById("menuClose").addEventListener("click", () => {
    const panel = document.getElementById("menuPanel");
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  });

  // ── ESC key ───────────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePanel("orderBackdrop", "orderPanel");
      closePanel("menuBackdrop", "menuPanel");
    }
  });

});

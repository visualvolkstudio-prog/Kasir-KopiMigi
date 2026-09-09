/* ═════════════════════════════════════════════════════════
   KOPI MIGI — Landing Page JS
   • Staggered word entrance animation
   • Hopper sticker on tap / hover
   • Order Online bottom sheet
   • Built-in Menu bottom sheet — sinkron dengan app POS
═════════════════════════════════════════════════════════ */

// ── MENU DATA — disinkronkan dengan POS (menu.json) ──
// Update menu.json jika ada perubahan menu di kasir

const MENU_CATEGORIES = [
  "Kopi",
  "Americano",
  "Botolan",
  "Milk Based",
  "Manual BREW",
  "Pastries",
  "Air Minum",
];

const DEFAULT_MENU = [
  { id: "bcc",  name: "Butterscotch Creamy Coffee",  category: "Kopi",       price: 17000 },
  { id: "ca",   name: "Coffee Aren",                 category: "Kopi",       price: 15000 },
  { id: "ch",   name: "Coffee Hazelnut",             category: "Kopi",       price: 17000 },
  { id: "hcl",  name: "Hot Caffe Latte",             category: "Kopi",       price: 17000 },
  { id: "hc",   name: "Hot Cappucino",               category: "Kopi",       price: 17000 },
  { id: "hks",  name: "Hot Kopi Susu",               category: "Kopi",       price: 12000 },
  { id: "hmo",  name: "Hot Moccachino",              category: "Kopi",       price: 17000 },
  { id: "icl",  name: "Iced Caffe Latte",            category: "Kopi",       price: 17000 },
  { id: "ic",   name: "Iced Cappucino",              category: "Kopi",       price: 17000 },
  { id: "kcm",  name: "KopSu Classic Migi",          category: "Kopi",       price: 12000 },
  { id: "kcm2", name: "KopSu Creamy Migi",           category: "Kopi",       price: 15000 },
  { id: "sccc", name: "Salted Creamy Caramel Coffee",category: "Kopi",       price: 17000 },
  { id: "sm",   name: "Signature Mazagran",          category: "Kopi",       price: 20000 },
  { id: "iac",  name: "Iced Americano Classic",      category: "Americano",  price: 12000 },
  { id: "iaf",  name: "Iced Americano Fruity",       category: "Americano",  price: 15000 },
  { id: "iafw", name: "Iced Americano Fullwash",     category: "Americano",  price: 15000 },
  { id: "iah",  name: "Iced Americano Honey",        category: "Americano",  price: 15000 },
  { id: "ian",  name: "Iced Americano Natural",      category: "Americano",  price: 15000 },
  { id: "iar",  name: "Iced Americano Robusta",      category: "Americano",  price: 12000 },
  { id: "iaw",  name: "Iced Americano Wine",         category: "Americano",  price: 15000 },
  { id: "ka1l", name: "Kopi Aren 1 Liter",           category: "Botolan",    price: 65000 },
  { id: "ksc1", name: "Kopi Susu Classic 1 Liter",   category: "Botolan",    price: 55000 },
  { id: "cbm",  name: "Choco Big Muffin",            category: "Pastries",   price: 7500  },
  { id: "cc",   name: "Classic Cookies",             category: "Pastries",   price: 5000  },
  { id: "mc",   name: "Marmer Cake",                 category: "Pastries",   price: 5000  },
  { id: "mm",   name: "mini Muffin",                 category: "Pastries",   price: 4000  },
  { id: "mp",   name: "mini Pudding",                category: "Pastries",   price: 3000  },
  { id: "r",    name: "Roti",                        category: "Pastries",   price: 6000  },
  { id: "sd",   name: "Sweet Donut",                 category: "Pastries",   price: 5000  },
  { id: "cb",   name: "Cleo Besar",                  category: "Air Minum",  price: 6000  },
  { id: "ck",   name: "Cleo Kecil",                  category: "Air Minum",  price: 2500  },
  { id: "dke",  name: "Double Kick Espresso",        category: "Manual BREW", price: 15000 },
  { id: "ktc",  name: "Kopi Tubruk Classic",         category: "Manual BREW", price: 10000 },
  { id: "ktf",  name: "Kopi Tubruk Fermentasion",   category: "Manual BREW", price: 13000 },
  { id: "ktfw", name: "Kopi Tubruk Fullwash",        category: "Manual BREW", price: 10000 },
  { id: "kth",  name: "Kopi Tubruk Honey",           category: "Manual BREW", price: 13000 },
  { id: "ktl",  name: "Kopi Tubruk Lanang",          category: "Manual BREW", price: 10000 },
  { id: "ktn",  name: "Kopi Tubruk Natural",         category: "Manual BREW", price: 10000 },
  { id: "sse",  name: "Single Shot Espresso",        category: "Manual BREW", price: 8000  },
  { id: "v",    name: "V60/Japanese",                category: "Manual BREW", price: 15000 },
  { id: "vd",   name: "Vietnam Drip",                category: "Manual BREW", price: 10000 },
  { id: "ccl",  name: "Classic Choco Latte",         category: "Milk Based",  price: 13000 },
  { id: "ml",   name: "Matcha Latte",                category: "Milk Based",  price: 15000 },
  { id: "srv",  name: "Smooth Red Velvet",           category: "Milk Based",  price: 13000 },
  { id: "sl",   name: "Strawberry Latte",            category: "Milk Based",  price: 13000 },
  { id: "ta",   name: "Taroo Ajaa",                  category: "Milk Based",  price: 15000 },
];

const STORAGE_KEY  = "kopishop-pos-menu";
const MENU_CACHE   = "kopimigi-menu-v1";
const MENU_URL     = "/menu.json";

async function getMenuData() {
  // 1. localStorage dulu — data real dari app kasir (paling up-to-date)
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.length) return parsed;
    }
  } catch (_) {}

  // 2. Cache Storage — data offline dari menu.json
  try {
    const cache = await caches.open(MENU_CACHE);
    const cached = await cache.match(MENU_URL);
    if (cached) {
      const data = await cached.json();
      if (data?.length) {
        fetchAndCacheMenu(cache); // refresh di background
        return data;
      }
    }
  } catch (_) {}

  // 3. Fetch menu.json dari server (simpan ke cache)
  try {
    const cache = await caches.open(MENU_CACHE);
    return await fetchAndCacheMenu(cache);
  } catch (_) {}

  // 4. Fallback hardcoded
  return DEFAULT_MENU;
}

async function fetchAndCacheMenu(cache) {
  const res = await fetch(MENU_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error("fetch menu failed");
  const clone = res.clone();
  cache.put(MENU_URL, clone);
  return res.json();
}

function getCategories() {
  return MENU_CATEGORIES;
}

// ── HOPPER CONFIG — SVG icons (bukan emoji) ──────────────
const HOPPER_ICONS = {
  locate: `<svg width="30" height="30" viewBox="0 0 24 24" fill="#f05a1a" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  order:  `<svg width="30" height="30" viewBox="0 0 24 24" fill="#22c55e" xmlns="http://www.w3.org/2000/svg"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm0 10c-1.66 0-3-1.34-3-3h2c0 .55.45 1 1 1s1-.45 1-1h2c0 1.66-1.34 3-3 3z"/></svg>`,
  menu:   `<svg width="30" height="30" viewBox="0 0 24 24" fill="#7c4a1f" xmlns="http://www.w3.org/2000/svg"><path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/></svg>`,
  brand:  `<svg width="30" height="30" viewBox="0 0 24 24" fill="#f59e0b" xmlns="http://www.w3.org/2000/svg"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`,
};

// ── HOPPER ELEMENT ───────────────────────────────────────
const hopper      = document.getElementById("hopper");
const hopperEmoji = document.getElementById("hopperEmoji");
let hopperTimeout = null;

function showHopper(x, y, type) {
  hopperEmoji.innerHTML = HOPPER_ICONS[type] || HOPPER_ICONS.brand;

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

async function renderMenu(category) {
  const allItems = await getMenuData();
  const list = document.getElementById("menuList");
  const items = allItems.filter(item =>
    item.category?.toLowerCase() === category.toLowerCase()
  );

  if (!items.length) {
    list.innerHTML = `<p class="menu-empty">SEGERA HADIR ✦</p>`;
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

async function buildMenuTabs() {
  const categories = getCategories();
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

  // ── Tape: clone row sampai lebih dari lebar layar ────────
  const tapeTrack = document.getElementById("tapeTrack");
  const tapeRow   = document.getElementById("tapeRow");
  if (tapeTrack && tapeRow) {
    const rowW = tapeRow.offsetWidth || 600;
    const copies = Math.ceil((window.innerWidth * 2) / rowW) + 1;
    for (let i = 0; i < copies; i++) {
      const clone = tapeRow.cloneNode(true);
      clone.removeAttribute("id");
      clone.setAttribute("aria-hidden", "true");
      tapeTrack.appendChild(clone);
    }
  }

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

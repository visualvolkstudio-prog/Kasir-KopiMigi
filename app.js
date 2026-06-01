const defaultMenu = [
  { id: "esp", name: "Espresso", category: "Kopi", price: 18000 },
  { id: "cap", name: "Cappuccino", category: "Kopi", price: 28000 },
  { id: "lat", name: "Cafe Latte", category: "Kopi", price: 30000 },
  { id: "aren", name: "Kopi Susu Aren", category: "Kopi", price: 26000 },
  { id: "matcha", name: "Matcha Latte", category: "Non Kopi", price: 32000 },
  { id: "choco", name: "Iced Chocolate", category: "Non Kopi", price: 29000 },
  { id: "croissant", name: "Butter Croissant", category: "Snack", price: 24000 },
  { id: "toast", name: "Smoked Beef Toast", category: "Snack", price: 36000 },
  { id: "pb-classic", name: "Photobooth Classic", category: "Photobooth", price: 45000, boothPackage: "classic" },
  { id: "pb-premium", name: "Photobooth Premium", category: "Photobooth", price: 75000, boothPackage: "premium" },
];

const storageKeys = {
  menu: "kopishop-pos-menu",
  history: "kopishop-pos-history",
  booth: "kopishop-pos-booth-sessions",
  boothLegacy: "pb_sessions",
  auth: "kasir-migi-auth",
  employee: "kasir-migi-employee",
  employees: "kasir-migi-employees",
  sessionShift: "kasir-migi-session-shift",
  inventory: "kopishop-pos-inventory",
  purchases: "kopishop-pos-purchases",
  recipes: "kopishop-pos-recipes",
  orderDrafts: "kopishop-pos-order-drafts",
  cashflowExpenses: "kopishop-pos-cashflow-expenses",
  pendingDeletes: "kopishop-pos-pending-deletes",
  activeView: "kasir-migi-active-view",
  shiftActions: "kasir-migi-shift-actions",
  settingsDirty: "kasir-migi-settings-dirty",
  deviceId: "kasir-migi-device-id",
  lastDeviceWarning: "kasir-migi-last-device-warning",
};

const boothPackagePhotoCounts = {
  single: 1,
  couple: 1,
  classic: 2,
  premium: 4,
};

const boothSyncChannel = "BroadcastChannel" in window ? new BroadcastChannel("photobooth-sync") : null;

const state = {
  cart: [],
  category: "Semua",
  search: "",
  payment: "Tunai",
  orderChannel: "Kasir",
  orderStatus: "unpaid",
  chartRange: "daily",
  activeDraftId: "",
  pendingBoothCode: "",
  boothPhotos: [],
  boothStream: null,
  printerDevice: null,
  printerCharacteristic: null,
};

const bleServiceUuids = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

const bleCharacteristicUuids = [
  "00002af1-0000-1000-8000-00805f9b34fb",
  "49535343-8841-43f4-a8d4-ecbe34729bb3",
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
];

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const offlineDbName = "kasir-migi-offline";
const offlineStoreName = "transactions";
let offlineDbPromise = null;

const els = {
  tabs: document.querySelectorAll(".nav-tab"),
  views: document.querySelectorAll(".view-panel"),
  loginScreen: document.querySelector("#loginScreen"),
  loginForm: document.querySelector("#loginForm"),
  loginUsername: document.querySelector("#loginUsername"),
  loginPassword: document.querySelector("#loginPassword"),
  loginShift: document.querySelector("#loginShift"),
  loginEmployee: document.querySelector("#loginEmployee"),
  loginHint: document.querySelector("#loginHint"),
  orderModal: document.querySelector("#orderModal"),
  orderForm: document.querySelector("#orderForm"),
  modalOrderList: document.querySelector("#modalOrderList"),
  billOrderBtn: document.querySelector("#billOrderBtn"),
  orderCustomerName: document.querySelector("#orderCustomerName"),
  orderTableNumber: document.querySelector("#orderTableNumber"),
  orderShift: document.querySelector("#orderShift"),
  orderChannels: document.querySelector("#orderChannels"),
  cancelOrderModal: document.querySelector("#cancelOrderModal"),
  todayLabel: document.querySelector("#todayLabel"),
  clockLabel: document.querySelector("#clockLabel"),
  activeEmployeeCard: document.querySelector("#activeEmployeeCard"),
  activeEmployeeHeader: document.querySelector("#activeEmployeeHeader"),
  employeeName: document.querySelector("#employeeName"),
  employeeAddForm: document.querySelector("#employeeAddForm"),
  employeeNewName: document.querySelector("#employeeNewName"),
  employeeList: document.querySelector("#employeeList"),
  logoutBtn: document.querySelector("#logoutBtn"),
  fullscreenToggle: document.querySelector("#fullscreenToggle"),
  printerToggle: document.querySelector("#printerToggle"),
  printerDropdown: document.querySelector("#printerDropdown"),
  printerStatus: document.querySelector("#printerStatus"),
  printerPaperSize: document.querySelector("#printerPaperSize"),
  connectPrinter: document.querySelector("#connectPrinter"),
  testLogoPrint: document.querySelector("#testLogoPrint"),
  printerHint: document.querySelector("#printerHint"),
  categoryTabs: document.querySelector("#categoryTabs"),
  menuGrid: document.querySelector("#menuGrid"),
  menuSearch: document.querySelector("#menuSearch"),
  resetFilter: document.querySelector("#resetFilter"),
  checkoutPanel: document.querySelector(".checkout-panel"),
  cartList: document.querySelector("#cartList"),
  cartTitle: document.querySelector("#cartTitle"),
  subtotal: document.querySelector("#subtotal"),
  grandTotal: document.querySelector("#grandTotal"),
  cartSubtotal: document.querySelector("#cartSubtotal"),
  cartGrandTotal: document.querySelector("#cartGrandTotal"),
  paidAmount: document.querySelector("#paidAmount"),
  changeDue: document.querySelector("#changeDue"),
  clearCart: document.querySelector("#clearCart"),
  clearCartPanel: document.querySelector("#clearCartPanel"),
  paymentMethods: document.querySelector("#paymentMethods"),
  checkoutBtn: document.querySelector("#checkoutBtn"),
  receiptPaper: document.querySelector("#receiptPaper"),
  customerName: document.querySelector("#customerName"),
  tableNumber: document.querySelector("#tableNumber"),
  boothPackage: document.querySelector("#boothPackage"),
  latestBoothCode: document.querySelector("#latestBoothCode"),
  shiftTotal: document.querySelector("#shiftTotal"),
  shiftCount: document.querySelector("#shiftCount"),
  historyList: document.querySelector("#historyList"),
  dailySummary: document.querySelector("#dailySummary"),
  dailyReportText: document.querySelector("#dailyReportText"),
  copyDailyReport: document.querySelector("#copyDailyReport"),
  shareDailyReport: document.querySelector("#shareDailyReport"),
  orderStatusTabs: document.querySelector("#orderStatusTabs"),
  orderList: document.querySelector("#orderList"),
  unpaidOrderCount: document.querySelector("#unpaidOrderCount"),
  paidOrderCount: document.querySelector("#paidOrderCount"),
  paidOrderDate: document.querySelector("#paidOrderDate"),
  connectionStatus: document.querySelector("#connectionStatus"),
  pendingSyncCount: document.querySelector("#pendingSyncCount"),
  manualSyncBtn: document.querySelector("#manualSyncBtn"),
  manualSyncOrdersBtn: document.querySelector("#manualSyncOrdersBtn"),
  pendingSyncList: document.querySelector("#pendingSyncList"),
  analyticsMonth: document.querySelector("#analyticsMonth"),
  analyticsDate: document.querySelector("#analyticsDate"),
  chartRangeTabs: document.querySelector("#chartRangeTabs"),
  monthRevenue: document.querySelector("#monthRevenue"),
  avgDailyRevenue: document.querySelector("#avgDailyRevenue"),
  monthTransactions: document.querySelector("#monthTransactions"),
  monthItems: document.querySelector("#monthItems"),
  revenueChart: document.querySelector("#revenueChart"),
  bestsellerList: document.querySelector("#bestsellerList"),
  insightList: document.querySelector("#insightList"),
  menuForm: document.querySelector("#menuForm"),
  menuId: document.querySelector("#menuId"),
  menuName: document.querySelector("#menuName"),
  menuCategorySelect: document.querySelector("#menuCategorySelect"),
  menuCategoryCustom: document.querySelector("#menuCategoryCustom"),
  menuCategory: document.querySelector("#menuCategory"),
  menuPrice: document.querySelector("#menuPrice"),
  menuImageFile: document.querySelector("#menuImageFile"),
  menuImage: document.querySelector("#menuImage"),
  menuImagePreview: document.querySelector("#menuImagePreview"),
  cancelMenuEdit: document.querySelector("#cancelMenuEdit"),
  menuTable: document.querySelector("#menuTable"),
  purchaseForm: document.querySelector("#purchaseForm"),
  purchaseMenuId: document.querySelector("#purchaseMenuId"),
  purchaseQty: document.querySelector("#purchaseQty"),
  ingredientUnit: document.querySelector("#ingredientUnit"),
  purchaseCost: document.querySelector("#purchaseCost"),
  purchaseNote: document.querySelector("#purchaseNote"),
  stockAvailabilityList: document.querySelector("#stockAvailabilityList"),
  stockAlert: document.querySelector("#stockAlert"),
  stockTable: document.querySelector("#stockTable"),
  purchaseHistory: document.querySelector("#purchaseHistory"),
  recipeIngredientRows: document.querySelector("#recipeIngredientRows"),
  addRecipeIngredient: document.querySelector("#addRecipeIngredient"),
  cashflowExpenseForm: document.querySelector("#cashflowExpenseForm"),
  cfExpenseNote: document.querySelector("#cfExpenseNote"),
  cfIngredientQtyWrap: document.querySelector("#cfIngredientQtyWrap"),
  cfExpenseQty: document.querySelector("#cfExpenseQty"),
  cfExpenseUnit: document.querySelector("#cfExpenseUnit"),
  cfExpenseAmount: document.querySelector("#cfExpenseAmount"),
  cfExpenseCategory: document.querySelector("#cfExpenseCategory"),
  cashflowList: document.querySelector("#cashflowList"),
  cfTotalIn: document.querySelector("#cfTotalIn"),
  cfTotalOut: document.querySelector("#cfTotalOut"),
  cfNet: document.querySelector("#cfNet"),
  cfInCount: document.querySelector("#cfInCount"),
  cfOutCount: document.querySelector("#cfOutCount"),
  cfNetLabel: document.querySelector("#cfNetLabel"),
  cfFilterTabs: document.querySelector("#cfFilterTabs"),
  cashflowMonth: document.querySelector("#cashflowMonth"),
  boothVideo: document.querySelector("#boothVideo"),
  cameraPlaceholder: document.querySelector("#cameraPlaceholder"),
  startCamera: document.querySelector("#startCamera"),
  capturePhoto: document.querySelector("#capturePhoto"),
  boothStatus: document.querySelector("#boothStatus"),
  boothCustomer: document.querySelector("#boothCustomer"),
  boothSessionPackage: document.querySelector("#boothSessionPackage"),
  photoCount: document.querySelector("#photoCount"),
  boothCanvas: document.querySelector("#boothCanvas"),
  resetBooth: document.querySelector("#resetBooth"),
  downloadBooth: document.querySelector("#downloadBooth"),
  boothQueue: document.querySelector("#boothQueue"),
  toast: document.querySelector("#toast"),
};

function money(value) {
  return rupiah.format(value || 0).replace(/\u00a0/g, " ");
}

function parseRupiah(value) {
  return Number(String(value || "").replace(/[^\d]/g, "")) || 0;
}

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayOrderPrefix(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return ["M", "S", "SS", "R", "K", "J", "SB"][date.getDay()];
}

function isOnlineChannel(channel) {
  return ["GoFood", "GrabFood", "ShopeeFood"].includes(channel);
}

function currentShiftName(value = new Date()) {
  return autoShiftName(value);
}

function autoShiftName(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.getHours() >= 17 ? "Shift 2" : "Shift 1";
}

function shiftScheduleText(value = new Date()) {
  const shift = currentShiftName(value);
  return `${shift} · ${shift === "Shift 1" ? "10.00-17.00" : "17.00-22.00"}`;
}

function isShiftOperating(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const hour = date.getHours();
  return hour >= 10 && hour < 22;
}

function orderSequenceFromId(id, prefix) {
  const match = String(id || "").match(new RegExp(`^${prefix}-(\\d+)(?:-O)?$`));
  return match ? Number(match[1]) : 0;
}

function nextDailyOrderCode(date = new Date(), channel = state.orderChannel) {
  const prefix = dayOrderPrefix(date);
  const today = dateKey(date);
  const existing = [...getHistory(), ...getOrderDrafts()].filter((entry) => dateKey(entry.createdAt) === today);
  const highest = existing.reduce((max, entry) => Math.max(max, orderSequenceFromId(entry.id, prefix)), 0);
  const number = String(highest + 1).padStart(3, "0");
  return `${prefix}-${number}${isOnlineChannel(channel) ? "-O" : ""}`;
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
}

function normalizeEmployeeRoster(value) {
  const names = Array.isArray(value)
    ? value
    : String(value || "")
        .split("\n")
        .map((name) => name.trim());
  const unique = [];
  names.forEach((name) => {
    if (name && !unique.some((entry) => entry.toLowerCase() === name.toLowerCase())) unique.push(name);
  });
  return unique.length ? unique : ["Admin"];
}

function getEmployeeRoster() {
  return normalizeEmployeeRoster(readJson(storageKeys.employees, ["Admin"]));
}

function saveEmployeeRoster(names) {
  const roster = normalizeEmployeeRoster(names);
  writeJson(storageKeys.employees, roster);
  return roster;
}

function activeEmployeeName() {
  return localStorage.getItem(storageKeys.employee) || getEmployeeRoster()[0] || "Admin";
}

function renderEmployeeControls() {
  const roster = getEmployeeRoster();
  const active = roster.includes(activeEmployeeName()) ? activeEmployeeName() : roster[0];
  localStorage.setItem(storageKeys.employee, active);
  if (els.employeeName) els.employeeName.value = active;
  if (els.activeEmployeeHeader) els.activeEmployeeHeader.textContent = active;
  if (els.employeeList) {
    els.employeeList.innerHTML = roster
      .map((name) => {
        const safeName = escapeHtml(name);
        const encodedName = encodeURIComponent(name);
        return `
          <article class="employee-list-row ${name === active ? "active" : ""}">
            <span>${safeName}</span>
            <div>
              <button class="secondary-button compact" data-use-employee="${encodedName}" type="button">Pakai</button>
              <button class="secondary-button compact danger-text" data-delete-employee="${encodedName}" type="button" ${roster.length <= 1 ? "disabled" : ""}>Hapus</button>
            </div>
          </article>
        `;
      })
      .join("");
  }
  if (els.loginEmployee) {
    els.loginEmployee.replaceChildren(...roster.map((name) => new Option(name, name)));
    els.loginEmployee.value = active;
  }
  if (els.loginShift) els.loginShift.value = shiftScheduleText();
}

function initAuth() {
  const auth = readJson(storageKeys.auth, null);
  renderEmployeeControls();
  if (!auth?.loggedIn) {
    document.body.classList.add("locked");
    setTimeout(() => els.loginUsername?.focus(), 50);
  } else {
    if (auth.employee) localStorage.setItem(storageKeys.employee, auth.employee);
    localStorage.removeItem(storageKeys.sessionShift);
    renderEmployeeControls();
  }
}

function ensureDeviceId() {
  let deviceId = localStorage.getItem(storageKeys.deviceId);
  if (deviceId) return deviceId;
  deviceId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(storageKeys.deviceId, deviceId);
  return deviceId;
}

async function checkOtherActiveDevice(employee) {
  if (!navigator.onLine) return { otherActive: false };
  const response = await fetch("/api/supabase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "device-presence",
      deviceId: ensureDeviceId(),
      employee,
      checkOnly: true,
    }),
  });
  if (!response.ok) return { otherActive: false };
  return response.json();
}

async function confirmLoginDevice(employee) {
  try {
    const result = await checkOtherActiveDevice(employee);
    if (!result?.otherActive) return true;
    const activeEmployee = result.activeDevice?.employee || "petugas lain";
    return window.confirm(`Kasir sedang aktif di device lain oleh ${activeEmployee}. Lanjutkan login di device ini?`);
  } catch {
    return true;
  }
}

async function login(event) {
  event.preventDefault();
  const username = els.loginUsername.value.trim();
  const password = els.loginPassword.value;
  if (username === "kopimigi" && password === "migi46") {
    const employee = els.loginEmployee?.value || getEmployeeRoster()[0] || "Admin";
    const confirmed = await confirmLoginDevice(employee);
    if (!confirmed) {
      els.loginPassword.value = "";
      toast("Login dibatalkan.");
      return;
    }
    const shift = currentShiftName();
    localStorage.setItem(storageKeys.employee, employee);
    writeJson(storageKeys.auth, { loggedIn: true, employee, shift, at: new Date().toISOString() });
    renderEmployeeControls();
    document.body.classList.remove("locked");
    els.loginPassword.value = "";
    setActiveView("pos");
    toast(`Masuk sebagai ${employee} · ${shift}.`);
    updateDevicePresence().catch(() => null);
    syncCloudData();
    return;
  }

  els.loginHint.textContent = "Username atau password salah.";
  els.loginHint.style.color = "var(--danger)";
  els.loginPassword.value = "";
  els.loginPassword.focus();
}

function logout() {
  clearDevicePresence().catch(() => null);
  localStorage.removeItem(storageKeys.auth);
  document.body.classList.add("locked");
  els.loginPassword.value = "";
  renderEmployeeControls();
  setTimeout(() => els.loginUsername?.focus(), 50);
  toast("Kasir logout.");
}

function isLoggedIn() {
  return Boolean(readJson(storageKeys.auth, null)?.loggedIn);
}

function updateAuthShift(shift) {
  const auth = readJson(storageKeys.auth, null);
  if (!auth?.loggedIn || auth.shift === shift) return false;
  writeJson(storageKeys.auth, { ...auth, shift, shiftedAt: new Date().toISOString() });
  return true;
}

function updateEmployeeHeaderState(now = new Date()) {
  if (!els.activeEmployeeCard) return;
  const active = isLoggedIn() && isShiftOperating(now);
  els.activeEmployeeCard.classList.toggle("shift-active", active);
  els.activeEmployeeCard.title = active ? `${currentShiftName(now)} aktif` : "Di luar jam shift";
}

function markShiftActionOnce(action, date = new Date()) {
  const key = `${dateKey(date)}:${action}`;
  const actions = readJson(storageKeys.shiftActions, {});
  if (actions[key]) return false;
  actions[key] = new Date().toISOString();
  writeJson(storageKeys.shiftActions, actions);
  return true;
}

function runShiftScheduleChecks(now = new Date()) {
  const hour = now.getHours();
  const minute = now.getMinutes();
  if (minute !== 0) return;

  if (hour === 14 && markShiftActionOnce("shift-2-arrival", now)) {
    setTimeout(() => {
      window.confirm("Shift 2 sudah hadir. Semua transaksi tetap masuk Shift 1 sampai 17.00. Lanjutkan kasir Shift 1?");
    }, 0);
  }

  if (!isLoggedIn()) return;

  if (hour === 17 && markShiftActionOnce("shift-1-close", now)) {
    updateAuthShift("Shift 2");
    setTimeout(() => window.alert("17.00: Shift 1 ditutup. Akun kasir otomatis pindah ke Shift 2."), 0);
  }

  if (hour === 22 && markShiftActionOnce("shift-2-close", now)) {
    logout();
    setTimeout(() => window.alert("22.00: Shift 2 ditutup. Laporan harian siap dicek."), 0);
  }
}

function updateClock() {
  const now = new Date();
  els.todayLabel.textContent = now.toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short" });
  els.clockLabel.textContent = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (els.loginShift) els.loginShift.value = shiftScheduleText(now);
  if (els.orderShift) els.orderShift.value = currentShiftName(now);
  if (els.activeEmployeeHeader) els.activeEmployeeHeader.textContent = activeEmployeeName();
  if (isLoggedIn()) updateAuthShift(currentShiftName(now));
  updateEmployeeHeaderState(now);
  runShiftScheduleChecks(now);
}

function getMenu() {
  const saved = readJson(storageKeys.menu, null);
  if (saved?.length) return saved;
  writeJson(storageKeys.menu, defaultMenu);
  return defaultMenu;
}

function getMenuCategories() {
  return [...new Set(getMenu().map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id-ID"));
}

function getHistory() {
  return readJson(storageKeys.history, []);
}

function getInventory() {
  return readJson(storageKeys.inventory, {});
}

function saveInventory(inventory) {
  writeJson(storageKeys.inventory, inventory);
}

function getPurchases() {
  return readJson(storageKeys.purchases, []);
}

function getOrderDrafts() {
  return readJson(storageKeys.orderDrafts, []);
}

function saveOrderDrafts(drafts) {
  writeJson(storageKeys.orderDrafts, drafts);
}

function openOfflineDb() {
  if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB tidak tersedia."));
  if (offlineDbPromise) return offlineDbPromise;
  offlineDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(offlineDbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(offlineStoreName)) {
        const store = db.createObjectStore(offlineStoreName, { keyPath: "localId" });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return offlineDbPromise;
}

async function offlineStore(mode = "readonly") {
  const db = await openOfflineDb();
  return db.transaction(offlineStoreName, mode).objectStore(offlineStoreName);
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveOfflineTransaction(transaction, patch = {}) {
  const localId = transaction.localId || transaction.id;
  const existing = await idbRequest((await offlineStore("readonly")).get(localId)).catch(() => null);
  const record = {
    ...existing,
    ...transaction,
    ...patch,
    localId,
    idempotencyKey: transaction.idempotencyKey || localId,
    syncStatus: patch.syncStatus || existing?.syncStatus || "PENDING_SYNC",
    printStatus: patch.printStatus || existing?.printStatus || "PRINT_PENDING",
    updatedAt: new Date().toISOString(),
  };
  await idbRequest((await offlineStore("readwrite")).put(record));
  return record;
}

async function updateOfflineTransaction(localId, patch) {
  const existing = await idbRequest((await offlineStore("readonly")).get(localId));
  if (!existing) return null;
  const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await idbRequest((await offlineStore("readwrite")).put(next));
  return next;
}

async function getOfflineTransactions() {
  const store = await offlineStore("readonly");
  return idbRequest(store.getAll()).catch(() => []);
}

async function pendingOfflineTransactions() {
  return (await getOfflineTransactions()).filter((entry) => entry.syncStatus !== "SYNCED");
}

function getRecipes() {
  return readJson(storageKeys.recipes, {});
}

function saveRecipes(recipes) {
  writeJson(storageKeys.recipes, recipes);
}

function getSettingsPayload() {
  return {
    menu: getMenu(),
    recipes: getRecipes(),
  };
}

function markSettingsDirty() {
  localStorage.setItem(storageKeys.settingsDirty, "true");
}

function clearSettingsDirty() {
  localStorage.removeItem(storageKeys.settingsDirty);
}

function hasDirtySettings() {
  return localStorage.getItem(storageKeys.settingsDirty) === "true";
}

function applyCloudSettings(settings) {
  if (!settings || typeof settings !== "object") return false;
  let changed = false;
  if (Array.isArray(settings.menu) && settings.menu.length) {
    writeJson(storageKeys.menu, settings.menu);
    changed = true;
  }
  if (settings.recipes && typeof settings.recipes === "object" && !Array.isArray(settings.recipes)) {
    saveRecipes(settings.recipes);
    changed = true;
  }
  return changed;
}

function getCashflowExpenses() {
  return readJson(storageKeys.cashflowExpenses, []);
}

function saveCashflowExpense(expense) {
  const expenses = getCashflowExpenses();
  expenses.unshift(expense);
  writeJson(storageKeys.cashflowExpenses, expenses.slice(0, 500));
}

function getPendingDeletes() {
  return readJson(storageKeys.pendingDeletes, []);
}

function savePendingDeletes(deletes) {
  writeJson(storageKeys.pendingDeletes, deletes);
}

function queuePendingDelete(type, id) {
  const deletes = getPendingDeletes();
  if (deletes.some((entry) => entry.type === type && entry.id === id)) return;
  deletes.push({ type, id, createdAt: new Date().toISOString() });
  savePendingDeletes(deletes);
}

function getBoothSessions() {
  return readJson(storageKeys.booth, []);
}

function getLegacyBoothSessions() {
  return readJson(storageKeys.boothLegacy, []);
}

function saveLegacyBoothSessions(sessions) {
  writeJson(storageKeys.boothLegacy, sessions);
  boothSyncChannel?.postMessage({ action: "update_sessions", data: sessions, sender: "cashier", timestamp: Date.now() });
}

async function sendBoothServerAction(action, code, payload = {}) {
  void action;
  void code;
  void payload;
  return false;
}

if (boothSyncChannel) {
  boothSyncChannel.onmessage = (event) => {
    const { action, data, sender } = event.data || {};
    if (sender !== "booth") return;

    const sessions = getLegacyBoothSessions();
    if (action === "request_sync") {
      saveLegacyBoothSessions(sessions);
      return;
    }

    if (action === "claim_code") {
      const session = sessions.find((entry) => entry.code === data?.code && entry.status === "unused");
      if (session) {
        session.status = "active";
        saveLegacyBoothSessions(sessions);
        boothSyncChannel.postMessage({ action: "code_claimed_ok", data: { code: data.code }, sender: "cashier" });
      }
      return;
    }

    if (action === "release_code") {
      const session = sessions.find((entry) => entry.code === data?.code && entry.status === "active");
      if (session) {
        session.status = "unused";
        saveLegacyBoothSessions(sessions);
      }
      return;
    }

    if (action === "finish_session") {
      const session = sessions.find((entry) => entry.code === data?.code);
      if (session) {
        session.status = "used";
        saveLegacyBoothSessions(sessions);
      }
    }
  };
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function setPrinterStatus(status, tone, hint) {
  els.printerStatus.textContent = status;
  els.printerStatus.className = `printer-status ${tone}`;
  els.printerToggle.classList.remove("disconnected", "connecting", "connected");
  els.printerToggle.classList.add(tone);
  els.connectPrinter.textContent = tone === "connected" ? "Ganti Printer" : tone === "connecting" ? "Menghubungkan..." : "Sambungkan Printer";
  els.connectPrinter.disabled = tone === "connecting";
  els.printerHint.textContent = hint;
}

function togglePrinterDropdown(force) {
  const isOpen = force ?? !els.printerDropdown.classList.contains("open");
  els.printerDropdown.classList.toggle("open", isOpen);
  els.printerToggle.classList.toggle("active", isOpen);
  els.printerToggle.setAttribute("aria-expanded", String(isOpen));
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    toast("Fullscreen belum bisa diaktifkan di browser ini.");
  }
}

function syncFullscreenButton() {
  els.fullscreenToggle?.classList.toggle("active", !!document.fullscreenElement);
}

async function connectPrinter() {
  if (!navigator.bluetooth) {
    toast("Web Bluetooth belum didukung. Coba Chrome atau Brave desktop.");
    setPrinterStatus("Tidak didukung", "disconnected", "Browser ini belum mendukung Web Bluetooth.");
    return;
  }

  setPrinterStatus("Menghubungkan", "connecting", "Pilih printer thermal ESC/POS dari dialog Bluetooth.");
  try {
    state.printerDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: bleServiceUuids,
    });

    state.printerDevice.addEventListener("gattserverdisconnected", () => {
      state.printerCharacteristic = null;
      setPrinterStatus("Terputus", "disconnected", "Printer terputus. Sambungkan ulang sebelum cetak.");
      toast("Printer Bluetooth terputus.");
    });

    const server = await state.printerDevice.gatt.connect();
    let service = null;
    for (const uuid of bleServiceUuids) {
      try {
        service = await server.getPrimaryService(uuid);
        break;
      } catch {}
    }
    if (!service) {
      const services = await server.getPrimaryServices();
      service = services[0];
    }
    if (!service) throw new Error("Service printer tidak ditemukan.");

    let characteristic = null;
    for (const uuid of bleCharacteristicUuids) {
      try {
        characteristic = await service.getCharacteristic(uuid);
        break;
      } catch {}
    }
    if (!characteristic) {
      const chars = await service.getCharacteristics();
      characteristic = chars.find((entry) => entry.properties.write || entry.properties.writeWithoutResponse);
    }
    if (!characteristic) throw new Error("Characteristic printer tidak ditemukan.");

    state.printerCharacteristic = characteristic;
    setPrinterStatus("Tersambung", "connected", `${state.printerDevice.name || "Printer ESC/POS"} siap untuk cetak struk.`);
    toast("Printer termal tersambung.");
  } catch (error) {
    state.printerCharacteristic = null;
    setPrinterStatus("Terputus", "disconnected", "Koneksi gagal atau dibatalkan. Coba sambungkan lagi.");
    if (!String(error.message).toLowerCase().includes("cancel")) {
      toast(`Koneksi printer gagal: ${error.message}`);
    }
  }
}

async function testLogoPrint() {
  if (!state.printerCharacteristic) {
    toast("Sambungkan printer dulu untuk test logo.");
    togglePrinterDropdown(true);
    return;
  }

  try {
    els.testLogoPrint.disabled = true;
    els.testLogoPrint.textContent = "Mengirim...";
    const encoder = new TextEncoder();
    const bytes = new Uint8Array([
      0x1b, 0x40,
      ...(await escPosLogoBytes()),
      ...encoder.encode("Test logo Kopi Migi\n\n"),
      0x1d, 0x56, 0x42, 0x00,
    ]);
    await writePrinterChunks(bytes);
    toast("Test logo dikirim ke printer.");
  } catch (error) {
    toast(`Test logo gagal: ${error.message}`);
  } finally {
    els.testLogoPrint.disabled = false;
    els.testLogoPrint.textContent = "Test Logo";
  }
}

function idFromName(name) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now().toString(36)}`;
}

function stableIdFromName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `bahan-${Date.now().toString(36)}`;
}

function itemArt(item) {
  const category = item.category.toLowerCase();
  if (category.includes("photo")) return "art-photo";
  if (category.includes("snack") || category.includes("food")) return "art-food";
  if (category.includes("non") || category.includes("milk") || category.includes("latte")) return "art-milk";
  return "art-coffee";
}

function itemVisual(item) {
  if (item.image) {
    return `<img class="item-image" src="${item.image}" alt="" />`;
  }
  return `<span class="item-art ${itemArt(item)}" aria-hidden="true">${itemLabel(item)}</span>`;
}

function itemLabel(item) {
  return item.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

function isPhotoboothItem(item) {
  return Boolean(item?.boothPackage || item?.category?.toLowerCase().includes("photo"));
}

function hasPhotoboothCart() {
  return state.cart.some((entry) => isPhotoboothItem(entry));
}

function photoboothOrderQty() {
  return state.cart.reduce((sum, entry) => sum + (isPhotoboothItem(entry) ? entry.qty : 0), 0);
}

function boothPhotoCount(packageName = els.boothPackage.value) {
  return boothPackagePhotoCounts[packageName] || 2;
}

function totals() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  return { subtotal, grandTotal: subtotal };
}

function renderCategories() {
  const categories = ["Semua", ...getMenuCategories()];
  els.categoryTabs.innerHTML = categories
    .map((category) => `<button class="${category === state.category ? "active" : ""}" data-category="${category}" type="button">${category}</button>`)
    .join("");
}

function syncMenuCategoryField() {
  const isCustom = els.menuCategorySelect.value === "__custom";
  els.menuCategoryCustom.classList.toggle("hidden-field", !isCustom);
  els.menuCategoryCustom.toggleAttribute("required", isCustom);
  els.menuCategory.value = isCustom ? els.menuCategoryCustom.value.trim() : els.menuCategorySelect.value;
}

function renderMenuCategoryOptions(selectedCategory = els.menuCategory.value) {
  const categories = getMenuCategories();
  const hasSelected = categories.includes(selectedCategory);
  els.menuCategorySelect.innerHTML = [
    `<option value="" disabled ${selectedCategory ? "" : "selected"}>Pilih kategori</option>`,
    ...categories.map((category) => `<option value="${category}" ${category === selectedCategory ? "selected" : ""}>${category}</option>`),
    `<option value="__custom" ${selectedCategory && !hasSelected ? "selected" : ""}>+ Kategori baru</option>`,
  ].join("");
  els.menuCategoryCustom.value = selectedCategory && !hasSelected ? selectedCategory : "";
  syncMenuCategoryField();
}

function renderMenuGrid() {
  const keyword = state.search.toLowerCase();
  const filtered = getMenu().filter((item) => {
    const matchesCategory = state.category === "Semua" || item.category === state.category;
    const matchesSearch = `${item.name} ${item.category}`.toLowerCase().includes(keyword);
    return matchesCategory && matchesSearch;
  });

  els.menuGrid.innerHTML = filtered.length
    ? filtered
        .map(
          (item) => {
            const cartItem = state.cart.find((entry) => entry.id === item.id);
            const qty = cartItem?.qty || 0;
            return `
            <article class="menu-card ${qty ? "selected" : ""}" data-id="${item.id}" role="button" tabindex="0" aria-label="Tambah ${item.name}">
              ${qty ? `<span class="menu-qty-control"><button class="menu-qty-btn" data-menu-decrease="${item.id}" type="button" title="Kurangi ${item.name}">-</button><strong>${qty}</strong><button class="menu-qty-btn" data-menu-increase="${item.id}" type="button" title="Tambah ${item.name}">+</button></span>` : ""}
              ${itemVisual(item)}
              <span>
                <strong>${item.name}</strong>
                <span>${item.category} <b>${money(item.price)}</b></span>
              </span>
            </article>
          `;
          },
        )
        .join("")
    : `<div class="empty-state">Menu tidak ditemukan.</div>`;
}

function renderMenuTable() {
  const recipes = getRecipes();
  const rows = getMenu()
    .map(
      (item) => {
        const recipeCount = recipes[item.id]?.length || 0;
        return `
          <article class="menu-row">
            <div class="menu-row-main">
              <span class="menu-thumb">${itemVisual(item)}</span>
              <div>
                <strong>${item.name}</strong>
                <span>${item.category} · ${money(item.price)} · ${recipeCount ? `${recipeCount} bahan` : "Belum ada resep"}</span>
              </div>
            </div>
            <div class="history-actions">
              <button class="secondary-button compact" data-edit-menu="${item.id}" type="button">Edit</button>
              <button class="secondary-button compact danger-text" data-delete-menu="${item.id}" type="button">Hapus</button>
            </div>
          </article>
        `;
      },
    )
    .join("");

  els.menuTable.innerHTML = rows || `<div class="empty-state">Belum ada menu.</div>`;
}

function ingredientOptions(selectedId = "") {
  const ingredients = Object.entries(getInventory()).filter(([, item]) => item?.name);
  return ingredients.length
    ? `<option value="" disabled ${selectedId ? "" : "selected"}>Pilih bahan</option>` +
        ingredients
        .map(([id, item]) => `<option value="${id}" ${id === selectedId ? "selected" : ""}>${item.name}</option>`)
        .join("")
    : `<option value="" disabled selected>Tambahkan bahan dulu</option>`;
}

function recipeRowHtml(recipe = {}) {
  const ingredient = getInventory()[recipe.ingredientId];
  return `
    <div class="recipe-ingredient-row">
      <label>
        Bahan
        <select class="recipe-ingredient-select">
          ${ingredientOptions(recipe.ingredientId)}
        </select>
      </label>
      <label>
        Dipakai / porsi
        <input class="recipe-qty-input" type="number" min="0.01" step="0.01" placeholder="18" value="${recipe.qty || ""}" />
      </label>
      <label>
        Satuan
        <input class="recipe-unit-preview" type="text" value="${ingredient?.unit || ""}" disabled />
      </label>
      <button class="secondary-button compact danger-text recipe-remove-button" type="button" aria-label="Hapus bahan">Hapus</button>
    </div>
  `;
}

function renderRecipeRows(menuId = els.menuId?.value) {
  if (!els.recipeIngredientRows) return;
  const rows = getRecipes()[menuId] || [];
  els.recipeIngredientRows.innerHTML = rows.length ? rows.map(recipeRowHtml).join("") : recipeRowHtml();
  updateRecipeRowUnits();
}

function updateRecipeRowUnits() {
  if (!els.recipeIngredientRows) return;
  const inventory = getInventory();
  els.recipeIngredientRows.querySelectorAll(".recipe-ingredient-row").forEach((row) => {
    const select = row.querySelector(".recipe-ingredient-select");
    const unit = row.querySelector(".recipe-unit-preview");
    if (unit) unit.value = inventory[select?.value]?.unit || "";
  });
}

function collectRecipeRows() {
  const inventory = getInventory();
  const rows = Array.from(els.recipeIngredientRows?.querySelectorAll(".recipe-ingredient-row") || []);
  const filledRows = [];
  for (const row of rows) {
    const ingredientId = row.querySelector(".recipe-ingredient-select")?.value || "";
    const qtyValue = row.querySelector(".recipe-qty-input")?.value || "";
    const qty = Number(qtyValue);
    if (!ingredientId && !qtyValue) continue;
    if (!inventory[ingredientId] || !Number.isFinite(qty) || qty <= 0) {
      toast("Lengkapi bahan dan jumlah pemakaian, atau kosongkan barisnya.");
      return null;
    }
    filledRows.push({ ingredientId, qty });
  }

  const duplicateIngredient = filledRows.find((row, index) => filledRows.findIndex((entry) => entry.ingredientId === row.ingredientId) !== index);
  if (duplicateIngredient) {
    toast("Bahan yang sama cukup diisi satu kali per menu.");
    return null;
  }
  return filledRows;
}

function renderRecipeOptions() {
  renderRecipeRows(els.menuId?.value || "");
}

function stockStatus(record) {
  const stock = Number(record.stock || 0);
  const unit = record.unit || "";
  const lowLimit = unit === "pcs" ? 5 : 100;
  if (stock <= 0) return { tone: "danger", label: "Habis" };
  if (stock <= lowLimit) return { tone: "danger", label: "Akan habis" };
  return { tone: "good", label: "Aman" };
}

function stockChartPercent(record) {
  const stock = Math.max(0, Number(record.stock || 0));
  const unit = record.unit || "";
  const target = unit === "pcs" ? 20 : 1000;
  if (!target) return 0;
  return Math.min(100, Math.round((stock / target) * 100));
}

function renderInventory() {
  if (!els.stockTable) return;
  const inventory = getInventory();
  const inventoryRows = Object.entries(inventory).filter(([, record]) => record?.name);
  const lowRows = inventoryRows.filter(([, record]) => stockStatus(record).tone === "danger");
  if (els.stockAlert) {
    els.stockAlert.hidden = lowRows.length === 0;
    els.stockAlert.innerHTML = lowRows.length
      ? `<strong>Alert stok menipis</strong><span>${lowRows.map(([, record]) => `${record.name}: ${Number(record.stock || 0).toLocaleString("id-ID")} ${record.unit || ""}`).join(" · ")}</span>`
      : "";
  }
  if (els.stockAvailabilityList) {
    els.stockAvailabilityList.innerHTML = inventoryRows.length
      ? inventoryRows
          .map(([, record]) => {
            const status = stockStatus(record);
            const percent = stockChartPercent(record);
            return `
            <article class="stock-chart-row stock-${status.tone}">
              <div class="stock-chart-copy">
                <strong>${record.name}</strong>
                <span>${status.label}${record.buyPrice ? ` · ${money(record.buyPrice)}/${record.unit || "unit"}` : ""}</span>
              </div>
              <div class="stock-chart-meter" aria-label="${record.name} ${percent}%">
                <span class="stock-chart-fill" style="width:${percent}%;min-width:${percent ? 6 : 0}px"></span>
              </div>
              <strong class="stock-chart-value">${Number(record.stock || 0).toLocaleString("id-ID")} ${record.unit || ""}</strong>
            </article>
          `;
          })
          .join("")
      : `<div class="empty-state">Belum ada bahan baku.</div>`;
  }
  els.stockTable.innerHTML = inventoryRows.length
    ? inventoryRows
        .map(([id, record]) => {
          const stock = Number(record.stock || 0);
          const status = stockStatus(record);
          return `
        <article class="stock-row stock-${status.tone}">
          <div class="menu-row-main">
            <span class="menu-thumb item-art art-coffee"></span>
            <div>
              <strong>${record.name}</strong>
              <span>${record.unit || "unit"}${record.buyPrice ? ` · ${money(record.buyPrice)}/${record.unit || "unit"}` : ""} · ${status.label} · update ${new Date(record.updatedAt || Date.now()).toLocaleDateString("id-ID")}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <strong>${stock.toLocaleString("id-ID")} ${record.unit || ""}</strong>
            <button class="secondary-button compact" data-edit-stock="${id}" type="button">Edit</button>
            <button class="secondary-button compact danger-text" data-delete-stock="${id}" type="button">Hapus</button>
          </div>
        </article>
      `;
        })
        .join("")
    : `<div class="empty-state">Belum ada stock bahan baku.</div>`;

}

function renderCashflow() {
  const month = els.cashflowMonth?.value || new Date().toISOString().slice(0, 7);
  const expenses = getCashflowExpenses().filter((entry) => entry.createdAt?.slice(0, 7) === month);
  const salesIn = getHistory()
    .filter((entry) => entry.createdAt?.slice(0, 7) === month)
    .reduce((sum, entry) => sum + entry.grandTotal, 0);
  const totalOut = expenses.reduce((sum, entry) => sum + entry.amount, 0);
  const net = salesIn - totalOut;

  if (els.cfTotalIn) els.cfTotalIn.textContent = money(salesIn);
  if (els.cfInCount) els.cfInCount.textContent = `${getHistory().filter((entry) => entry.createdAt?.slice(0, 7) === month).length} transaksi`;
  if (els.cfTotalOut) els.cfTotalOut.textContent = money(totalOut);
  if (els.cfOutCount) els.cfOutCount.textContent = `${expenses.length} pengeluaran`;
  if (els.cfNet) els.cfNet.textContent = money(net);
  if (els.cfNetLabel) els.cfNetLabel.textContent = net >= 0 ? "surplus bulan ini" : "defisit bulan ini";

  const activeFilter = els.cfFilterTabs?.querySelector("button.active")?.dataset?.cfFilter || "all";
  const salesList = getHistory()
    .filter((entry) => entry.createdAt?.slice(0, 7) === month)
    .map((entry) => ({ type: "in", label: `Penjualan · ${entry.id}`, amount: entry.grandTotal, note: entry.customer, createdAt: entry.createdAt }));
  const expenseList = expenses.map((entry) => ({
    type: "out",
    label: entry.note,
    amount: entry.amount,
    note: `${entry.category}${entry.qty ? ` · ${Number(entry.qty).toLocaleString("id-ID")} ${entry.unit || ""}` : ""}`,
    createdAt: entry.createdAt,
    id: entry.id,
  }));

  let combined = [...salesList, ...expenseList].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (activeFilter === "in") combined = combined.filter((entry) => entry.type === "in");
  if (activeFilter === "out") combined = combined.filter((entry) => entry.type === "out");

  if (els.cashflowList) {
    els.cashflowList.innerHTML = combined.length
      ? combined.map((entry) => `
          <article class="history-card" style="border-left:3px solid ${entry.type === "in" ? "#2f7a46" : "#e05c3a"};">
            <div style="flex:1;">
              <strong style="color:${entry.type === "in" ? "#2f7a46" : "#e05c3a"}">${entry.type === "in" ? "+" : "-"}${money(entry.amount)}</strong>
              <p>${entry.label}</p>
              <p style="color:var(--muted)">${entry.note} · ${new Date(entry.createdAt).toLocaleString("id-ID")}</p>
            </div>
            ${entry.type === "out" ? `<button class="secondary-button compact danger-text" data-delete-expense="${entry.id}" type="button">Hapus</button>` : ""}
          </article>
        `).join("")
      : `<div class="empty-state">Belum ada mutasi kas di bulan ini.</div>`;
  }
}

function syncCfExpenseNoteField() {
  if (!els.cfExpenseCategory || !els.cfExpenseNote) return;
  const category = els.cfExpenseCategory.value;
  if (category === "Bahan Baku") {
    const inventory = getInventory();
    const items = Object.entries(inventory).filter(([, record]) => record?.name);
    if (els.cfIngredientQtyWrap) els.cfIngredientQtyWrap.hidden = false;
    const currentValue = els.cfExpenseNote.value;
    const options = items.length
      ? items.map(([id, item]) => `<option value="${id}">${item.name}</option>`).join("")
      : `<option value="" disabled selected>Input bahan di Stock Bahan Baku dulu</option>`;

    if (els.cfExpenseNote.tagName === "INPUT") {
      const select = document.createElement("select");
      select.id = "cfExpenseNote";
      select.name = "cfExpenseNote";
      select.className = els.cfExpenseNote.className;
      select.required = true;
      select.innerHTML = options;
      els.cfExpenseNote.replaceWith(select);
      els.cfExpenseNote = select;
    } else {
      els.cfExpenseNote.innerHTML = options;
    }

    if (items.some(([id]) => id === currentValue)) els.cfExpenseNote.value = currentValue;
    const selected = inventory[els.cfExpenseNote.value];
    if (els.cfExpenseUnit) els.cfExpenseUnit.value = selected?.unit || "gram";
    return;
  }
  if (els.cfIngredientQtyWrap) els.cfIngredientQtyWrap.hidden = true;
  if (els.cfExpenseQty) els.cfExpenseQty.value = "";
  if (els.cfExpenseUnit) els.cfExpenseUnit.value = "gram";
  if (els.cfExpenseNote.tagName === "SELECT") {
    const input = document.createElement("input");
    input.id = "cfExpenseNote";
    input.name = "cfExpenseNote";
    input.type = "text";
    input.className = els.cfExpenseNote.className;
    input.placeholder = "Beli gelas, bayar listrik, dll";
    input.required = true;
    els.cfExpenseNote.replaceWith(input);
    els.cfExpenseNote = input;
  } else {
    els.cfExpenseNote.placeholder = "Beli gelas, bayar listrik, dll";
  }
}

function renderCart() {
  els.checkoutPanel?.classList.toggle("has-items", state.cart.length > 0);
  els.checkoutPanel?.classList.toggle("has-booth", hasPhotoboothCart());
  els.orderModal?.classList.toggle("has-booth", hasPhotoboothCart());
  els.cartTitle.textContent = state.cart.length ? `${state.cart.reduce((sum, item) => sum + item.qty, 0)} item` : "Keranjang kosong";
  els.cartList.innerHTML = state.cart.length
    ? state.cart
        .map(
          (item) => `
            <div class="cart-item">
              <div>
                <strong>${item.name}</strong>
                <span>${money(item.price)} x ${item.qty}</span>
              </div>
              <div class="item-controls">
                <button class="qty-button" data-action="decrease" data-id="${item.id}" type="button">-</button>
                <strong>${item.qty}</strong>
                <button class="qty-button" data-action="increase" data-id="${item.id}" type="button">+</button>
              </div>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">Pilih menu untuk mulai order.</div>`;

  const total = totals();
  els.subtotal.textContent = money(total.subtotal);
  els.grandTotal.textContent = money(total.grandTotal);
  els.cartSubtotal.textContent = money(total.subtotal);
  els.cartGrandTotal.textContent = money(total.grandTotal);
  els.checkoutBtn.disabled = !state.cart.length;
  els.checkoutBtn.innerHTML = state.cart.length
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>Process Order`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>Pilih Menu`;
  updateChange();
}

function openOrderModal() {
  els.orderCustomerName.value = els.customerName.value || "Teman Migi";
  if (els.orderShift) els.orderShift.value = currentShiftName();
  els.orderTableNumber.value = state.activeDraftId || nextDailyOrderCode(new Date(), state.orderChannel);
  els.modalOrderList.innerHTML = state.cart.length
    ? state.cart
        .map(
          (item) => `
            <article class="modal-order-row">
              <div class="modal-order-copy">
                <strong>${item.name}</strong>
                <span>${item.category} · ${money(item.price)}</span>
              </div>
              <div class="modal-order-qty">${item.qty}x</div>
              <strong class="modal-order-price">${money(item.price * item.qty)}</strong>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state">Keranjang kosong.</div>`;
  els.orderModal.classList.add("open");
  els.orderModal.setAttribute("aria-hidden", "false");
  setTimeout(() => els.orderCustomerName.focus(), 60);
}

function closeOrderModal() {
  els.orderModal.classList.remove("open");
  els.orderModal.setAttribute("aria-hidden", "true");
}

function ensurePhotoboothCode(item) {
  if (!isPhotoboothItem(item)) return;
  if (item.boothPackage) els.boothPackage.value = item.boothPackage;
  if (!state.pendingBoothCode) state.pendingBoothCode = generateBoothCode();
  els.latestBoothCode.textContent = state.pendingBoothCode;
  upsertPendingBoothSession();
}

function syncPhotoboothCodeFromCart() {
  const boothItem = state.cart.find((entry) => isPhotoboothItem(entry));
  if (boothItem) {
    ensurePhotoboothCode(boothItem);
    return;
  }
  removePendingBoothSession();
  state.pendingBoothCode = "";
  els.latestBoothCode.textContent = "Belum ada";
}

function upsertPendingBoothSession(transaction = null) {
  if (!state.pendingBoothCode || !hasPhotoboothCart()) return "";
  const code = state.pendingBoothCode;
  const packageName = els.boothPackage.value || "classic";
  const now = new Date();
  const localSessions = getBoothSessions();
  const legacySessions = getLegacyBoothSessions();
  const customer = transaction?.customer || els.customerName.value.trim() || "Teman Migi";
  const transactionId = transaction?.id || "PENDING";
  const localIndex = localSessions.findIndex((session) => session.id === code);
  const legacyIndex = legacySessions.findIndex((session) => session.code === code);
  const localSession = {
    id: code,
    createdAt: transaction?.createdAt || localSessions[localIndex]?.createdAt || now.toISOString(),
    customer,
    package: packageName,
    photoCount: boothPhotoCount(packageName),
    printQuantity: transaction?.boothPrintQuantity || photoboothOrderQty(),
    transactionId,
    status: localSessions[localIndex]?.status || "Belum dipakai",
    image: localSessions[localIndex]?.image || "",
  };
  const legacySession = {
    code,
    status: legacySessions[legacyIndex]?.status || "unused",
    createdAt: legacySessions[legacyIndex]?.createdAt || now.getTime(),
    customer,
    package: packageName,
    photoCount: boothPhotoCount(packageName),
    printQuantity: transaction?.boothPrintQuantity || photoboothOrderQty(),
    transactionId,
  };

  if (localIndex >= 0) localSessions[localIndex] = { ...localSessions[localIndex], ...localSession };
  else localSessions.unshift(localSession);
  if (legacyIndex >= 0) legacySessions[legacyIndex] = { ...legacySessions[legacyIndex], ...legacySession };
  else legacySessions.unshift(legacySession);

  writeJson(storageKeys.booth, localSessions.slice(0, 50));
  saveLegacyBoothSessions(legacySessions.slice(0, 100));
  sendBoothServerAction("create", code, legacySession);
  return code;
}

function removePendingBoothSession() {
  if (!state.pendingBoothCode) return;
  const code = state.pendingBoothCode;
  writeJson(
    storageKeys.booth,
    getBoothSessions().filter((session) => !(session.id === code && session.status !== "Selesai")),
  );
  saveLegacyBoothSessions(getLegacyBoothSessions().filter((session) => !(session.code === code && session.status === "unused")));
  sendBoothServerAction("delete", code);
}

function addToCart(id) {
  const item = getMenu().find((entry) => entry.id === id);
  if (!item) return;
  const existing = state.cart.find((entry) => entry.id === id);
  if (existing) existing.qty += 1;
  else state.cart.push({ ...item, qty: 1 });

  ensurePhotoboothCode(item);

  renderCart();
  renderMenuGrid();
}

async function startOrder(event) {
  event.preventDefault();
  if (!state.cart.length) return;
  if (!validateStockForCart()) return;
  els.customerName.value = els.orderCustomerName.value.trim();
  els.tableNumber.value = els.orderTableNumber.value.trim();
  closeOrderModal();
  const transaction = currentTransaction(false);
  if (state.payment === "Tunai" && transaction.paid < transaction.grandTotal) {
    toast("Nominal tunai belum cukup.");
    return;
  }
  transaction.boothCode = createBoothQueue(transaction);
  deductStockForTransaction(transaction);
  const history = getHistory();
  history.unshift(transaction);
  writeJson(storageKeys.history, history.slice(0, 300));
  const offlineRecord = {
    ...transaction,
    localId: transaction.id,
    idempotencyKey: transaction.id,
    syncStatus: "PENDING_SYNC",
    printStatus: "PRINT_PENDING",
  };
  await saveOfflineTransaction(offlineRecord).catch(() => null);
  const printed = await printReceipt(transaction, "paid");
  await updateOfflineTransaction(transaction.id, { printStatus: printed ? "PRINTED" : "PRINT_FAILED" }).catch(() => null);
  state.cart = [];
  state.pendingBoothCode = "";
  els.paidAmount.value = "";
  els.customerName.value = "";
  els.tableNumber.value = "";
  els.boothPackage.value = "classic";
  if (els.orderShift) els.orderShift.value = currentShiftName();
  setOrderChannel("Kasir");
  if (state.activeDraftId) {
    saveOrderDrafts(getOrderDrafts().filter((entry) => entry.id !== state.activeDraftId));
    state.activeDraftId = "";
  }
  renderAll();
  syncPendingTransactions();
  toast(transaction.boothCode ? `Checkout selesai. Kode photobooth: ${transaction.boothCode}` : "Checkout selesai.");
}

function changeQty(id, delta) {
  const item = state.cart.find((entry) => entry.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) state.cart = state.cart.filter((entry) => entry.id !== id);
  syncPhotoboothCodeFromCart();
  renderCart();
  renderMenuGrid();
}

function updateChange() {
  const paid = parseRupiah(els.paidAmount.value);
  els.changeDue.textContent = money(Math.max(0, paid - totals().grandTotal));
}

function setOrderChannel(channel = "Kasir") {
  state.orderChannel = channel;
  els.orderChannels?.querySelectorAll("button[data-channel]").forEach((button) => {
    button.classList.toggle("active", button.dataset.channel === channel);
  });
  if (els.orderModal?.getAttribute("aria-hidden") === "false" && !state.activeDraftId) {
    els.orderTableNumber.value = nextDailyOrderCode(new Date(), state.orderChannel);
  }
}

function currentTransaction(draft = false) {
  const total = totals();
  const paid = parseRupiah(els.paidAmount.value);
  const now = new Date();
  const displayedOrderCode = els.orderTableNumber.value.trim();
  const generatedId = state.activeDraftId && !draft ? state.activeDraftId : displayedOrderCode || nextDailyOrderCode(now, state.orderChannel);
  return {
    id: generatedId,
    createdAt: now.toISOString(),
    customer: els.customerName.value.trim() || "Teman Migi",
    table: els.tableNumber.value.trim() || generatedId,
    shift: currentShiftName(now),
    channel: state.orderChannel || "Kasir",
    status: draft ? "unpaid" : "paid",
    employee: activeEmployeeName(),
    payment: state.payment,
    boothPackage: hasPhotoboothCart() ? els.boothPackage.value : "none",
    boothPrintQuantity: photoboothOrderQty(),
    boothCode: "",
    sendToBooth: hasPhotoboothCart(),
    paid,
    change: Math.max(0, paid - total.grandTotal),
    items: state.cart.map(({ id, name, category, price, qty }) => ({ id, name, category, price, qty })),
    ...total,
  };
}

function requiredIngredientsForItems(items) {
  const recipes = getRecipes();
  return items.reduce((required, item) => {
    (recipes[item.id] || []).forEach((recipe) => {
      required[recipe.ingredientId] = (required[recipe.ingredientId] || 0) + Number(recipe.qty || 0) * Number(item.qty || 0);
    });
    return required;
  }, {});
}

function validateStockForCart() {
  const inventory = getInventory();
  const required = requiredIngredientsForItems(state.cart);
  const missing = Object.entries(required).find(([ingredientId, qty]) => Number(inventory[ingredientId]?.stock || 0) < qty);
  if (!missing) return true;
  const [ingredientId, qty] = missing;
  const ingredient = inventory[ingredientId];
  toast(`Stok bahan ${ingredient?.name || "baku"} tidak cukup. Butuh ${qty.toLocaleString("id-ID")} ${ingredient?.unit || ""}, tersedia ${Number(ingredient?.stock || 0).toLocaleString("id-ID")}.`);
  return false;
}

function deductStockForTransaction(transaction) {
  const inventory = getInventory();
  const required = requiredIngredientsForItems(transaction.items);
  let changed = false;
  Object.entries(required).forEach(([ingredientId, qty]) => {
    if (!inventory[ingredientId]) return;
    inventory[ingredientId].stock = Math.max(0, Number(inventory[ingredientId].stock || 0) - qty);
    inventory[ingredientId].updatedAt = transaction.createdAt;
    changed = true;
  });
  if (changed) saveInventory(inventory);
}

function receiptHtml(transaction, kind = "paid") {
  const itemLines = transaction.items
    .map(
      (item) => `
        <div class="receipt-line">
          <span class="receipt-item-name">${item.qty}x ${item.name}</span>
          ${kind === "bill" ? "" : `<span class="receipt-item-price">${money(item.price * item.qty)}</span>`}
        </div>
      `,
    )
    .join("");
  const totalsBlock = kind === "bill"
    ? ""
    : `
    <div class="receipt-rule"></div>
    <div class="receipt-total"><span>Total</span><span>${money(transaction.grandTotal)}</span></div>
    <div class="receipt-line"><span>${transaction.payment}</span><span>${money(transaction.paid)}</span></div>
    <div class="receipt-line"><span>Kembali</span><span>${money(transaction.change)}</span></div>
    `;

  return `
    <img class="receipt-logo" src="/assets/logo-migi.png" alt="Logo Kopi Migi" />
    <h2>Kopi Migi</h2>
    ${kind === "bill" ? "" : "<p>LUNAS</p>"}
    <p>${transaction.id}</p>
    <p>${new Date(transaction.createdAt).toLocaleString("id-ID")}</p>
    <p>Kasir: ${transaction.employee}${transaction.shift ? ` (${transaction.shift})` : ""}</p>
    <p>Channel: ${transaction.channel || "Kasir"}</p>
    <p>Customer: ${transaction.customer}</p>
    <p>Meja: ${transaction.table}</p>
    <div class="receipt-rule"></div>
    ${itemLines}
    ${totalsBlock}
    ${transaction.boothPackage !== "none" ? `<div class="receipt-rule"></div><p>Photobooth: ${transaction.boothPackage}</p><p>Kode: ${transaction.boothCode || "-"}</p>` : ""}
    <div class="receipt-rule"></div>
    <p class="receipt-thanks">Terima kasih sudah mampir ke Kopi Migi. Ditunggu kembali ya!</p>
    <p class="receipt-cta">Semoga harimu menyenangkan :)</p>
  `;
}

async function printReceipt(transaction, kind = "paid") {
  els.receiptPaper.innerHTML = receiptHtml(transaction, kind);
  if (state.printerCharacteristic) {
    return printThermalReceipt(transaction, kind);
  }
  window.print();
  return true;
}

function receiptText(transaction, kind = "paid") {
  const width = els.printerPaperSize.value === "80mm" ? 42 : 32;
  const line = "-".repeat(width);
  const right = (label, value) => `${label}${String(value).padStart(Math.max(1, width - label.length), " ")}`;
  const itemLine = (label, value) => {
    const price = String(value);
    const maxLabel = Math.max(8, width - price.length - 1);
    const cleanLabel = String(label).length > maxLabel ? `${String(label).slice(0, maxLabel - 1)}.` : String(label);
    return `${cleanLabel}${price.padStart(Math.max(1, width - cleanLabel.length), " ")}`;
  };
  const center = (text) => {
    const clean = String(text);
    const left = Math.max(0, Math.floor((width - clean.length) / 2));
    return `${" ".repeat(left)}${clean}`;
  };

  const rows = [
    center("Kopi Migi"),
    ...(kind === "bill" ? [] : [center("STRUK LUNAS")]),
    line,
    transaction.id,
    new Date(transaction.createdAt).toLocaleString("id-ID"),
    `Kasir: ${transaction.employee}${transaction.shift ? ` (${transaction.shift})` : ""}`,
    `Channel: ${transaction.channel || "Kasir"}`,
    `Customer: ${transaction.customer}`,
    `Meja: ${transaction.table}`,
    line,
  ];

  transaction.items.forEach((item) => {
    const label = `${item.qty}x ${item.name}`;
    if (kind === "bill") rows.push(label);
    else rows.push(itemLine(label, money(item.price * item.qty)));
  });

  if (kind !== "bill") {
    rows.push(line);
    rows.push(right("TOTAL", money(transaction.grandTotal)));
    rows.push(right(transaction.payment, money(transaction.paid)));
    rows.push(right("Kembali", money(transaction.change)));
  }
  if (transaction.boothCode) {
    rows.push(line);
    rows.push(`Photobooth: ${transaction.boothPackage}`);
    rows.push(`Kode akses: ${transaction.boothCode}`);
  }
  rows.push(line);
  rows.push(center("Terima kasih sudah mampir."));
  rows.push(center("Ditunggu kembali di Kopi Migi :)"));
  return `${rows.join("\n")}\n\n\n`;
}

function encodeEscPos(text) {
  const encoder = new TextEncoder();
  const init = [0x1b, 0x40, 0x1b, 0x61, 0x00];
  const body = [...encoder.encode(text)];
  const cut = [0x1d, 0x56, 0x42, 0x00];
  return new Uint8Array([...init, ...body, ...cut]);
}

async function escPosLogoBytes() {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Logo PNG tidak bisa dibaca browser."));
    img.src = "/assets/logo-migi-print.png";
  });

  const targetWidth = els.printerPaperSize.value === "80mm" ? 128 : 96;
  const ratio = image.height / image.width;
  const width = Math.ceil(targetWidth / 8) * 8;
  const height = Math.max(1, Math.round(width * ratio));
  const widthBytes = Math.ceil(width / 8);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const pixels = ctx.getImageData(0, 0, width, height).data;
  const raster = [];
  for (let y = 0; y < height; y += 1) {
    for (let xByte = 0; xByte < widthBytes; xByte += 1) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit += 1) {
        const x = xByte * 8 + bit;
        if (x >= width) continue;
          const index = (y * width + x) * 4;
          const alpha = pixels[index + 3];
          const luminance = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
          if (alpha > 24 && luminance < 170) byte |= 0x80 >> bit;
        }
      raster.push(byte);
    }
  }

  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;
  return [
    0x1b, 0x61, 0x01,
    0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH,
    ...raster,
    0x0a, 0x1b, 0x61, 0x00,
  ];
}

async function encodeEscPosReceipt(transaction, kind) {
  const encoder = new TextEncoder();
  const init = [0x1b, 0x40];
  const body = [...encoder.encode(receiptText(transaction, kind))];
  const cut = [0x1d, 0x56, 0x42, 0x00];
  try {
    return new Uint8Array([...init, ...(await escPosLogoBytes()), ...body, ...cut]);
  } catch {
    return new Uint8Array([...init, ...body, ...cut]);
  }
}

async function writePrinterChunks(bytes) {
  const characteristic = state.printerCharacteristic;
  if (!characteristic) return;
  // Gunakan chunk kecil (20 byte) agar kompatibel dengan semua printer BLE
  const chunkSize = 20;
  const canWriteWithResponse = characteristic.properties.write;
  const canWriteWithoutResponse = characteristic.properties.writeWithoutResponse;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.slice(index, index + chunkSize);
    if (canWriteWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else if (canWriteWithResponse) {
      // writeValueWithResponse menggantikan writeValue() yang sudah deprecated
      await characteristic.writeValueWithResponse(chunk);
    } else {
      throw new Error("Characteristic printer tidak mendukung write.");
    }
    // Delay pendek agar BLE tetap stabil tanpa membuat logo terasa macet terlalu lama.
    await new Promise((resolve) => setTimeout(resolve, 18));
  }
}

async function printThermalReceipt(transaction, kind = "paid") {
  try {
    await writePrinterChunks(await encodeEscPosReceipt(transaction, kind));
    toast("Struk dikirim ke printer termal.");
    return true;
  } catch (error) {
    state.printerCharacteristic = null;
    setPrinterStatus("Terputus", "disconnected", "Cetak gagal. Sambungkan ulang printer.");
    toast(`Cetak Bluetooth gagal: ${error.message}`);
    window.print();
    return false;
  }
}

function generateBoothCode() {
  const sessions = getLegacyBoothSessions();
  let code = "";
  do {
    code = `A${Math.floor(100 + Math.random() * 900)}`;
  } while (sessions.some((session) => session.code === code));
  return code;
}

function createBoothQueue(transaction) {
  if (!transaction.sendToBooth || transaction.boothPackage === "none") return "";
  if (!state.pendingBoothCode) state.pendingBoothCode = generateBoothCode();
  return upsertPendingBoothSession(transaction);
}

function checkout() {
  if (!state.cart.length) {
    toast("Keranjang masih kosong.");
    return;
  }
  if (!validateStockForCart()) return;
  openOrderModal();
}

function clearActiveOrder({ silent = false } = {}) {
  removePendingBoothSession();
  state.cart = [];
  state.pendingBoothCode = "";
  els.paidAmount.value = "";
  els.customerName.value = "";
  els.tableNumber.value = "";
  els.orderCustomerName.value = "";
  els.orderTableNumber.value = "";
  if (els.orderShift) els.orderShift.value = currentShiftName();
  setOrderChannel("Kasir");
  state.activeDraftId = "";
  els.boothPackage.value = "classic";
  closeOrderModal();
  renderCart();
  renderMenuGrid();
  renderBoothQueue();
  renderOrders();
  if (!silent) toast("Order dibatalkan.");
}

async function printBill() {
  if (!state.cart.length) {
    toast("Keranjang masih kosong.");
    return;
  }
  els.customerName.value = els.orderCustomerName.value.trim();
  els.tableNumber.value = els.orderTableNumber.value.trim();
  const draft = currentTransaction(true);
  draft.payment = "Bill";
  draft.paid = 0;
  draft.change = 0;
  const drafts = getOrderDrafts().filter((entry) => entry.id !== draft.id);
  drafts.unshift(draft);
  saveOrderDrafts(drafts.slice(0, 200));
  await saveOfflineTransaction({
    ...draft,
    localId: draft.id,
    idempotencyKey: draft.id,
    syncStatus: "PENDING_SYNC",
    printStatus: "PRINT_PENDING",
  }).catch(() => null);
  const printed = await printReceipt(draft, "bill");
  await updateOfflineTransaction(draft.id, { printStatus: printed ? "PRINTED" : "PRINT_FAILED" }).catch(() => null);
  clearActiveOrder({ silent: true });
  renderOrders();
  renderPendingSync();
  toast("Bill dicetak dan masuk ke Order Belum Dibayar.");
}

function renderHistory() {
  const history = filteredMonthHistory();
  if (els.historyList) {
    els.historyList.innerHTML = history.length
      ? history
          .map(
            (transaction) => `
              <article class="history-card">
                <div>
                  <strong>${transaction.id} · ${money(transaction.grandTotal)}</strong>
                  <p>${new Date(transaction.createdAt).toLocaleString("id-ID")} · ${transaction.shift || "Shift 1"} · ${transaction.customer} · ${transaction.payment}${transaction.boothCode ? ` · Booth ${transaction.boothCode}` : ""}</p>
                  <p>${transaction.items.map((item) => `${item.qty}x ${item.name}`).join(", ")}</p>
                </div>
              </article>
            `,
          )
          .join("")
      : `<div class="empty-state">Belum ada transaksi di bulan ini.</div>`;
  }

  const today = selectedDailyDate();
  const todayTransactions = getHistory().filter((entry) => dateKey(entry.createdAt) === today);
  const activeShift = currentShiftName();
  const activeShiftTransactions = todayTransactions.filter((entry) => (entry.shift || "Shift 1") === activeShift);
  els.shiftTotal.textContent = money(activeShiftTransactions.reduce((sum, entry) => sum + entry.grandTotal, 0));
  els.shiftCount.textContent = `${activeShift} · ${activeShiftTransactions.length} transaksi`;
  renderDailySummary(todayTransactions, today);
}

function orderCard(transaction, kind) {
  const items = transaction.items.map((item) => `${item.qty}x ${item.name}`).join(", ");
  const actions = kind === "unpaid"
    ? `
      <div class="history-actions">
        <button class="secondary-button compact" data-pay-draft="${transaction.id}" type="button">Bayar</button>
        <button class="secondary-button compact danger-text" data-delete-draft="${transaction.id}" type="button">Hapus</button>
      </div>
    `
    : `
      <div class="history-actions">
        <button class="secondary-button compact" data-reprint-order="${transaction.id}" data-reprint-kind="paid" type="button">Cetak Ulang</button>
        <button class="secondary-button compact danger-text" data-delete-transaction="${transaction.id}" type="button">Hapus</button>
      </div>
    `;

  return `
    <article class="history-card order-card-row">
      <div>
        <strong>${transaction.id} · ${money(transaction.grandTotal)}</strong>
        <p>${new Date(transaction.createdAt).toLocaleString("id-ID")} · ${transaction.channel || "Kasir"} · ${transaction.customer}</p>
        <p>${items}</p>
      </div>
      ${actions}
    </article>
  `;
}

async function reprintOrder(id, kind) {
  const source = kind === "bill" ? getOrderDrafts() : getHistory();
  const transaction = source.find((entry) => entry.id === id);
  if (!transaction) {
    toast("Data order tidak ditemukan.");
    return;
  }
  const printed = await printReceipt(transaction, kind === "bill" ? "bill" : "paid");
  await updateOfflineTransaction(transaction.localId || transaction.id, { printStatus: printed ? "PRINTED" : "PRINT_FAILED" }).catch(() => null);
  renderPendingSync();
  toast("Perintah cetak ulang dikirim.");
}

function removeTransactionFromLocalHistory(id) {
  writeJson(storageKeys.history, getHistory().filter((entry) => entry.id !== id));
}

async function deletePaidTransaction(id) {
  if (!id) return;
  if (navigator.onLine) {
    try {
      await deleteTransactionInSupabase(id);
      removeTransactionFromLocalHistory(id);
      await pullTransactionsFromSupabase({ render: false }).catch(() => null);
      renderAll();
      toast("Transaksi dihapus dari laporan.");
      return;
    } catch {
      queuePendingDelete("transaction", id);
    }
  } else {
    queuePendingDelete("transaction", id);
  }

  removeTransactionFromLocalHistory(id);
  renderAll();
  toast("Transaksi dihapus lokal. Akan sync saat online.");
}

function renderOrders() {
  if (!els.orderList) return;
  const unpaid = getOrderDrafts();
  const paidDate = els.paidOrderDate?.value || dateKey();
  const paid = getHistory().filter((entry) => dateKey(entry.createdAt) === paidDate);
  if (els.unpaidOrderCount) els.unpaidOrderCount.textContent = unpaid.length;
  if (els.paidOrderCount) els.paidOrderCount.textContent = getHistory().filter((entry) => dateKey(entry.createdAt) === paidDate).length;
  if (els.paidOrderDate) els.paidOrderDate.hidden = state.orderStatus !== "paid";

  const list = state.orderStatus === "paid" ? paid : unpaid;
  els.orderList.innerHTML = list.length
    ? list.slice(0, 80).map((transaction) => orderCard(transaction, state.orderStatus)).join("")
    : `<div class="empty-state">${state.orderStatus === "paid" ? "Belum ada order yang sudah dibayar." : "Belum ada order menunggu pembayaran."}</div>`;
}

async function renderPendingSync() {
  if (!els.pendingSyncList && !els.pendingSyncCount && !els.connectionStatus) return;
  let pending = [];
  try {
    pending = await pendingOfflineTransactions();
  } catch {
    pending = [];
  }

  const online = navigator.onLine;
  if (els.connectionStatus) {
    els.connectionStatus.textContent = online ? (pending.length ? "Sync pending" : "Online") : "Offline";
    els.connectionStatus.dataset.status = online ? (pending.length ? "pending" : "online") : "offline";
  }
  if (els.pendingSyncCount) els.pendingSyncCount.textContent = `${pending.length} pending`;
  if (els.pendingSyncList) {
    els.pendingSyncList.innerHTML = pending.length
      ? pending
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map(
            (entry) => `
              <article class="history-card">
                <div>
                  <strong>${entry.id} · ${money(entry.grandTotal || 0)}</strong>
                  <p>${new Date(entry.createdAt).toLocaleString("id-ID")} · ${entry.syncStatus} · ${entry.printStatus}</p>
                  <p>${entry.items?.map((item) => `${item.qty}x ${item.name}`).join(", ") || "-"}</p>
                </div>
                <div class="history-actions">
                  <button class="secondary-button compact" data-reprint-offline="${entry.localId}" type="button">Print Ulang</button>
                </div>
              </article>
            `,
          )
          .join("")
      : `<div class="empty-state">Tidak ada transaksi pending sync.</div>`;
  }
}

async function syncPendingTransactions() {
  if (!navigator.onLine) {
    renderPendingSync();
    return;
  }

  const pending = await pendingOfflineTransactions().catch(() => []);
  for (const transaction of pending) {
    try {
      const response = await fetch("/api/supabase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": transaction.idempotencyKey || transaction.localId,
        },
        body: JSON.stringify({ action: "sync-transaction", transaction }),
      });
      if (!response.ok) throw new Error(`Sync gagal: ${response.status}`);
      await updateOfflineTransaction(transaction.localId, {
        syncStatus: "SYNCED",
        syncedAt: new Date().toISOString(),
      });
    } catch {
      await updateOfflineTransaction(transaction.localId, {
        syncStatus: "PENDING_SYNC",
        lastSyncAttemptAt: new Date().toISOString(),
      }).catch(() => null);
    }
  }
  renderPendingSync();
  await pullTransactionsFromSupabase({ render: true });
}

async function postCloudJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Cloud sync gagal: ${response.status}`);
  return response.json();
}

async function postSupabaseAction(action, payload = {}) {
  return postCloudJson("/api/supabase", { action, ...payload });
}

async function syncHistoryToCloud() {
  if (!navigator.onLine) return;
  for (const transaction of getHistory()) {
    await postSupabaseAction("sync-transaction", { transaction });
  }
}

async function syncCashflowToCloud() {
  if (!navigator.onLine) return;
  const expenses = getCashflowExpenses();
  if (expenses.length) await postSupabaseAction("sync-cashflow", { expenses });
}

async function syncInventoryToCloud() {
  if (!navigator.onLine) return;
  const inventory = getInventory();
  if (Object.keys(inventory).length) await postSupabaseAction("sync-inventory", { inventory });
}

async function syncEmployeesToCloud() {
  if (!navigator.onLine) return;
  const employees = getEmployeeRoster();
  if (employees.length) await postSupabaseAction("sync-employees", { employees });
}

async function deleteEmployeeInCloud(name) {
  if (!navigator.onLine) return false;
  await postSupabaseAction("delete-employee", { name });
  return true;
}

async function deleteInventoryInCloud(id) {
  if (!navigator.onLine) return false;
  await postSupabaseAction("delete-inventory", { id });
  return true;
}

async function deleteCashflowInCloud(id) {
  if (!navigator.onLine) return false;
  await postSupabaseAction("delete-cashflow", { id });
  return true;
}

async function syncSettingsToCloud({ force = false } = {}) {
  if (!navigator.onLine || !isLoggedIn()) return false;
  if (!force && !hasDirtySettings()) return false;
  await postSupabaseAction("sync-settings", { settings: getSettingsPayload() });
  clearSettingsDirty();
  return true;
}

async function pullSettingsFromSupabase({ render = false } = {}) {
  if (!navigator.onLine) return false;
  const result = await postSupabaseAction("get-settings");
  if (!result?.success) throw new Error(result?.error || "Pull setting gagal.");
  if (result.found && !hasDirtySettings()) {
    applyCloudSettings(result.settings);
    if (render) renderAll();
  } else if (!result.found || hasDirtySettings()) {
    await syncSettingsToCloud({ force: true });
  }
  return true;
}

async function pullTransactionsFromSupabase({ render = true } = {}) {
  if (!navigator.onLine) return false;
  const result = await postSupabaseAction("get-transactions");
  if (!result?.success || !Array.isArray(result.transactions)) {
    throw new Error(result?.error || "Pull transaksi gagal.");
  }
  writeJson(storageKeys.history, result.transactions.slice(0, 500));
  if (render) {
    renderHistory();
    renderOrders();
    renderCashflow();
    renderAnalytics();
  }
  return true;
}

async function deleteTransactionInSupabase(id) {
  await postSupabaseAction("delete-transaction", { id });
}

async function processPendingDeletes() {
  if (!navigator.onLine) return;
  const pending = getPendingDeletes();
  const remaining = [];

  for (const entry of pending) {
    try {
      if (entry.type === "transaction") await deleteTransactionInSupabase(entry.id);
    } catch {
      remaining.push(entry);
    }
  }

  savePendingDeletes(remaining);
}

async function loadCloudData() {
  if (!navigator.onLine) return false;
  const data = await postSupabaseAction("bootstrap-data");
  if (!data?.success) throw new Error(data?.error || "Load data cloud gagal.");

  if (Array.isArray(data.history)) writeJson(storageKeys.history, data.history.slice(0, 300));
  if (Array.isArray(data.cashflowExpenses)) writeJson(storageKeys.cashflowExpenses, data.cashflowExpenses.slice(0, 500));
  if (data.inventory && typeof data.inventory === "object") saveInventory(data.inventory);
  if (Array.isArray(data.employees) && data.employees.length) saveEmployeeRoster(data.employees);
  if (data.settingsFound && !hasDirtySettings()) {
    applyCloudSettings(data.settings);
  } else if (!data.settingsFound || hasDirtySettings()) {
    await syncSettingsToCloud({ force: true }).catch(() => null);
  }
  return true;
}

let cloudSyncPromise = null;

async function syncCloudData({ refresh = true } = {}) {
  if (!navigator.onLine || !isLoggedIn()) return;
  if (cloudSyncPromise) return cloudSyncPromise;

  cloudSyncPromise = (async () => {
    await Promise.allSettled([
      processPendingDeletes(),
      syncPendingTransactions(),
      syncHistoryToCloud(),
      syncCashflowToCloud(),
      syncInventoryToCloud(),
      syncEmployeesToCloud(),
      syncSettingsToCloud(),
    ]);
    if (refresh) {
      await loadCloudData();
      await pullTransactionsFromSupabase({ render: false }).catch(() => null);
      renderAll();
    }
  })()
    .catch(() => null)
    .finally(() => {
      cloudSyncPromise = null;
      renderPendingSync();
    });

  return cloudSyncPromise;
}

async function updateDevicePresence() {
  if (!navigator.onLine || !isLoggedIn()) return;
  const result = await postSupabaseAction("device-presence", {
    deviceId: ensureDeviceId(),
    employee: activeEmployeeName(),
  });
  if (!result?.otherActive) return;

  const now = Date.now();
  const lastWarning = Number(localStorage.getItem(storageKeys.lastDeviceWarning) || 0);
  if (now - lastWarning < 5 * 60 * 1000) return;
  localStorage.setItem(storageKeys.lastDeviceWarning, String(now));
  const employee = result.activeDevice?.employee || "petugas lain";
  window.alert(`Kasir juga sedang aktif di device lain oleh ${employee}. Pastikan hanya satu kasir yang mengambil transaksi utama.`);
}

async function clearDevicePresence() {
  if (!navigator.onLine) return;
  await postSupabaseAction("device-presence", {
    deviceId: ensureDeviceId(),
    employee: activeEmployeeName(),
    logout: true,
  });
}

function updateConnectionStatus() {
  renderPendingSync();
  if (navigator.onLine) {
    processPendingDeletes()
      .then(() => syncPendingTransactions())
      .then(() => pullTransactionsFromSupabase({ render: true }))
      .catch(() => null);
    syncCloudData({ refresh: false });
    updateDevicePresence().catch(() => null);
  }
}

function payDraftOrder(id) {
  const draft = getOrderDrafts().find((entry) => entry.id === id);
  if (!draft) return;
  state.cart = draft.items.map((item) => ({ ...item }));
  state.activeDraftId = draft.id;
  els.customerName.value = draft.customer === "Walk-in" || draft.customer === "Teman Migi" ? "" : draft.customer;
  els.tableNumber.value = draft.table === "-" ? "" : draft.table;
  els.orderCustomerName.value = draft.customer === "Walk-in" ? "Teman Migi" : draft.customer;
  els.orderTableNumber.value = draft.table === "-" ? "" : draft.table;
  if (els.orderShift) els.orderShift.value = draft.shift || currentShiftName(draft.createdAt);
  setOrderChannel(draft.channel || "Kasir");
  state.payment = "Tunai";
  els.paymentMethods.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.payment === "Tunai"));
  els.paidAmount.value = "";
  renderCart();
  renderMenuGrid();
  openOrderModal();
}

function selectedMonth() {
  return els.analyticsMonth.value || new Date().toISOString().slice(0, 7);
}

function selectedDailyDate() {
  return els.analyticsDate?.value || dateKey();
}

function dailyReportText(todayTransactions, reportDateValue = selectedDailyDate()) {
  const reportDate = new Date(`${reportDateValue}T12:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const revenue = todayTransactions.reduce((sum, entry) => sum + entry.grandTotal, 0);
  const items = todayTransactions.reduce((sum, entry) => sum + entry.items.reduce((inner, item) => inner + item.qty, 0), 0);
  const orderedItems = [...todayTransactions.reduce((map, entry) => {
    entry.items.forEach((item) => {
      const current = map.get(item.id) || { name: item.name, qty: 0, revenue: 0 };
      current.qty += item.qty;
      current.revenue += item.price * item.qty;
      map.set(item.id, current);
    });
    return map;
  }, new Map()).values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
  const shiftLines = ["Shift 1", "Shift 2"].map((shift) => {
    const transactions = todayTransactions.filter((entry) => (entry.shift || "Shift 1") === shift);
    const shiftRevenue = transactions.reduce((sum, entry) => sum + entry.grandTotal, 0);
    return `- ${shift}: ${money(shiftRevenue)} (${transactions.length} transaksi)`;
  });

  return [
    "Laporan Penjualan",
    reportDate,
    "",
    `Total Penjualan: ${money(revenue)}`,
    `Transaksi: ${todayTransactions.length}`,
    `Item terjual: ${items}`,
    "",
    "Rincian Shift:",
    ...shiftLines,
    "",
    "Rincian Orderan:",
    ...(orderedItems.length ? orderedItems.map((item) => `- ${item.name}: ${item.qty} pcs (${money(item.revenue)})`) : ["- Belum ada order"]),
  ].join("\n");
}

function renderDailySummary(todayTransactions, reportDateValue = selectedDailyDate()) {
  if (!els.dailySummary) return;
  const revenue = todayTransactions.reduce((sum, entry) => sum + entry.grandTotal, 0);
  const items = todayTransactions.reduce((sum, entry) => sum + entry.items.reduce((inner, item) => inner + item.qty, 0), 0);
  const paymentTotals = todayTransactions.reduce((map, entry) => {
    map.set(entry.payment, (map.get(entry.payment) || 0) + entry.grandTotal);
    return map;
  }, new Map());
  const shiftTotals = ["Shift 1", "Shift 2"].map((shift) => {
    const transactions = todayTransactions.filter((entry) => (entry.shift || "Shift 1") === shift);
    return {
      shift,
      revenue: transactions.reduce((sum, entry) => sum + entry.grandTotal, 0),
      count: transactions.length,
      items: transactions.reduce((sum, entry) => sum + entry.items.reduce((inner, item) => inner + item.qty, 0), 0),
    };
  });
  const topItem = [...todayTransactions.reduce((map, entry) => {
    entry.items.forEach((item) => {
      const current = map.get(item.id) || { name: item.name, qty: 0 };
      current.qty += item.qty;
      map.set(item.id, current);
    });
    return map;
  }, new Map()).values()].sort((a, b) => b.qty - a.qty)[0];

  els.dailySummary.innerHTML = `
    <article><span>Total penjualan</span><strong>${money(revenue)}</strong></article>
    <article><span>Transaksi</span><strong>${todayTransactions.length}</strong></article>
    <article><span>Item terjual</span><strong>${items}</strong></article>
    <article><span>Menu paling jalan</span><strong>${topItem ? `${topItem.name} (${topItem.qty})` : "-"}</strong></article>
    <div class="shift-summary">
      ${shiftTotals
        .map(
          (item) => `
            <div>
              <span>${item.shift}</span>
              <strong>${money(item.revenue)}</strong>
              <small>${item.count} transaksi · ${item.items} item</small>
            </div>
          `,
        )
        .join("")}
    </div>
    <div class="payment-summary">
      ${["Tunai", "QRIS"]
        .map((method) => `<div><span>${method}</span><strong>${money(paymentTotals.get(method) || 0)}</strong></div>`)
        .join("")}
    </div>
  `;
  if (els.dailyReportText) els.dailyReportText.textContent = dailyReportText(todayTransactions, reportDateValue);
}

async function copyDailyReport() {
  const text = els.dailyReportText?.textContent?.trim();
  if (!text) return toast("Belum ada laporan untuk dicopy.");
  try {
    await navigator.clipboard.writeText(text);
    toast("Laporan dicopy.");
  } catch {
    toast("Browser memblokir clipboard. Seleksi teks laporan secara manual.");
  }
}

function shareDailyReportToWhatsApp() {
  const text = els.dailyReportText?.textContent?.trim();
  if (!text) return toast("Belum ada laporan untuk dibagikan.");
  window.open(`https://wa.me/?text=${encodeURIComponent(["*Migi Coffee*", "", text].join("\n"))}`, "_blank", "noopener");
}

function filteredMonthHistory() {
  const month = selectedMonth();
  return getHistory().filter((entry) => entry.createdAt.slice(0, 7) === month);
}

function renderAnalytics() {
  const history = filteredMonthHistory();
  const revenue = history.reduce((sum, entry) => sum + entry.grandTotal, 0);
  const uniqueDays = new Set(history.map((entry) => entry.createdAt.slice(0, 10))).size || 1;
  const itemCount = history.reduce((sum, entry) => sum + entry.items.reduce((inner, item) => inner + item.qty, 0), 0);
  const products = new Map();

  history.forEach((entry) => {
    entry.items.forEach((item) => {
      const current = products.get(item.id) || { name: item.name, qty: 0, revenue: 0 };
      current.qty += item.qty;
      current.revenue += item.qty * item.price;
      products.set(item.id, current);
    });
  });

  const bestsellers = [...products.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 8);
  els.monthRevenue.textContent = money(revenue);
  els.avgDailyRevenue.textContent = money(Math.round(revenue / uniqueDays));
  els.monthTransactions.textContent = String(history.length);
  els.monthItems.textContent = String(itemCount);
  els.bestsellerList.innerHTML = bestsellers.length
    ? bestsellers
        .map(
          (item, index) => `
            <article class="bestseller-row">
              <strong>${index + 1}</strong>
              <div><b>${item.name}</b><span>${item.qty} terjual · ${money(item.revenue)}</span></div>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state">Belum ada best seller di bulan ini.</div>`;

  renderRevenueChart(history);
  renderInsights({ history, bestsellers, revenue, itemCount });
}

function renderRevenueChart(history) {
  const canvas = els.revenueChart;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(640, Math.round((rect.width || 980) * dpr));
  const height = Math.round(360 * dpr);
  canvas.width = width;
  canvas.height = height;
  ctx.scale(dpr, dpr);

  const w = width / dpr;
  const h = height / dpr;
  const pad = { top: 24, right: 28, bottom: 38, left: 72 };
  const month = selectedMonth();
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const range = state.chartRange;
  const source = range === "yearly"
    ? getHistory().filter((entry) => entry.createdAt.slice(0, 4) === String(year))
    : range === "monthly"
      ? getHistory().filter((entry) => entry.createdAt.slice(0, 4) === String(year))
      : history;
  const points = range === "yearly"
    ? Array.from({ length: 5 }, (_, index) => ({ label: String(year - 4 + index), total: 0 }))
    : range === "monthly"
      ? Array.from({ length: 12 }, (_, index) => ({ label: new Date(year, index, 1).toLocaleDateString("id-ID", { month: "short" }), total: 0 }))
      : Array.from({ length: daysInMonth }, (_, index) => ({ label: String(index + 1), total: 0 }));

  source.forEach((entry) => {
    if (range === "yearly") {
      const point = points.find((item) => item.label === entry.createdAt.slice(0, 4));
      if (point) point.total += entry.grandTotal;
      return;
    }
    if (range === "monthly") {
      const index = Number(entry.createdAt.slice(5, 7)) - 1;
      if (points[index]) points[index].total += entry.grandTotal;
      return;
    }
    const day = Number(entry.createdAt.slice(8, 10));
    if (points[day - 1]) points[day - 1].total += entry.grandTotal;
  });

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  if (!source.length) {
    ctx.fillStyle = "#77736d";
    ctx.font = "700 15px Geist, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Belum ada omset untuk rentang ini.", w / 2, h / 2);
    return;
  }

  const maxValue = Math.max(...points.map((entry) => entry.total), 1);
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const xFor = (index) => pad.left + (points.length === 1 ? 0 : (index / (points.length - 1)) * plotW);
  const yFor = (value) => pad.top + plotH - (value / maxValue) * plotH;

  ctx.strokeStyle = "#e6e2dc";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#77736d";
  ctx.font = "700 11px Geist, system-ui";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i += 1) {
    const value = (maxValue / 4) * i;
    const y = yFor(value);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillText(money(Math.round(value)).replace(/^Rp\s*/, ""), pad.left - 10, y + 4);
  }

  ctx.textAlign = "center";
  points.forEach((entry, index) => {
    if (range !== "daily" || index === 0 || index === points.length - 1 || Number(entry.label) % 7 === 0) {
      ctx.fillText(entry.label, xFor(index), h - 14);
    }
  });

  const gradient = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
  gradient.addColorStop(0, "rgba(47, 122, 70, 0.2)");
  gradient.addColorStop(1, "rgba(47, 122, 70, 0)");

  ctx.beginPath();
  points.forEach((entry, index) => {
    const x = xFor(index);
    const y = yFor(entry.total);
    if (index === 0) ctx.moveTo(x, y);
    else {
      const prevX = xFor(index - 1);
      const prevY = yFor(points[index - 1].total);
      const midX = (prevX + x) / 2;
      ctx.bezierCurveTo(midX, prevY, midX, y, x, y);
    }
  });
  ctx.lineTo(w - pad.right, h - pad.bottom);
  ctx.lineTo(pad.left, h - pad.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((entry, index) => {
    const x = xFor(index);
    const y = yFor(entry.total);
    if (index === 0) ctx.moveTo(x, y);
    else {
      const prevX = xFor(index - 1);
      const prevY = yFor(points[index - 1].total);
      const midX = (prevX + x) / 2;
      ctx.bezierCurveTo(midX, prevY, midX, y, x, y);
    }
  });
  ctx.strokeStyle = "#2f7a46";
  ctx.lineWidth = 3;
  ctx.stroke();

  points.forEach((entry, index) => {
    if (!entry.total) return;
    ctx.beginPath();
    ctx.arc(xFor(index), yFor(entry.total), 4, 0, Math.PI * 2);
    ctx.fillStyle = "#2f7a46";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function renderInsights({ history, bestsellers, revenue, itemCount }) {
  if (!els.insightList) return;
  const top = bestsellers[0];
  const avgTransaction = history.length ? Math.round(revenue / history.length) : 0;
  const boothCount = history.filter((entry) => entry.boothCode || entry.boothPackage !== "none").length;
  const activeDays = new Set(history.map((entry) => entry.createdAt.slice(0, 10))).size;
  const insights = top
    ? [
        { label: "Menu terkuat", value: top.name, detail: `${top.qty} terjual dengan omset ${money(top.revenue)}.` },
        { label: "Rata-rata transaksi", value: money(avgTransaction), detail: `${history.length} transaksi dari ${activeDays || 0} hari jualan.` },
        { label: "Kontribusi photobooth", value: `${boothCount} transaksi`, detail: boothCount ? "Kode akses otomatis dibuat saat checkout." : "Belum ada sesi photobooth di bulan ini." },
      ]
    : [
        { label: "Belum ada data", value: "Mulai checkout", detail: "Best seller dan evaluasi akan muncul setelah ada transaksi." },
        { label: "Item terjual", value: String(itemCount), detail: "Jumlah item mengikuti semua transaksi bulan terpilih." },
      ];

  els.insightList.innerHTML = insights
    .map(
      (item) => `
        <article class="insight-card">
          <p class="eyebrow">${item.label}</p>
          <strong>${item.value}</strong>
          <span>${item.detail}</span>
        </article>
      `,
    )
    .join("");
}

function resetMenuForm() {
  els.menuId.value = "";
  els.menuName.value = "";
  els.menuCategory.value = "";
  els.menuCategoryCustom.value = "";
  els.menuPrice.value = "";
  els.menuImage.value = "";
  els.menuImageFile.value = "";
  els.menuImagePreview.innerHTML = "Belum ada gambar";
  renderMenuCategoryOptions("");
  renderRecipeRows("");
}

function setMenuImagePreview(src) {
  els.menuImage.value = src || "";
  els.menuImagePreview.innerHTML = src ? `<img src="${src}" alt="Preview gambar menu" />` : "Belum ada gambar";
}

function readMenuImageFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    toast("File gambar tidak valid.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 320;
      const ratio = image.width / image.height;
      canvas.width = ratio >= 1 ? size : Math.round(size * ratio);
      canvas.height = ratio >= 1 ? Math.round(size / ratio) : size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      setMenuImagePreview(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function saveMenu(event) {
  event.preventDefault();
  const menu = getMenu();
  syncMenuCategoryField();
  const recipes = getRecipes();
  const data = {
    id: els.menuId.value || idFromName(els.menuName.value),
    name: els.menuName.value.trim(),
    category: els.menuCategory.value.trim(),
    price: parseRupiah(els.menuPrice.value),
    image: els.menuImage.value,
  };

  if (!data.name || !data.category || data.price < 0) {
    toast("Nama, kategori, dan harga perlu diisi.");
    return;
  }

  const recipeRows = collectRecipeRows();
  if (!recipeRows) return;

  const index = menu.findIndex((item) => item.id === data.id);
  if (index >= 0) menu[index] = { ...menu[index], ...data };
  else menu.push(data);

  if (recipeRows.length) recipes[data.id] = recipeRows;
  else delete recipes[data.id];
  writeJson(storageKeys.menu, menu);
  saveRecipes(recipes);
  markSettingsDirty();
  resetMenuForm();
  state.category = "Semua";
  renderAll();
  syncSettingsToCloud({ force: true }).catch(() => null);
  toast("Menu tersimpan.");
}

function savePurchase(event) {
  event.preventDefault();
  const itemName = els.purchaseMenuId.value.trim();
  const unit = els.ingredientUnit.value.trim();
  const qty = Number(els.purchaseQty.value || 0);
  const cost = parseRupiah(els.purchaseCost.value);
  const editingId = els.purchaseForm.dataset.editingStockId || "";

  if (!itemName || !unit || !Number.isFinite(qty) || qty <= 0 || cost <= 0) {
    toast("Nama bahan, jumlah, satuan, dan harga total perlu diisi.");
    return;
  }

  const inventory = getInventory();
  const ingredientId = editingId || stableIdFromName(itemName);
  const current = inventory[ingredientId] || {};
  inventory[ingredientId] = {
    ...current,
    name: itemName,
    unit,
    stock: editingId ? qty : Number(current.stock || 0) + qty,
    buyPrice: cost / qty,
    updatedAt: new Date().toISOString(),
  };
  saveInventory(inventory);

  delete els.purchaseForm.dataset.editingStockId;
  const submitBtn = els.purchaseForm.querySelector("button[type=submit]");
  if (submitBtn) submitBtn.textContent = "Simpan Harga Bahan";
  els.purchaseMenuId.value = "";
  els.purchaseQty.value = "";
  els.ingredientUnit.value = "gram";
  els.purchaseCost.value = "";
  renderAll();
  syncInventoryToCloud().catch(() => null);
  toast(`Bahan "${itemName}" tersimpan.`);
}


async function startCamera() {
  if (!els.boothVideo) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Browser ini belum mendukung kamera.");
    return;
  }

  try {
    state.boothStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
    els.boothVideo.srcObject = state.boothStream;
    els.cameraPlaceholder.hidden = true;
    els.boothStatus.textContent = "Kamera aktif";
    els.boothStatus.className = "status-pill ok";
  } catch {
    els.boothStatus.textContent = "Izin kamera ditolak";
    els.boothStatus.className = "status-pill bad";
    toast("Kamera belum bisa diakses. Cek izin kamera browser.");
  }
}

function drawBoothCanvas() {
  const canvas = els.boothCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#171717";
  ctx.font = "700 34px system-ui";
  ctx.fillText("Kopi Migi", 44, 58);
  ctx.font = "500 22px system-ui";
  ctx.fillText(new Date().toLocaleString("id-ID"), 44, 92);

  const slots = [
    [44, 122],
    [374, 122],
    [44, 554],
    [374, 554],
  ];

  slots.forEach(([x, y], index) => {
    ctx.fillStyle = "#f3f3f1";
    ctx.fillRect(x, y, 302, 392);
    const image = state.boothPhotos[index];
    if (!image) return;
    ctx.drawImage(image, x, y, 302, 392);
  });

  ctx.fillStyle = "#171717";
  ctx.font = "700 26px system-ui";
  ctx.fillText(els.boothCustomer.value.trim() || "Walk-in", 44, 1002);
  ctx.font = "500 20px system-ui";
  ctx.fillText(`Paket ${els.boothSessionPackage.value}`, 44, 1034);
}

function capturePhoto() {
  if (!els.boothVideo) return;
  if (!state.boothStream) {
    toast("Aktifkan kamera dulu.");
    return;
  }

  const image = new Image();
  const capture = document.createElement("canvas");
  capture.width = 302;
  capture.height = 392;
  const ctx = capture.getContext("2d");
  const video = els.boothVideo;
  const sourceRatio = video.videoWidth / video.videoHeight;
  const targetRatio = capture.width / capture.height;
  let sx = 0;
  let sy = 0;
  let sw = video.videoWidth;
  let sh = video.videoHeight;

  if (sourceRatio > targetRatio) {
    sw = video.videoHeight * targetRatio;
    sx = (video.videoWidth - sw) / 2;
  } else {
    sh = video.videoWidth / targetRatio;
    sy = (video.videoHeight - sh) / 2;
  }

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, capture.width, capture.height);
  image.onload = () => {
    state.boothPhotos.push(image);
    if (state.boothPhotos.length > 4) state.boothPhotos.shift();
    els.photoCount.textContent = String(state.boothPhotos.length);
    drawBoothCanvas();
  };
  image.src = capture.toDataURL("image/jpeg", 0.92);
}

function resetBooth() {
  if (!els.boothCanvas) return;
  state.boothPhotos = [];
  els.photoCount.textContent = "0";
  drawBoothCanvas();
}

function downloadBooth() {
  if (!els.boothCanvas) return;
  if (!state.boothPhotos.length) {
    toast("Belum ada foto untuk didownload.");
    return;
  }

  drawBoothCanvas();
  const dataUrl = els.boothCanvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `photobooth-${Date.now()}.png`;
  link.click();

  const sessions = getBoothSessions();
  sessions.unshift({
    id: `PB-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    customer: els.boothCustomer.value.trim() || "Walk-in",
    package: els.boothSessionPackage.value,
    status: "Selesai",
    image: dataUrl,
  });
  writeJson(storageKeys.booth, sessions.slice(0, 50));
  renderBoothQueue();
  toast("Hasil photobooth tersimpan di riwayat lokal.");
}

function renderBoothQueue() {
  const sessions = getBoothSessions();
  const latest = sessions.find((session) => session.status !== "Selesai");
  if (els.latestBoothCode) {
    els.latestBoothCode.textContent = state.pendingBoothCode || latest?.id || "Belum ada";
  }
  if (!els.boothQueue) return;
  els.boothQueue.innerHTML = sessions.length
    ? sessions
        .slice(0, 8)
        .map(
          (session) => `
            <article class="history-card compact-card">
              <div>
                <strong>${session.customer} · ${session.package}</strong>
                <p>${new Date(session.createdAt).toLocaleString("id-ID")} · ${session.status}</p>
              </div>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state">Belum ada antrian photobooth.</div>`;
}

function renderAll() {
  updateClock();
  renderCategories();
  renderMenuCategoryOptions();
  renderRecipeOptions();
  renderMenuGrid();
  renderMenuTable();
  renderCart();
  renderAnalytics();
  renderHistory();
  renderOrders();
  renderInventory();
  renderCashflow();
  renderBoothQueue();
  drawBoothCanvas();
  syncCfExpenseNoteField();
  renderPendingSync();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update())
      .catch(() => {
        toast("Service worker belum aktif. Coba refresh saat online.");
      });
  });
}

function setActiveView(viewName, { persist = true } = {}) {
  const target = document.querySelector(`#view-${viewName}`);
  const tab = [...els.tabs].find((entry) => entry.dataset.view === viewName);
  if (!target || !tab) return false;
  els.tabs.forEach((entry) => entry.classList.remove("active"));
  els.views.forEach((view) => view.classList.remove("active"));
  tab.classList.add("active");
  target.classList.add("active");
  if (persist) localStorage.setItem(storageKeys.activeView, viewName);
  return true;
}

function restoreActiveView() {
  const savedView = localStorage.getItem(storageKeys.activeView);
  if (savedView) setActiveView(savedView, { persist: false });
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveView(tab.dataset.view);
  });
});

els.printerToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  togglePrinterDropdown();
});

els.printerDropdown.addEventListener("click", (event) => {
  event.stopPropagation();
});

document.addEventListener("click", () => {
  togglePrinterDropdown(false);
});

els.connectPrinter.addEventListener("click", connectPrinter);
els.fullscreenToggle?.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", syncFullscreenButton);

els.categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  renderCategories();
  renderMenuGrid();
});

els.menuGrid.addEventListener("click", (event) => {
  const decrease = event.target.closest("[data-menu-decrease]");
  if (decrease) {
    event.stopPropagation();
    changeQty(decrease.dataset.menuDecrease, -1);
    return;
  }
  const increase = event.target.closest("[data-menu-increase]");
  if (increase) {
    event.stopPropagation();
    changeQty(increase.dataset.menuIncrease, 1);
    return;
  }
  const button = event.target.closest(".menu-card");
  if (!button) return;
  addToCart(button.dataset.id);
});

els.menuGrid.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const card = event.target.closest(".menu-card");
  if (!card) return;
  event.preventDefault();
  addToCart(card.dataset.id);
});

els.cartList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  changeQty(button.dataset.id, button.dataset.action === "increase" ? 1 : -1);
});

els.paymentMethods.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-payment]");
  if (!button) return;
  const previousPayment = state.payment;
  state.payment = button.dataset.payment;
  els.paymentMethods.querySelectorAll("button").forEach((entry) => entry.classList.toggle("active", entry === button));
  if (state.payment !== previousPayment) {
    els.paidAmount.value = state.payment === "Tunai" ? "" : totals().grandTotal;
  }
  updateChange();
});

els.orderChannels?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-channel]");
  if (!button) return;
  setOrderChannel(button.dataset.channel);
});

  els.orderStatusTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-order-status]");
  if (!button) return;
  state.orderStatus = button.dataset.orderStatus;
  els.orderStatusTabs.querySelectorAll("button[data-order-status]").forEach((entry) => entry.classList.toggle("active", entry === button));
  renderOrders();
});

els.chartRangeTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-chart-range]");
  if (!button) return;
  state.chartRange = button.dataset.chartRange;
  els.chartRangeTabs.querySelectorAll("button[data-chart-range]").forEach((entry) => entry.classList.toggle("active", entry === button));
  renderAnalytics();
});

els.orderList?.addEventListener("click", (event) => {
  const payButton = event.target.closest("button[data-pay-draft]");
  const deleteButton = event.target.closest("button[data-delete-draft]");
  const reprintButton = event.target.closest("button[data-reprint-order]");
  const deleteTransactionButton = event.target.closest("button[data-delete-transaction]");
  if (payButton) {
    payDraftOrder(payButton.dataset.payDraft);
    return;
  }
  if (deleteTransactionButton) {
    deletePaidTransaction(deleteTransactionButton.dataset.deleteTransaction);
    return;
  }
  if (reprintButton) {
    reprintOrder(reprintButton.dataset.reprintOrder, reprintButton.dataset.reprintKind);
    return;
  }
  if (deleteButton) {
    saveOrderDrafts(getOrderDrafts().filter((entry) => entry.id !== deleteButton.dataset.deleteDraft));
    renderOrders();
    toast("Order belum dibayar dihapus.");
  }
});

els.pendingSyncList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-reprint-offline]");
  if (!button) return;
  const localId = button.dataset.reprintOffline;
  const transaction = (await getOfflineTransactions()).find((entry) => entry.localId === localId);
  if (!transaction) {
    toast("Transaksi offline tidak ditemukan.");
    return;
  }
  const printed = await printReceipt(transaction, transaction.status === "unpaid" ? "bill" : "paid");
  await updateOfflineTransaction(localId, { printStatus: printed ? "PRINTED" : "PRINT_FAILED" }).catch(() => null);
  renderPendingSync();
});

els.manualSyncBtn?.addEventListener("click", syncPendingTransactions);
els.manualSyncOrdersBtn?.addEventListener("click", syncPendingTransactions);
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

els.menuSearch.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderMenuGrid();
});

els.resetFilter.addEventListener("click", () => {
  state.search = "";
  state.category = "Semua";
  els.menuSearch.value = "";
  renderAll();
});

els.clearCart.addEventListener("click", () => {
  clearActiveOrder();
});

els.clearCartPanel?.addEventListener("click", () => {
  clearActiveOrder();
});

els.paidAmount.addEventListener("input", updateChange);
els.checkoutBtn.addEventListener("click", checkout);
els.boothPackage.addEventListener("change", () => {
  if (hasPhotoboothCart()) upsertPendingBoothSession();
});
els.employeeAddForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.employeeNewName?.value.trim();
  if (!name) return;
  const roster = saveEmployeeRoster([...getEmployeeRoster(), name]);
  localStorage.setItem(storageKeys.employee, name);
  const auth = readJson(storageKeys.auth, null);
  if (auth?.loggedIn) writeJson(storageKeys.auth, { ...auth, employee: name });
  if (els.employeeNewName) els.employeeNewName.value = "";
  renderEmployeeControls();
  syncEmployeesToCloud().catch(() => null);
  toast(`${name} ditambahkan ke daftar karyawan.`);
});
els.employeeList?.addEventListener("click", (event) => {
  const useButton = event.target.closest("button[data-use-employee]");
  const deleteButton = event.target.closest("button[data-delete-employee]");
  if (useButton) {
    const name = decodeURIComponent(useButton.dataset.useEmployee);
    localStorage.setItem(storageKeys.employee, name);
    const auth = readJson(storageKeys.auth, null);
    if (auth?.loggedIn) writeJson(storageKeys.auth, { ...auth, employee: name });
    renderEmployeeControls();
    toast(`Petugas aktif: ${name}.`);
    return;
  }
  if (deleteButton) {
    const name = decodeURIComponent(deleteButton.dataset.deleteEmployee);
    const roster = saveEmployeeRoster(getEmployeeRoster().filter((entry) => entry !== name));
    if (activeEmployeeName() === name) {
      localStorage.setItem(storageKeys.employee, roster[0]);
      const auth = readJson(storageKeys.auth, null);
      if (auth?.loggedIn) writeJson(storageKeys.auth, { ...auth, employee: roster[0] });
    }
    renderEmployeeControls();
    deleteEmployeeInCloud(name)
      .then(() => syncEmployeesToCloud())
      .catch(() => syncEmployeesToCloud().catch(() => null));
    toast(`${name} dihapus dari daftar karyawan.`);
  }
});
els.logoutBtn.addEventListener("click", logout);
els.testLogoPrint?.addEventListener("click", testLogoPrint);
els.billOrderBtn.addEventListener("click", printBill);
els.copyDailyReport?.addEventListener("click", copyDailyReport);
els.shareDailyReport?.addEventListener("click", shareDailyReportToWhatsApp);

els.menuForm.addEventListener("submit", saveMenu);
els.purchaseForm?.addEventListener("submit", savePurchase);

// ── Arus Kas: form pengeluaran ──────────────────────────────────────────────
els.cashflowExpenseForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const rawNoteValue = els.cfExpenseNote?.value?.trim();
  const amount = parseRupiah(els.cfExpenseAmount?.value);
  const category = els.cfExpenseCategory?.value;
  if (!rawNoteValue || !amount) {
    toast("Keterangan dan harga total wajib diisi.");
    return;
  }
  let note = rawNoteValue;
  const payload = {
    id: `EXP-${Date.now().toString(36).toUpperCase()}`,
    note,
    amount,
    category,
    createdAt: new Date().toISOString(),
  };

  if (category === "Bahan Baku") {
    const inventory = getInventory();
    const ingredientId = rawNoteValue;
    const ingredient = inventory[ingredientId];
    const qty = Number(els.cfExpenseQty?.value || 0);
    const unit = els.cfExpenseUnit?.value || ingredient?.unit || "gram";
    if (!ingredient || !ingredient.name || !unit || !Number.isFinite(qty) || qty <= 0) {
      toast("Pilih bahan dari Stock Bahan Baku, lalu isi jumlah dan harga total.");
      return;
    }
    note = `Beli ${ingredient.name}`;
    payload.note = note;
    payload.ingredientId = ingredientId;
    payload.qty = qty;
    payload.unit = unit;
    inventory[ingredientId] = {
      ...ingredient,
      name: ingredient.name,
      unit,
      stock: Number(ingredient.stock || 0) + qty,
      buyPrice: amount / qty,
      updatedAt: payload.createdAt,
    };
    saveInventory(inventory);
  }

  saveCashflowExpense({
    ...payload,
  });
  els.cfExpenseAmount.value = "";
  if (els.cfExpenseNote.tagName === "INPUT") els.cfExpenseNote.value = "";
  if (els.cfExpenseQty) els.cfExpenseQty.value = "";
  if (els.cfExpenseUnit) els.cfExpenseUnit.value = "gram";
  syncCfExpenseNoteField();
  renderInventory();
  renderCashflow();
  syncCashflowToCloud().catch(() => null);
  if (category === "Bahan Baku") syncInventoryToCloud().catch(() => null);
  toast("Pengeluaran dicatat.");
});

els.cfExpenseCategory?.addEventListener("change", syncCfExpenseNoteField);
els.cashflowExpenseForm?.addEventListener("change", (event) => {
  if (event.target.id !== "cfExpenseNote") return;
  if (els.cfExpenseCategory?.value !== "Bahan Baku") return;
  const ingredient = getInventory()[els.cfExpenseNote.value];
  if (els.cfExpenseUnit) els.cfExpenseUnit.value = ingredient?.unit || "gram";
});

els.cfExpenseAmount?.addEventListener("blur", () => {
  const value = parseRupiah(els.cfExpenseAmount.value);
  els.cfExpenseAmount.value = value ? money(value) : "";
});

els.cfFilterTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-cf-filter]");
  if (!button) return;
  els.cfFilterTabs.querySelectorAll("button").forEach((entry) => entry.classList.toggle("active", entry === button));
  renderCashflow();
});

els.cashflowMonth?.addEventListener("change", renderCashflow);

els.cashflowList?.addEventListener("click", (event) => {
  const deleteBtn = event.target.closest("button[data-delete-expense]");
  if (!deleteBtn) return;
  const id = deleteBtn.dataset.deleteExpense;
  const expenses = getCashflowExpenses().filter((entry) => entry.id !== id);
  writeJson(storageKeys.cashflowExpenses, expenses);
  renderCashflow();
  deleteCashflowInCloud(id).catch(() => syncCashflowToCloud().catch(() => null));
  toast("Pengeluaran dihapus.");
});

// ── Bahan Baku: edit & delete stock ────────────────────────────────────────
els.stockTable?.addEventListener("click", (event) => {
  const editBtn = event.target.closest("button[data-edit-stock]");
  const deleteBtn = event.target.closest("button[data-delete-stock]");

  if (editBtn) {
    const id = editBtn.dataset.editStock;
    const inventory = getInventory();
    const record = inventory[id];
    if (!record) return;
    const stock = Number(record.stock || 0);
    const totalCost = Number(record.buyPrice || 0) * stock;
    els.purchaseMenuId.value = record.name;
    els.purchaseQty.value = stock || "";
    els.ingredientUnit.value = record.unit || "gram";
    els.purchaseCost.value = totalCost ? money(totalCost) : "";
    els.purchaseForm.dataset.editingStockId = id;
    els.purchaseForm.querySelector("button[type=submit]").textContent = `Update Bahan: ${record.name}`;
    els.purchaseForm.scrollIntoView({ behavior: "smooth", block: "start" });
    toast(`Edit ${record.name}: ubah jumlah tersedia, satuan, dan harga total.`);
    return;
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.deleteStock;
    const inventory = getInventory();
    if (!inventory[id]) return;
    const name = inventory[id].name;
    delete inventory[id];
    saveInventory(inventory);
    renderInventory();
    renderCashflow();
    syncCfExpenseNoteField();
    deleteInventoryInCloud(id).catch(() => syncInventoryToCloud().catch(() => null));
    toast(`Bahan "${name}" dihapus dari stok.`);
  }
});
els.addRecipeIngredient?.addEventListener("click", () => {
  if (!els.recipeIngredientRows) return;
  els.recipeIngredientRows.insertAdjacentHTML("beforeend", recipeRowHtml());
  updateRecipeRowUnits();
});
els.recipeIngredientRows?.addEventListener("change", (event) => {
  if (event.target.closest(".recipe-ingredient-select")) updateRecipeRowUnits();
});
els.recipeIngredientRows?.addEventListener("click", (event) => {
  const button = event.target.closest(".recipe-remove-button");
  if (!button) return;
  const rows = els.recipeIngredientRows.querySelectorAll(".recipe-ingredient-row");
  if (rows.length <= 1) {
    const row = button.closest(".recipe-ingredient-row");
    row.querySelector(".recipe-ingredient-select").value = "";
    row.querySelector(".recipe-qty-input").value = "";
    updateRecipeRowUnits();
    return;
  }
  button.closest(".recipe-ingredient-row")?.remove();
});
els.cancelMenuEdit.addEventListener("click", resetMenuForm);
els.menuCategorySelect.addEventListener("change", syncMenuCategoryField);
els.menuCategoryCustom.addEventListener("input", syncMenuCategoryField);
els.menuImageFile?.addEventListener("change", readMenuImageFile);
els.menuPrice.addEventListener("blur", () => {
  const value = parseRupiah(els.menuPrice.value);
  els.menuPrice.value = value ? money(value) : "";
});
els.purchaseCost?.addEventListener("blur", () => {
  const value = parseRupiah(els.purchaseCost.value);
  els.purchaseCost.value = value ? money(value) : "";
});
els.menuTable.addEventListener("click", (event) => {
  const editButton = event.target.closest("button[data-edit-menu]");
  const deleteButton = event.target.closest("button[data-delete-menu]");
  const menu = getMenu();

  if (editButton) {
    const item = menu.find((entry) => entry.id === editButton.dataset.editMenu);
    if (!item) return;
    els.menuId.value = item.id;
    els.menuName.value = item.name;
    els.menuCategory.value = item.category;
    renderMenuCategoryOptions(item.category);
    els.menuPrice.value = money(item.price);
    setMenuImagePreview(item.image || "");
    renderRecipeRows(item.id);
    els.menuForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (deleteButton) {
    const recipes = getRecipes();
    delete recipes[deleteButton.dataset.deleteMenu];
    saveRecipes(recipes);
    writeJson(storageKeys.menu, menu.filter((item) => item.id !== deleteButton.dataset.deleteMenu));
    markSettingsDirty();
    renderAll();
    syncSettingsToCloud({ force: true }).catch(() => null);
    toast("Menu dihapus.");
  }
});

els.analyticsMonth.addEventListener("change", () => {
  renderAnalytics();
  renderHistory();
});
els.analyticsDate?.addEventListener("change", renderHistory);
els.paidOrderDate?.addEventListener("change", renderOrders);
els.startCamera?.addEventListener("click", startCamera);
els.capturePhoto?.addEventListener("click", capturePhoto);
els.resetBooth?.addEventListener("click", resetBooth);
els.downloadBooth?.addEventListener("click", downloadBooth);
els.boothCustomer?.addEventListener("input", drawBoothCanvas);
els.boothSessionPackage?.addEventListener("change", drawBoothCanvas);
els.loginForm.addEventListener("submit", login);
els.orderForm.addEventListener("submit", startOrder);
els.cancelOrderModal.addEventListener("click", closeOrderModal);
els.orderModal.addEventListener("click", (event) => {
  if (event.target === els.orderModal) closeOrderModal();
});

els.analyticsMonth.value = new Date().toISOString().slice(0, 7);
if (els.analyticsDate) els.analyticsDate.value = dateKey();
if (els.paidOrderDate) els.paidOrderDate.value = dateKey();
if (els.cashflowMonth) els.cashflowMonth.value = new Date().toISOString().slice(0, 7);
if (state.payment === "Kartu") state.payment = "Tunai";
syncCfExpenseNoteField();
registerServiceWorker();
initAuth();
updateClock();
setInterval(updateClock, 1000);
setInterval(() => updateDevicePresence().catch(() => null), 30000);
restoreActiveView();
renderAll();
updateConnectionStatus();
if (navigator.onLine) pullTransactionsFromSupabase({ render: true }).catch(() => null);
if (navigator.onLine) pullSettingsFromSupabase({ render: true }).catch(() => null);
if (isLoggedIn()) syncCloudData();

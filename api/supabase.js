const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_SESSION_SECRET = process.env.API_SESSION_SECRET;
const AUTH_SESSION_TTL_MS = 10 * 60 * 60 * 1000;
const OWNER_USERNAME = process.env.OWNER_USERNAME;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;
const CASHIER_USERNAME = process.env.CASHIER_USERNAME;
const CASHIER_ALIASES = (process.env.CASHIER_ALIASES || "").split(",").map((entry) => entry.trim()).filter(Boolean);
const CASHIER_PASSWORD = process.env.CASHIER_PASSWORD;

const activeWindowMs = 2 * 60 * 1000;
const transactionCacheLimit = 2000;
const supabasePageSize = 1000;
const archiveMaxRows = 50000;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function allowCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function authSecret() {
  return API_SESSION_SECRET || SUPABASE_SERVICE_ROLE_KEY || "kasir-migi-local-session-secret";
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value) {
  return base64UrlEncode(JSON.stringify(value));
}

function signTokenPayload(payload) {
  return crypto.createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

function createSessionToken(role) {
  const now = Date.now();
  const payload = base64UrlJson({ role, iat: now, exp: now + AUTH_SESSION_TTL_MS });
  return `${payload}.${signTokenPayload(payload)}`;
}

function verifySessionToken(token = "") {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;
  const expected = signTokenPayload(payload);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session?.role || Date.now() > Number(session.exp || 0)) return null;
    return session;
  } catch {
    return null;
  }
}

function requestToken(req) {
  const header = req.headers.authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function requireAuth(req) {
  const session = verifySessionToken(requestToken(req));
  if (!session) {
    return { status: 401, payload: { success: false, error: "Sesi tidak valid atau sudah habis. Silakan login ulang." } };
  }
  return { session };
}

function login(body = {}) {
  if (!OWNER_USERNAME || !OWNER_PASSWORD || !CASHIER_USERNAME || !CASHIER_PASSWORD) {
    return { status: 503, payload: { success: false, error: "Konfigurasi auth belum lengkap di server. Hubungi Owner." } };
  }
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const isCashierUsername = username === CASHIER_USERNAME || CASHIER_ALIASES.includes(username);
  const role =
    username === OWNER_USERNAME && password === OWNER_PASSWORD
      ? "owner"
      : isCashierUsername && password === CASHIER_PASSWORD
        ? "cashier"
        : "";

  if (!role) return { status: 401, payload: { success: false, error: "Username atau password salah." } };
  return { status: 200, payload: { success: true, role, token: createSessionToken(role), expiresInMs: AUTH_SESSION_TTL_MS } };
}

function assertSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum tersedia di Vercel Environment Variables.");
  }
}

async function supabaseFetch(path, options = {}) {
  assertSupabaseEnv();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || response.statusText;
    throw new Error(`Supabase ${response.status}: ${message}`);
  }
  return data;
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

async function supabaseFetchPaged(pathForOffset, { pageSize = supabasePageSize, maxRows = archiveMaxRows } = {}) {
  const rows = [];
  const safePageSize = clampNumber(pageSize, supabasePageSize, 1, 1000);
  const safeMaxRows = clampNumber(maxRows, archiveMaxRows, 1, archiveMaxRows);

  for (let offset = 0; rows.length < safeMaxRows; offset += safePageSize) {
    const limit = Math.min(safePageSize, safeMaxRows - rows.length);
    const page = await supabaseFetch(pathForOffset({ limit, offset }));
    if (!Array.isArray(page) || !page.length) break;
    rows.push(...page);
    if (page.length < limit) break;
  }

  return rows;
}

function archiveDateParam(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
}

function transactionPath({ deleted = false, startDate = "", endDate = "", limit = transactionCacheLimit, offset = 0 }) {
  const params = [
    "select=*",
    deleted ? "deleted_at=not.is.null" : "deleted_at=is.null",
    "order=created_at.desc",
    `limit=${limit}`,
  ];
  if (offset) params.push(`offset=${offset}`);
  const start = archiveDateParam(startDate);
  const end = archiveDateParam(endDate);
  if (start) params.push(`created_at=gte.${encodeURIComponent(start)}`);
  if (end) params.push(`created_at=lt.${encodeURIComponent(end)}`);
  return `transactions?${params.join("&")}`;
}

async function fetchTransactionRows({ deleted = false, startDate = "", endDate = "", limit = transactionCacheLimit, fullArchive = false } = {}) {
  const hasPeriod = Boolean(archiveDateParam(startDate) || archiveDateParam(endDate));
  const safeLimit = clampNumber(limit, transactionCacheLimit, 1, archiveMaxRows);
  if (fullArchive || hasPeriod || safeLimit > supabasePageSize) {
    return supabaseFetchPaged(
      ({ limit: pageLimit, offset }) => transactionPath({ deleted, startDate, endDate, limit: pageLimit, offset }),
      { maxRows: safeLimit },
    );
  }
  return supabaseFetch(transactionPath({ deleted, startDate, endDate, limit: safeLimit }));
}

async function fetchDeletedTransactionRows({ startDate = "", endDate = "", limit = transactionCacheLimit, fullArchive = false } = {}) {
  const rows = await fetchTransactionRows({ deleted: true, startDate, endDate, limit, fullArchive });
  return rows.map(({ id, created_at, deleted_at }) => ({ id, created_at, deleted_at }));
}

async function fetchItemsByTransactionIds(ids = []) {
  const chunks = [];
  for (let index = 0; index < ids.length; index += 100) chunks.push(ids.slice(index, index + 100));
  const pages = await Promise.all(
    chunks.map((chunk) => supabaseFetchPaged(
      ({ limit, offset }) => `transaction_items?select=*&transaction_id=in.(${chunk.map(encodeURIComponent).join(",")})&limit=${limit}${offset ? `&offset=${offset}` : ""}`,
      { maxRows: archiveMaxRows },
    )),
  );
  return pages.flat();
}

function groupTransactionItems(items = []) {
  return items.reduce((map, item) => {
    const list = map.get(item.transaction_id) || [];
    list.push({
      id: item.menu_id,
      name: item.name,
      category: item.category,
      price: Number(item.price || 0),
      qty: Number(item.qty || 0),
    });
    map.set(item.transaction_id, list);
    return map;
  }, new Map());
}

function toIso(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function timestampMs(value) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function transactionVersion(transaction = {}) {
  return Math.max(
    timestampMs(transaction.updatedAt),
    timestampMs(transaction.editedAt),
    timestampMs(transaction.paymentEditedAt),
    timestampMs(transaction.stockSyncedAt),
    timestampMs(transaction.createdAt),
  );
}

function transactionIdentityConflict(existing = {}, incoming = {}) {
  const existingCreatedAt = timestampMs(existing.createdAt);
  const incomingCreatedAt = timestampMs(incoming.createdAt);
  if (!existingCreatedAt || !incomingCreatedAt) return false;
  return Math.abs(existingCreatedAt - incomingCreatedAt) > 60 * 1000;
}

async function findTransactionById(id) {
  const rows = await supabaseFetch(
    `transactions?select=id,created_at,status,deleted_at,raw&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

function mapTransaction(transaction) {
  return {
    id: String(transaction.id || transaction.localId || ""),
    created_at: toIso(transaction.createdAt),
    customer: transaction.customer || "",
    table_number: transaction.table || "",
    shift: transaction.shift || "",
    channel: transaction.channel || "Kasir",
    status: transaction.status || "paid",
    employee: transaction.employee || "",
    payment: transaction.payment || "",
    paid: toNumber(transaction.paid),
    change: toNumber(transaction.change),
    subtotal: toNumber(transaction.subtotal),
    grand_total: toNumber(transaction.grandTotal),
    deleted_at: null,
    raw: transaction,
  };
}

function mapItems(transaction) {
  const transactionId = String(transaction.id || transaction.localId || "");
  return (transaction.items || []).map((item) => ({
    transaction_id: transactionId,
    menu_id: item.id || "",
    name: item.name || "",
    category: item.category || "",
    price: toNumber(item.price),
    qty: toNumber(item.qty),
  }));
}

function toLocalTransaction(row, items) {
  const raw = row.raw && typeof row.raw === "object" ? row.raw : {};
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const usedItemIndexes = new Set();
  const mergedRawItems = rawItems.map((rawItem) => {
    const itemIndex = items.findIndex((item, index) => {
      if (usedItemIndexes.has(index)) return false;
      return rawItem.id === item.id || rawItem.id === item.menu_id || rawItem.name === item.name;
    });
    if (itemIndex === -1) return rawItem;
    usedItemIndexes.add(itemIndex);
    return { ...rawItem, ...items[itemIndex] };
  });
  const extraItems = items.filter((_, index) => !usedItemIndexes.has(index));
  const mergedItems = [...mergedRawItems, ...extraItems];
  return {
    ...raw,
    id: row.id,
    createdAt: raw.createdAt || row.created_at,
    customer: raw.customer || row.customer || "Teman Migi",
    table: raw.table || row.table_number || row.id,
    shift: raw.shift || row.shift || "Shift 1",
    channel: raw.channel || row.channel || "Kasir",
    status: raw.status || row.status || "paid",
    employee: raw.employee || row.employee || "Admin",
    payment: raw.payment || row.payment || "",
    paid: Number(row.paid || 0),
    change: Number(row.change || 0),
    subtotal: Number(row.subtotal || 0),
    grandTotal: Number(row.grand_total || 0),
    items: mergedItems.length ? mergedItems : rawItems,
  };
}

function toLocalExpense(row) {
  const raw = row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
    id: row.id,
    createdAt: raw.createdAt || row.created_at,
    note: raw.note || row.note || "",
    amount: Number(row.amount || 0),
    category: raw.category || row.category || "",
    ingredientId: raw.ingredientId || row.ingredient_id || "",
    qty: raw.qty ?? row.qty,
    unit: raw.unit || row.unit || "",
  };
}

function toLocalInventory(rows) {
  return rows.reduce((map, row) => {
    const raw = row.raw && typeof row.raw === "object" ? row.raw : {};
    map[row.id] = {
      ...raw,
      name: raw.name || row.name,
      category: raw.category || row.category || "Lainnya",
      unit: raw.unit || row.unit || "gram",
      stock: Number(row.stock || 0),
      buyPrice: Number(row.buy_price || 0),
      updatedAt: raw.updatedAt || row.updated_at,
    };
    return map;
  }, {});
}

function mapExpense(expense) {
  return {
    id: String(expense.id || ""),
    created_at: toIso(expense.createdAt),
    note: expense.note || "",
    amount: toNumber(expense.amount),
    category: expense.category || "",
    ingredient_id: expense.ingredientId || null,
    qty: expense.qty === undefined ? null : toNumber(expense.qty),
    unit: expense.unit || null,
    raw: expense,
  };
}

function mapInventory(id, record) {
  return {
    id: String(id || record.id || ""),
    name: record.name || "",
    unit: record.unit || "gram",
    stock: toNumber(record.stock),
    buy_price: toNumber(record.buyPrice),
    updated_at: toIso(record.updatedAt),
    raw: record,
  };
}

function collectInventoryRows(body) {
  if (Array.isArray(body?.records)) return body.records.map((record) => mapInventory(record.id, record));
  if (body?.inventory && typeof body.inventory === "object") {
    return Object.entries(body.inventory).map(([id, record]) => mapInventory(id, record));
  }
  return [mapInventory(body?.id, body || {})];
}

function collectEmployeeRows(body) {
  const names = Array.isArray(body?.employees) ? body.employees : [];
  const uniqueNames = [...new Set(names.map((name) => String(name || "").trim()).filter(Boolean))];
  return uniqueNames.map((name) => ({
    name,
    role: "cashier",
    active: true,
    updated_at: toIso(),
    deleted_at: null,
  }));
}

function employeeKey(name) {
  return String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function getDeletedEmployeeRows() {
  const rows = await supabaseFetch("app_settings?select=*&key=eq.deleted_employees&limit=1").catch(() => []);
  const value = Array.isArray(rows) ? rows[0]?.value : null;
  return Array.isArray(value) ? value : [];
}

async function saveDeletedEmployeeRows(rows) {
  await supabaseFetch("app_settings?on_conflict=key", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{ key: "deleted_employees", value: rows.slice(0, 300), updated_at: toIso() }],
  });
}

async function rememberDeletedEmployee(name) {
  const key = employeeKey(name);
  if (!key) return;
  const rows = (await getDeletedEmployeeRows()).filter((entry) => (entry.key || employeeKey(entry.name)) !== key);
  rows.unshift({ name, key, deleted_at: toIso() });
  await saveDeletedEmployeeRows(rows);
}

function isStaffDrinkPayload(transaction = {}) {
  return transaction.isStaffDrink === true || transaction.orderType === "staff_drink";
}

function staffDrinkMatches(transaction = {}, body = {}) {
  const date = String(body.date || "").trim();
  const employee = String(body.employee || "").trim();
  const employeeId = String(body.employeeId || "").trim();
  const transactionEmployeeId = String(transaction.employeeId || "").trim();
  const transactionEmployee = String(transaction.employee || "").trim();
  if (!isStaffDrinkPayload(transaction)) return false;
  if (date && transaction.staffDrinkDate !== date) return false;
  return Boolean(
    (employeeId && transactionEmployeeId && transactionEmployeeId === employeeId) ||
    (employee && transactionEmployee && transactionEmployee.toLowerCase() === employee.toLowerCase()),
  );
}

async function findStaffDrinkUsage(body = {}) {
  const rows = await fetchTransactionRows({ limit: transactionCacheLimit });
  const excludeId = String(body.excludeId || "").trim();
  return rows.find((row) => {
    if (excludeId && row.id === excludeId) return false;
    const raw = row.raw && typeof row.raw === "object" ? row.raw : {};
    return staffDrinkMatches(raw, body);
  });
}

async function checkStaffDrink(body) {
  const existing = await findStaffDrinkUsage(body);
  return {
    status: 200,
    payload: {
      success: true,
      used: Boolean(existing),
      transaction: existing ? { id: existing.id, createdAt: existing.created_at, employee: existing.raw?.employee || existing.employee || "" } : null,
    },
  };
}

async function syncTransaction(body) {
  const transaction = body.transaction || body;
  const row = mapTransaction(transaction);
  if (!row.id) return { status: 400, payload: { success: false, error: "Transaction id wajib ada." } };
  const existingRow = await findTransactionById(row.id);
  const existingRaw = existingRow?.raw && typeof existingRow.raw === "object" ? existingRow.raw : {};
  const existing = existingRow
    ? {
        ...existingRaw,
        createdAt: existingRaw.createdAt || existingRow.created_at,
        status: existingRaw.status || existingRow.status,
      }
    : {};
  if (existingRow?.deleted_at) {
    return { status: 200, payload: { success: true, id: row.id, ignored: true, reason: "deleted" } };
  }
  const createdAtDifference = Math.abs(timestampMs(existing.createdAt) - timestampMs(transaction.createdAt));
  const payingRecentDraft = existingRow?.status === "unpaid" && row.status === "paid" && createdAtDifference <= 24 * 60 * 60 * 1000;
  if (existingRow && !payingRecentDraft && transactionIdentityConflict(existing, transaction)) {
    return {
      status: 409,
      payload: {
        success: false,
        code: "TRANSACTION_ID_CONFLICT",
        error: "ID transaksi sudah dipakai oleh transaksi pada tanggal lain. Data cloud tidak diubah.",
      },
    };
  }
  if (existingRow && transactionVersion(existing) > transactionVersion(transaction)) {
    return { status: 200, payload: { success: true, id: row.id, ignored: true, reason: "stale" } };
  }
  if (isStaffDrinkPayload(transaction)) {
    const duplicate = await findStaffDrinkUsage({
      date: transaction.staffDrinkDate,
      employee: transaction.employee,
      employeeId: transaction.employeeId,
      excludeId: row.id,
    });
    if (duplicate) {
      return { status: 409, payload: { success: false, error: "Staff Drink karyawan ini sudah digunakan hari ini.", duplicateId: duplicate.id } };
    }
  }

  await supabaseFetch("transactions?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: row,
  });

  await supabaseFetch(`transaction_items?transaction_id=eq.${encodeURIComponent(row.id)}`, {
    method: "DELETE",
    prefer: "return=minimal",
  });

  const items = mapItems(transaction);
  if (items.length) {
    await supabaseFetch("transaction_items", {
      method: "POST",
      prefer: "return=minimal",
      body: items,
    });
  }

  return { status: 200, payload: { success: true, id: row.id } };
}

async function getTransactions(body = {}) {
  const fullArchive = body.fullArchive === true || body.archive === true;
  const startDate = body.startDate || body.from || "";
  const endDate = body.endDate || body.to || "";
  const limit = fullArchive || startDate || endDate
    ? clampNumber(body.limit, archiveMaxRows, 1, archiveMaxRows)
    : transactionCacheLimit;
  const [transactions, deletedTransactions] = await Promise.all([
    fetchTransactionRows({ startDate, endDate, limit, fullArchive }),
    fetchDeletedTransactionRows({ startDate, endDate, limit, fullArchive }),
  ]);
  const ids = transactions.map((row) => row.id).filter(Boolean);
  const items = ids.length ? await fetchItemsByTransactionIds(ids) : [];
  const itemsByTransaction = groupTransactionItems(items);

  return {
    status: 200,
    payload: {
      success: true,
      transactions: transactions.map((row) => toLocalTransaction(row, itemsByTransaction.get(row.id) || [])),
      deletedTransactions,
      source: "supabase",
      archive: fullArchive || Boolean(startDate || endDate),
      count: transactions.length,
    },
  };
}

async function deleteTransaction(body) {
  const id = String(body.id || "").trim();
  if (!id) return { status: 400, payload: { success: false, error: "Transaction id wajib ada." } };

  const rows = await supabaseFetch(`transactions?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: { deleted_at: toIso() },
  });
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: 404, payload: { success: false, error: "Transaksi tidak ditemukan di Supabase." } };
  }

  return { status: 200, payload: { success: true, id, deleted_at: rows[0].deleted_at } };
}

async function bootstrapData() {
  const [transactions, deletedTransactions, expenses, inventory, employees, settingsRows, deletedEmployeeRows] = await Promise.all([
    fetchTransactionRows({ limit: transactionCacheLimit }),
    fetchDeletedTransactionRows({ limit: transactionCacheLimit }),
    supabaseFetch("cashflow_expenses?select=*&order=created_at.desc&limit=2000"),
    supabaseFetch("inventory?select=*&order=name.asc"),
    supabaseFetch("employees?select=*&active=eq.true&deleted_at=is.null&order=name.asc"),
    supabaseFetch("app_settings?select=*&key=eq.global&limit=1").catch(() => []),
    supabaseFetch("app_settings?select=*&key=eq.deleted_employees&limit=1").catch(() => []),
  ]);
  const transactionIds = transactions.map((row) => row.id).filter(Boolean);
  const items = transactionIds.length ? await fetchItemsByTransactionIds(transactionIds) : [];
  const settingsRow = Array.isArray(settingsRows) ? settingsRows[0] : null;
  const deletedEmployeeValue = Array.isArray(deletedEmployeeRows) ? deletedEmployeeRows[0]?.value : [];
  const deletedEmployeeKeys = new Set((Array.isArray(deletedEmployeeValue) ? deletedEmployeeValue : []).map((entry) => entry.key || employeeKey(entry.name)).filter(Boolean));
  const activeEmployees = employees.filter((row) => !deletedEmployeeKeys.has(employeeKey(row.name)));
  const itemsByTransaction = groupTransactionItems(items);

  return {
    status: 200,
    payload: {
      success: true,
      history: transactions.map((row) => toLocalTransaction(row, itemsByTransaction.get(row.id) || [])),
      deletedTransactions,
      cashflowExpenses: expenses.map(toLocalExpense),
      inventory: toLocalInventory(inventory),
      employees: activeEmployees.map((row) => row.name),
      settingsFound: Boolean(settingsRow),
      settings: settingsRow?.value || {},
    },
  };
}

async function syncCashflow(body) {
  const input = Array.isArray(body.expenses) ? body.expenses : Array.isArray(body) ? body : [body.expense || body || {}];
  const rows = input.map(mapExpense).filter((row) => row.id);
  if (!rows.length) return { status: 400, payload: { success: false, error: "Expense id wajib ada." } };

  await supabaseFetch("cashflow_expenses?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: rows,
  });
  return { status: 200, payload: { success: true, count: rows.length } };
}

async function syncInventory(body) {
  const rows = collectInventoryRows(body).filter((row) => row.id && row.name);
  if (!rows.length) return { status: 200, payload: { success: true, count: 0 } };

  await supabaseFetch("inventory?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: rows,
  });
  return { status: 200, payload: { success: true, count: rows.length } };
}

async function syncEmployees(body) {
  const restoreKeys = new Set((Array.isArray(body?.restoreNames) ? body.restoreNames : []).map(employeeKey).filter(Boolean));
  let deletedRows = await getDeletedEmployeeRows();
  if (restoreKeys.size) {
    deletedRows = deletedRows.filter((entry) => !restoreKeys.has(entry.key || employeeKey(entry.name)));
    await saveDeletedEmployeeRows(deletedRows);
  }
  const deleted = new Set(deletedRows.map((entry) => entry.key || employeeKey(entry.name)).filter(Boolean));
  const rows = collectEmployeeRows(body).filter((row) => !deleted.has(employeeKey(row.name)));

  await Promise.all(rows.map(upsertEmployeeByName));
  return { status: 200, payload: { success: true, count: rows.length } };
}

async function upsertEmployeeByName(row) {
  const name = String(row.name || "").trim();
  if (!name) return null;
  const payload = {
    ...row,
    name,
    role: row.role || "cashier",
    active: row.active !== false,
    updated_at: row.updated_at || toIso(),
    deleted_at: row.deleted_at || null,
  };
  const updated = await supabaseFetch(`employees?name=ilike.${encodeURIComponent(name)}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: payload,
  });
  if (Array.isArray(updated) && updated.length) return updated[0];
  const inserted = await supabaseFetch("employees", {
    method: "POST",
    prefer: "return=representation",
    body: [payload],
  });
  return Array.isArray(inserted) ? inserted[0] : null;
}

async function addEmployee(body) {
  const name = String(body.name || "").trim();
  if (!name) return { status: 400, payload: { success: false, error: "Nama karyawan wajib ada." } };

  const key = employeeKey(name);
  const deletedRows = (await getDeletedEmployeeRows()).filter((entry) => (entry.key || employeeKey(entry.name)) !== key);
  await saveDeletedEmployeeRows(deletedRows);

  const employee = await upsertEmployeeByName({
    name,
    role: "cashier",
    active: true,
    updated_at: toIso(),
    deleted_at: null,
  });
  return { status: 200, payload: { success: true, employee: employee || { name } } };
}

async function syncSettings(body) {
  const value = body.settings;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { status: 400, payload: { success: false, error: "Settings wajib berupa object." } };
  }

  await supabaseFetch("app_settings?on_conflict=key", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{ key: "global", value, updated_at: toIso() }],
  });
  return { status: 200, payload: { success: true } };
}

async function getSettings() {
  const rows = await supabaseFetch("app_settings?select=*&key=eq.global&limit=1");
  const row = Array.isArray(rows) ? rows[0] : null;
  return {
    status: 200,
    payload: {
      success: true,
      found: Boolean(row),
      settings: row?.value || {},
      updatedAt: row?.updated_at || null,
    },
  };
}

async function deleteById(table, id, label) {
  const value = String(id || "").trim();
  if (!value) return { status: 400, payload: { success: false, error: `${label} wajib ada.` } };
  await supabaseFetch(`${table}?id=eq.${encodeURIComponent(value)}`, {
    method: "DELETE",
    prefer: "return=minimal",
  });
  return { status: 200, payload: { success: true, id: value } };
}

async function deleteEmployee(body) {
  const name = String(body.name || "").trim();
  if (!name) return { status: 400, payload: { success: false, error: "Nama karyawan wajib ada." } };
  await rememberDeletedEmployee(name);
  const rows = await supabaseFetch(`employees?name=ilike.${encodeURIComponent(name)}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: {
      active: false,
      updated_at: toIso(),
      deleted_at: toIso(),
    },
  });
  return { status: 200, payload: { success: true, name, employee: Array.isArray(rows) ? rows[0] : null } };
}

async function devicePresence(body, req) {
  const deviceId = String(body.deviceId || "").trim();
  const employee = String(body.employee || "").trim();
  if (!deviceId) return { status: 400, payload: { success: false, error: "Device id wajib ada." } };

  const rows = await supabaseFetch("app_settings?select=*&key=eq.active_device&limit=1");
  const active = Array.isArray(rows) ? rows[0]?.value : null;
  const lastSeenAt = active?.lastSeenAt ? new Date(active.lastSeenAt) : null;
  const otherActive =
    active?.deviceId &&
    active.deviceId !== deviceId &&
    lastSeenAt &&
    Date.now() - lastSeenAt.getTime() < activeWindowMs;

  if (body.logout) {
    await supabaseFetch("app_settings?on_conflict=key", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: [
        {
          key: "logout_marker",
          value: {
            deviceId,
            employee,
            role: body.role || "",
            at: toIso(),
          },
          updated_at: toIso(),
        },
      ],
    });
    if (active?.deviceId === deviceId) {
      await supabaseFetch("app_settings?on_conflict=key", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: [
          {
            key: "active_device",
            value: { deviceId: "", employee: "", userAgent: "", lastSeenAt: "1970-01-01T00:00:00.000Z" },
            updated_at: toIso(),
          },
        ],
      });
    }
    return { status: 200, payload: { success: true, cleared: active?.deviceId === deviceId } };
  }

  if (body.checkOnly) {
    return {
      status: 200,
      payload: { success: true, otherActive: Boolean(otherActive), activeDevice: otherActive ? active : null },
    };
  }

  await supabaseFetch("app_settings?on_conflict=key", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [
      {
        key: "active_device",
        value: {
          deviceId,
          employee,
          userAgent: req.headers["user-agent"] || "",
          lastSeenAt: toIso(),
        },
        updated_at: toIso(),
      },
    ],
  });

  return {
    status: 200,
    payload: { success: true, otherActive: Boolean(otherActive), activeDevice: otherActive ? active : null },
  };
}

async function getLogoutState() {
  const rows = await supabaseFetch("app_settings?select=*&key=eq.logout_marker&limit=1");
  const marker = Array.isArray(rows) ? rows[0]?.value : null;
  return { status: 200, payload: { success: true, marker: marker || null } };
}

async function dispatch(body, req) {
  if (body.action === "login") return login(body);

  const auth = requireAuth(req);
  if (auth.payload) return auth;
  const role = auth.session.role;

  switch (body.action) {
    case "sync-transaction":
      return syncTransaction(body);
    case "get-transactions":
      return getTransactions(body);
    case "check-staff-drink":
      return checkStaffDrink(body);
    case "delete-transaction":
      if (role !== "owner") return { status: 403, payload: { success: false, error: "Hanya Owner yang bisa menghapus transaksi." } };
      return deleteTransaction(body);
    case "bootstrap-data":
      return bootstrapData();
    case "sync-cashflow":
      return syncCashflow(body);
    case "sync-inventory":
      return syncInventory(body);
    case "sync-employees":
      return syncEmployees(body);
    case "add-employee":
      return addEmployee(body);
    case "sync-settings":
      if (role !== "owner") return { status: 403, payload: { success: false, error: "Hanya Owner yang bisa mengubah pengaturan." } };
      return syncSettings(body);
    case "get-settings":
      return getSettings();
    case "delete-cashflow":
      if (role !== "owner") return { status: 403, payload: { success: false, error: "Hanya Owner yang bisa menghapus pengeluaran." } };
      return deleteById("cashflow_expenses", body.id, "ID pengeluaran");
    case "delete-inventory":
      if (role !== "owner") return { status: 403, payload: { success: false, error: "Hanya Owner yang bisa menghapus bahan baku." } };
      return deleteById("inventory", body.id, "ID bahan baku");
    case "delete-employee":
      if (role !== "owner") return { status: 403, payload: { success: false, error: "Hanya Owner yang bisa menghapus karyawan." } };
      return deleteEmployee(body);
    case "device-presence":
      return devicePresence(body, req);
    case "logout-state":
      return getLogoutState();
    default:
      return { status: 400, payload: { success: false, error: "Action Supabase tidak dikenal." } };
  }
}

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { success: false, error: "Method not allowed" });

  try {
    const result = await dispatch(req.body || {}, req);
    return sendJson(res, result.status, result.payload);
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message });
  }
};

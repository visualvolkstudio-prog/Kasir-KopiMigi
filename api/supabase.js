const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const activeWindowMs = 2 * 60 * 1000;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function allowCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
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

function toIso(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
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
  const mergedItems = items.map((item) => {
    const rawItem = rawItems.find((entry) => entry.id === item.id || entry.id === item.menu_id || entry.name === item.name) || {};
    return { ...rawItem, ...item };
  });
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
  const rows = await supabaseFetch("transactions?select=*&deleted_at=is.null&order=created_at.desc&limit=2000");
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

async function getTransactions() {
  const [transactions, deletedTransactions] = await Promise.all([
    supabaseFetch("transactions?select=*&deleted_at=is.null&order=created_at.desc&limit=2000"),
    supabaseFetch("transactions?select=id,created_at,deleted_at&deleted_at=not.is.null&order=created_at.desc&limit=2000"),
  ]);
  const ids = transactions.map((row) => row.id).filter(Boolean);
  const items = ids.length
    ? await supabaseFetch(`transaction_items?select=*&transaction_id=in.(${ids.map(encodeURIComponent).join(",")})`)
    : [];

  const itemsByTransaction = items.reduce((map, item) => {
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

  return {
    status: 200,
    payload: {
      success: true,
      transactions: transactions.map((row) => toLocalTransaction(row, itemsByTransaction.get(row.id) || [])),
      deletedTransactions,
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
  const [transactions, deletedTransactions, items, expenses, inventory, employees, settingsRows, deletedEmployeeRows] = await Promise.all([
    supabaseFetch("transactions?select=*&deleted_at=is.null&order=created_at.desc&limit=2000"),
    supabaseFetch("transactions?select=id,created_at,deleted_at&deleted_at=not.is.null&order=created_at.desc&limit=2000"),
    supabaseFetch("transaction_items?select=*"),
    supabaseFetch("cashflow_expenses?select=*&order=created_at.desc&limit=2000"),
    supabaseFetch("inventory?select=*&order=name.asc"),
    supabaseFetch("employees?select=*&active=eq.true&deleted_at=is.null&order=name.asc"),
    supabaseFetch("app_settings?select=*&key=eq.global&limit=1").catch(() => []),
    supabaseFetch("app_settings?select=*&key=eq.deleted_employees&limit=1").catch(() => []),
  ]);
  const settingsRow = Array.isArray(settingsRows) ? settingsRows[0] : null;
  const deletedEmployeeValue = Array.isArray(deletedEmployeeRows) ? deletedEmployeeRows[0]?.value : [];
  const deletedEmployeeKeys = new Set((Array.isArray(deletedEmployeeValue) ? deletedEmployeeValue : []).map((entry) => entry.key || employeeKey(entry.name)).filter(Boolean));
  const activeEmployees = employees.filter((row) => !deletedEmployeeKeys.has(employeeKey(row.name)));
  const itemsByTransaction = items.reduce((map, item) => {
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
  switch (body.action) {
    case "sync-transaction":
      return syncTransaction(body);
    case "get-transactions":
      return getTransactions();
    case "check-staff-drink":
      return checkStaffDrink(body);
    case "delete-transaction":
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
      return syncSettings(body);
    case "get-settings":
      return getSettings();
    case "delete-cashflow":
      return deleteById("cashflow_expenses", body.id, "ID pengeluaran");
    case "delete-inventory":
      return deleteById("inventory", body.id, "ID bahan baku");
    case "delete-employee":
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

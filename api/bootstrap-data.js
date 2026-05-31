const { allowCors, sendJson, supabaseFetch } = require("./_supabase");

function toLocalTransaction(row, items) {
  const raw = row.raw && typeof row.raw === "object" ? row.raw : {};
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
    items,
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
      unit: raw.unit || row.unit || "gram",
      stock: Number(row.stock || 0),
      buyPrice: Number(row.buy_price || 0),
      updatedAt: raw.updatedAt || row.updated_at,
    };
    return map;
  }, {});
}

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const [transactions, items, expenses, inventory, employees] = await Promise.all([
      supabaseFetch("transactions?select=*&order=created_at.desc&limit=500"),
      supabaseFetch("transaction_items?select=*"),
      supabaseFetch("cashflow_expenses?select=*&order=created_at.desc&limit=500"),
      supabaseFetch("inventory?select=*&order=name.asc"),
      supabaseFetch("employees?select=*&active=eq.true&order=name.asc"),
    ]);

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

    return sendJson(res, 200, {
      success: true,
      history: transactions.map((row) => toLocalTransaction(row, itemsByTransaction.get(row.id) || [])),
      cashflowExpenses: expenses.map(toLocalExpense),
      inventory: toLocalInventory(inventory),
      employees: employees.map((row) => row.name),
    });
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message });
  }
};

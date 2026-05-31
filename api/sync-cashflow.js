const { allowCors, sendJson, supabaseFetch, toIso, toNumber } = require("./_supabase");

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

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const input = Array.isArray(req.body) ? req.body : [req.body || {}];
    const rows = input.map(mapExpense).filter((row) => row.id);
    if (!rows.length) return sendJson(res, 400, { error: "Expense id wajib ada." });

    await supabaseFetch("cashflow_expenses?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: rows,
    });

    return sendJson(res, 200, { success: true, count: rows.length });
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message });
  }
};

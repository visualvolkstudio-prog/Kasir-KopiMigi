const { allowCors, sendJson, supabaseFetch } = require("./_supabase");

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const id = String(req.body?.id || "").trim();
    if (!id) return sendJson(res, 400, { success: false, error: "ID pengeluaran wajib ada." });

    await supabaseFetch(`cashflow_expenses?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });

    return sendJson(res, 200, { success: true, id });
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message });
  }
};

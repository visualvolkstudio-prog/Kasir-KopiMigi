const { allowCors, sendJson, supabaseFetch, toIso } = require("./_supabase");

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const id = String(req.body?.id || "").trim();
    if (!id) return sendJson(res, 400, { error: "Transaction id wajib ada." });

    const rows = await supabaseFetch(`transactions?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: { deleted_at: toIso() },
    });
    if (!Array.isArray(rows) || rows.length === 0) {
      return sendJson(res, 404, { success: false, error: "Transaksi tidak ditemukan di Supabase." });
    }

    return sendJson(res, 200, { success: true, id, deleted_at: rows[0].deleted_at });
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message });
  }
};

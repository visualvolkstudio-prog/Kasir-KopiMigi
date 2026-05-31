const { allowCors, sendJson, supabaseFetch, toIso } = require("./_supabase");

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const id = String(req.body?.id || "").trim();
    if (!id) return sendJson(res, 400, { error: "Transaction id wajib ada." });

    await supabaseFetch(`transactions?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: { deleted_at: toIso() },
    });

    return sendJson(res, 200, { success: true, id });
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message });
  }
};

const { allowCors, sendJson, supabaseFetch } = require("./_supabase");

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const rows = await supabaseFetch("app_settings?select=*&key=eq.global&limit=1");
    const row = Array.isArray(rows) ? rows[0] : null;
    return sendJson(res, 200, {
      success: true,
      found: Boolean(row),
      settings: row?.value || {},
      updatedAt: row?.updated_at || null,
    });
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message });
  }
};

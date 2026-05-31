const { allowCors, sendJson, supabaseFetch, toIso } = require("./_supabase");

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const value = req.body?.settings;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return sendJson(res, 400, { success: false, error: "Settings wajib berupa object." });
    }

    await supabaseFetch("app_settings?on_conflict=key", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: [
        {
          key: "global",
          value,
          updated_at: toIso(),
        },
      ],
    });

    return sendJson(res, 200, { success: true });
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message });
  }
};

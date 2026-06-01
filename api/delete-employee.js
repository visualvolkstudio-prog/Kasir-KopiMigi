const { allowCors, sendJson, supabaseFetch } = require("./_supabase");

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return sendJson(res, 400, { success: false, error: "Nama karyawan wajib ada." });

    await supabaseFetch(`employees?name=eq.${encodeURIComponent(name)}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });

    return sendJson(res, 200, { success: true, name });
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message });
  }
};

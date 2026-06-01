const { allowCors, sendJson, supabaseFetch, toIso } = require("./_supabase");

function collectRows(body) {
  const names = Array.isArray(body?.employees) ? body.employees : [];
  const uniqueNames = [...new Set(names.map((name) => String(name || "").trim()).filter(Boolean))];
  return uniqueNames
    .map((name) => ({
      name,
      active: true,
      updated_at: toIso(),
    }));
}

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const rows = collectRows(req.body);
    if (!rows.length) return sendJson(res, 400, { error: "Minimal satu nama karyawan wajib ada." });
    const activeNames = new Set(rows.map((row) => row.name));
    const existing = await supabaseFetch("employees?select=name");
    const inactiveRows = Array.isArray(existing) ? existing.filter((row) => row.name && !activeNames.has(row.name)) : [];

    await Promise.all(
      inactiveRows.map((row) =>
        supabaseFetch(`employees?name=eq.${encodeURIComponent(row.name)}`, {
          method: "PATCH",
          prefer: "return=minimal",
          body: {
            active: false,
            updated_at: toIso(),
          },
        }),
      ),
    );

    await supabaseFetch("employees?on_conflict=name", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: rows,
    });

    return sendJson(res, 200, { success: true, count: rows.length });
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message });
  }
};

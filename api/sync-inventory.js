const { allowCors, sendJson, supabaseFetch, toIso, toNumber } = require("./_supabase");

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

function collectRows(body) {
  if (Array.isArray(body?.records)) return body.records.map((record) => mapInventory(record.id, record));
  if (body?.inventory && typeof body.inventory === "object") {
    return Object.entries(body.inventory).map(([id, record]) => mapInventory(id, record));
  }
  return [mapInventory(body?.id, body || {})];
}

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const rows = collectRows(req.body).filter((row) => row.id && row.name);
    if (!rows.length) return sendJson(res, 400, { error: "Inventory id dan name wajib ada." });

    await supabaseFetch("inventory?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: rows,
    });

    return sendJson(res, 200, { success: true, count: rows.length });
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message });
  }
};

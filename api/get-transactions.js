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

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const transactions = await supabaseFetch("transactions?select=*&deleted_at=is.null&order=created_at.desc&limit=500");
    const ids = transactions.map((row) => row.id).filter(Boolean);
    const items = ids.length
      ? await supabaseFetch(`transaction_items?select=*&transaction_id=in.(${ids.map(encodeURIComponent).join(",")})`)
      : [];

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
      transactions: transactions.map((row) => toLocalTransaction(row, itemsByTransaction.get(row.id) || [])),
    });
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message });
  }
};

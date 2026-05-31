const { allowCors, sendJson, supabaseFetch, toIso, toNumber } = require("./_supabase");

function mapTransaction(transaction) {
  return {
    id: String(transaction.id || transaction.localId || ""),
    created_at: toIso(transaction.createdAt),
    customer: transaction.customer || "",
    table_number: transaction.table || "",
    shift: transaction.shift || "",
    channel: transaction.channel || "Kasir",
    status: transaction.status || "paid",
    employee: transaction.employee || "",
    payment: transaction.payment || "",
    paid: toNumber(transaction.paid),
    change: toNumber(transaction.change),
    subtotal: toNumber(transaction.subtotal),
    grand_total: toNumber(transaction.grandTotal),
    raw: transaction,
  };
}

function mapItems(transaction) {
  const transactionId = String(transaction.id || transaction.localId || "");
  return (transaction.items || []).map((item) => ({
    transaction_id: transactionId,
    menu_id: item.id || "",
    name: item.name || "",
    category: item.category || "",
    price: toNumber(item.price),
    qty: toNumber(item.qty),
  }));
}

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const transaction = req.body || {};
    const row = mapTransaction(transaction);
    if (!row.id) return sendJson(res, 400, { error: "Transaction id wajib ada." });

    await supabaseFetch("transactions?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: row,
    });

    await supabaseFetch(`transaction_items?transaction_id=eq.${encodeURIComponent(row.id)}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });

    const items = mapItems(transaction);
    if (items.length) {
      await supabaseFetch("transaction_items", {
        method: "POST",
        prefer: "return=minimal",
        body: items,
      });
    }

    return sendJson(res, 200, { success: true, id: row.id });
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message });
  }
};

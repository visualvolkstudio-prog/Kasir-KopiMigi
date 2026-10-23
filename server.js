const http = require("http");
const handler = require("./api/supabase");

const PORT = process.env.PORT || 3001;

// ─── SSE — Realtime Push ke Browser ──────────────────────────────────────────
// Saat ada order masuk/update dari device lain, server langsung push event
// ke semua browser yang sedang terhubung tanpa mereka perlu polling
const _sseClients = new Set();

function _sseBroadcast(type = "order_change") {
  if (_sseClients.size === 0) return;
  const data = `data: ${JSON.stringify({ type, at: Date.now() })}\n\n`;
  for (const res of _sseClients) {
    try { res.write(data); } catch { _sseClients.delete(res); }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // ── SSE endpoint ─────────────────────────────────────────────────────────
  if (req.url === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no", // matikan buffering Nginx untuk SSE
    });
    res.write(": connected\n\n"); // komentar awal agar browser tahu koneksi aktif
    _sseClients.add(res);
    req.on("close", () => _sseClients.delete(res));
    return;
  }

  if (req.url !== "/api/supabase") {
    res.statusCode = 404;
    res.end(JSON.stringify({ success: false, error: "Not found" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", async () => {
    try {
      req.body = body ? JSON.parse(body) : {};
    } catch {
      req.body = {};
    }

    const action = req.body?.action || "unknown";
    try {
      await handler(req, res);
      // Broadcast ke semua client setelah transaksi berhasil sync/delete
      if (["sync-transaction", "delete-transaction"].includes(action)) {
        _sseBroadcast("order_change");
      }
    } catch (error) {
      console.error(`[ERROR] action=${action}:`, error.message, error.cause?.message || "");
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`API server jalan di port ${PORT}`);
  console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL}`);
});

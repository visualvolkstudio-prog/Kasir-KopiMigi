const http = require("http");
const handler = require("./api/supabase");

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
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

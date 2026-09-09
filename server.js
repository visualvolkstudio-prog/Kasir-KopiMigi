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
  req.on("end", () => {
    try {
      req.body = body ? JSON.parse(body) : {};
    } catch {
      req.body = {};
    }
    handler(req, res);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`API server jalan di port ${PORT}`);
});

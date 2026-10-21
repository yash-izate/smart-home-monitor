
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const ESP32_URL = "http://10.210.241.104";

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript"
};

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

  // Proxy ESP32 sensor data through the same local origin.
  if (pathname === "/api/status") {
    http.get(`${ESP32_URL}/status`, (espRes) => {
      res.writeHead(espRes.statusCode || 502, {
        "Content-Type": "application/json"
      });
      espRes.pipe(res);
    }).on("error", () => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Cannot reach ESP32" }));
    });
    return;
  }

  const requestedPath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.join(__dirname, requestedPath);

  if (!filePath.startsWith(__dirname + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Dashboard: http://127.0.0.1:${PORT}`);
});

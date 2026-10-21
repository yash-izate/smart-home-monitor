const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const ESP32_IP = "10.210.241.104";
const ESP32_PORT = 80;
const REQUEST_TIMEOUT_MS = 8000;
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8"
};

function sendJson(res, statusCode, data) {
  if (res.headersSent || res.writableEnded) return;

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data));
}

function proxyToEsp32(req, res, endpoint) {
  const chunks = [];
  let finished = false;

  req.on("data", chunk => chunks.push(chunk));

  req.on("error", error => {
    console.error("Browser request error:", error.message);

    if (!finished) {
      finished = true;
      sendJson(res, 400, { error: "Could not read browser request." });
    }
  });

  req.on("end", () => {
    if (finished || res.destroyed) return;

    const body = Buffer.concat(chunks);

    const options = {
      hostname: ESP32_IP,
      port: ESP32_PORT,
      path: endpoint,
      method: req.method,
      agent: false,
      headers: {
        "Connection": "close",
        "Content-Length": body.length,
        "Content-Type":
          req.headers["content-type"] ||
          "application/x-www-form-urlencoded"
      }
    };

    const upstream = http.request(options, upstreamRes => {
      const responseChunks = [];

      upstreamRes.on("data", chunk => responseChunks.push(chunk));

      upstreamRes.on("error", error => {
        console.error("ESP32 response error:", error.message);

        if (!finished) {
          finished = true;
          sendJson(res, 502, {
            error: "Error reading the ESP32 response."
          });
        }
      });

      upstreamRes.on("end", () => {
        if (finished || res.destroyed) return;

        finished = true;

        const responseBody = Buffer.concat(responseChunks);

        res.writeHead(upstreamRes.statusCode || 502, {
          "Content-Type":
            upstreamRes.headers["content-type"] ||
            "application/json",
          "Cache-Control": "no-store"
        });

        res.end(responseBody);
      });
    });

    upstream.setTimeout(REQUEST_TIMEOUT_MS, () => {
      upstream.destroy(new Error("ESP32 request timed out"));
    });

    upstream.on("error", error => {
      console.error("ESP32 proxy error:", error.message);

      if (!finished) {
        finished = true;
        sendJson(res, 502, {
          error: error.message,
          message: "ESP32 request failed. Check its Wi-Fi connection and IP."
        });
      }
    });

    // Send a complete request body with an explicit Content-Length.
    upstream.end(body);
  });
}

const server = http.createServer((req, res) => {
  let pathname;

  try {
    pathname = new URL(
      req.url,
      `http://${req.headers.host}`
    ).pathname;
  } catch {
    res.writeHead(400);
    return res.end("Invalid request URL");
  }

  // Live sensor readings
  if (pathname === "/api/status" && req.method === "GET") {
    return proxyToEsp32(req, res, "/status");
  }

  // Sensor enable/disable settings
  if (pathname === "/api/settings" && req.method === "POST") {
    return proxyToEsp32(req, res, "/settings");
  }

  // Reject unsupported API routes
  if (pathname.startsWith("/api/")) {
    return sendJson(res, 405, {
      error: "Unsupported API endpoint or method."
    });
  }

  // Serve dashboard files
  let relativePath;

  try {
    relativePath = pathname === "/"
      ? "index.html"
      : decodeURIComponent(pathname.slice(1));
  } catch {
    res.writeHead(400);
    return res.end("Invalid file path");
  }

  const filePath = path.resolve(ROOT, relativePath);

  // Prevent access outside the dashboard folder
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      return res.end("File not found");
    }

    res.writeHead(200, {
      "Content-Type":
        MIME_TYPES[path.extname(filePath)] ||
        "application/octet-stream",
      "Cache-Control": "no-cache"
    });

    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("------------------------------------");
  console.log("Smart Home Monitor is running");
  console.log(`Dashboard: http://127.0.0.1:${PORT}`);
  console.log(`ESP32 API: http://${ESP32_IP}:${ESP32_PORT}`);
  console.log("------------------------------------");
});

server.on("error", error => {
  console.error("Local server error:", error.message);

  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the other server first.`
    );
  }
});

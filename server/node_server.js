#!/usr/bin/env node
/**
 * HTTP server with COOP/COEP so SharedArrayBuffer is available.
 * Serve from repo root: npm start  →  http://localhost:8000/
 * Do not use XAMPP/Apache for this project — those headers are required.
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const PORT = 8000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".mid": "audio/midi",
  ".midi": "audio/midi",
  ".ico": "image/x-icon",
};

function coopHeaders(mimeType, extname) {
  let noCache = extname === ".js" || extname === ".mjs" || extname === ".html";
  return {
    "Content-Type": mimeType,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": noCache
      ? "no-cache, no-store, must-revalidate"
      : "public, max-age=3600",
    Pragma: noCache ? "no-cache" : "",
    Expires: noCache ? "0" : "",
  };
}

const server = http.createServer((req, res) => {
  const [urlPath, query = ""] = (req.url || "/").split("?");
  const querySuffix = query ? "?" + query : "";

  let rel = decodeURIComponent(urlPath);
  if (rel === "/") rel = "/index.html";

  let filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (
    !rel.endsWith("/") &&
    fs.existsSync(filePath) &&
    fs.statSync(filePath).isDirectory()
  ) {
    res.writeHead(301, { Location: urlPath + "/" + querySuffix });
    res.end();
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeType = mimeTypes[extname] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("<h1>404 Not Found</h1>");
      } else {
        res.writeHead(500);
        res.end("Server Error: " + error.code);
      }
      return;
    }
    res.writeHead(200, coopHeaders(mimeType, extname));
    res.end(content);
  });
});

const startServer = (port) => {
  server.listen(port, () => {
    console.log("Server running at http://localhost:" + port + "/");
    console.log("Serving: " + ROOT);
    console.log("SharedArrayBuffer enabled (COOP + COEP)");
  });

  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.log("Port " + port + " in use, trying " + (port + 1) + "...");
      server.close();
      startServer(port + 1);
    } else {
      console.error("Server error:", e);
    }
  });
};

startServer(PORT);

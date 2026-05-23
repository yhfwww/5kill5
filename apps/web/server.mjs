import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 5173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function resolvePath(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, "http://localhost").pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;

  if (requested === "/logo.jpg") {
    return normalize(join(root, "..", "..", "logo.jpg"));
  }

  const target = normalize(join(root, requested));
  if (!target.startsWith(normalize(root))) {
    return null;
  }

  return target;
}

const server = createServer(async (request, response) => {
  const target = resolvePath(request.url || "/");
  if (!target) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(target);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(target)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`5KILL5 web console: http://127.0.0.1:${port}`);
});

import "dotenv/config";
import http from "node:http";
import https from "node:https";

const target = new URL(process.env.TARGET_URL || "https://httpbin.org");
const client = target.protocol === "https:" ? https : http;

function proxyRequest({ method = "GET", path = "/", headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const upstream = new URL(path, target);
    const {
      host,
      ["content-length"]: _,
      ["x-forwarded-proto"]: __,
      ["x-forwarded-port"]: ___,
      ...rest
    } = headers;

    const req = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        method,
        path: `${upstream.pathname}${upstream.search}`,
        headers: { ...rest, host: target.host, connection: "close" },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            statusCode: res.statusCode || 502,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function handler(event) {
  try {
    const path = `${event.rawPath || "/"}${event.rawQueryString ? `?${event.rawQueryString}` : ""}`;
    const body = event.body
      ? Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8")
      : undefined;
    const {
      statusCode,
      headers,
      body: resBody,
    } = await proxyRequest({
      method: event.requestContext?.http?.method || event.httpMethod || "GET",
      path,
      headers: event.headers || {},
      body,
    });
    return {
      statusCode,
      headers,
      body: resBody.toString("base64"),
      isBase64Encoded: true,
    };
  } catch ({ message }) {
    return {
      statusCode: 502,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Bad gateway", message }),
      isBase64Encoded: false,
    };
  }
}

if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const port = Number(process.env.PORT || 3000);
  http
    .createServer(async (req, res) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const { statusCode, headers, body } = await proxyRequest({
            method: req.method,
            path: req.url || "/",
            headers: req.headers,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          });
          res.writeHead(statusCode, headers);
          res.end(body);
        } catch ({ message }) {
          res.writeHead(502, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "Bad gateway", message }));
        }
      });
    })
    .listen(port, () => {
      console.log(`Proxy server running on http://localhost:${port}`);
      console.log(`Forwarding requests to ${target.origin}`);
    });
}

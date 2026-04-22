import ProxyChain from "proxy-chain";
import dotenv from "dotenv";
import { spawn } from "child_process";

dotenv.config();

let ngrokProcess = null;

/**
 * Start ngrok TCP tunnel
 */
const startNgrok = () => {
  return new Promise((resolve, reject) => {
    ngrokProcess = spawn("ngrok", ["tcp", "8000"]);

    ngrokProcess.stdout.on("data", (data) => {
      const out = data.toString();
      console.log("[ngrok]", out);

      // correct pattern for TCP output
      const match = out.match(/tcp:\/\/[^\s]+/);

      if (match) {
        resolve(match[0]);
      }
    });

    ngrokProcess.stderr.on("data", (data) => {
      console.error("[ngrok error]", data.toString());
    });

    ngrokProcess.on("error", reject);
  });
};

/**
 * Proxy server
 */
const server = new ProxyChain.Server({
  port: 8000,
  hostname: "0.0.0.0",

  prepareRequestFunction: ({ username, password, hostname, port }) => {
    if (username !== "user" || password !== "pass") {
      return { requestAuthentication: true };
    }

    console.log(`Proxying → ${hostname}:${port}`);

    return { requestAuthentication: false };
  },
});

/**
 * Startup order
 */
server.listen(async () => {
  console.log("🟢 Proxy running on 8000");

  try {
    const url = await startNgrok();
    console.log("🚀 Public TCP Proxy:", url);
    console.log("👉 Use in Puppeteer like:");
    console.log(`--proxy-server=http://${url.replace("tcp://", "")}`);
  } catch (err) {
    console.error("❌ ngrok failed:", err.message);
  }
});

/**
 * Cleanup
 */
process.on("SIGINT", () => {
  console.log("\nShutting down...");

  if (ngrokProcess) {
    ngrokProcess.kill();
  }

  server.close();
  process.exit(0);
});

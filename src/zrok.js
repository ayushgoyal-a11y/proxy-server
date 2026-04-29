import ProxyChain from "proxy-chain";
import { spawn } from "child_process";

let zrokProcess = null;
let publicUrl = null;

/**
 * Start zrok TCP tunnel
 */
const startZrok = () => {
  return new Promise((resolve, reject) => {
    zrokProcess = spawn("zrok", [
      "share",
      "private",
      "localhost:4000",
      "--backend-mode",
      "tcpTunnel",
    ]);

    zrokProcess.stdout.on("data", (data) => {
      const out = data.toString();
      console.log("[zrok]", out);

      // extract tcp endpoint
      const match = out.match(/tcp:\/\/[^\s]+/);

      if (match && !publicUrl) {
        publicUrl = match[0];
        resolve(publicUrl);
      }
    });

    zrokProcess.stderr.on("data", (data) => {
      console.error("[zrok error]", data.toString());
    });

    zrokProcess.on("error", (err) => {
      reject(err);
    });
  });
};

/**
 * Proxy server
 */
const server = new ProxyChain.Server({
  port: 4000,
  hostname: "0.0.0.0",

  prepareRequestFunction: ({ username, password, hostname, port }) => {
    if (username !== "user" || password !== "pass") {
      console.log("❌ Auth failed");
      return { requestAuthentication: true };
    }

    console.log(`🌐 Proxying → ${hostname}:${port}`);

    return { requestAuthentication: false };
  },
});

/**
 * Start everything
 */
server.listen(async () => {
  console.log("🟢 Proxy running on port 4000");

  try {
    const url = await startZrok();

    console.log("\n🚀 Public Proxy Ready:");
    console.log(url);

    const clean = url.replace("tcp://", "");

    console.log("\n👉 Use in Puppeteer:");
    console.log(`--proxy-server=http://${clean}`);

    console.log("\n🔐 Auth:");
    console.log("username: user");
    console.log("password: pass");
  } catch (err) {
    console.error("❌ Failed to start zrok:", err.message);
  }
});

/**
 * Cleanup
 */
process.on("SIGINT", () => {
  console.log("\nShutting down...");

  if (zrokProcess) {
    zrokProcess.kill();
  }

  server.close();
  process.exit(0);
});

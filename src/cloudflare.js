import ProxyChain from "proxy-chain";
import { spawn } from "child_process";

let tunnelProcess = null;
let tunnelUrl = null;

/**
 * Extract Cloudflare URL
 */
const extractUrl = (text) => {
  const match = text.match(/https:\/\/[^\s]+trycloudflare\.com/);
  return match ? match[0] : null;
};

/**
 * Start Cloudflare Tunnel
 */
const startTunnelService = () => {
  if (tunnelProcess) {
    console.log("⚠️ Tunnel already running:", tunnelUrl);
    return;
  }

  tunnelProcess = spawn("cloudflared", [
    "tunnel",
    "--url",
    "http://localhost:8000",
  ]);

  let responded = false;

  const handleOutput = (data) => {
    const output = data.toString();
    console.log("[cloudflared]", output);

    const url = extractUrl(output);

    if (url && !tunnelUrl) {
      tunnelUrl = url;

      if (!responded) {
        responded = true;
        console.log("🌍 Tunnel started:", tunnelUrl);
      }
    }
  };

  tunnelProcess.stdout.on("data", handleOutput);
  tunnelProcess.stderr.on("data", handleOutput);

  tunnelProcess.on("close", () => {
    console.log("❌ Tunnel stopped");
    tunnelProcess = null;
    tunnelUrl = null;
  });

  tunnelProcess.on("error", (err) => {
    console.error("❌ Tunnel error:", err.message);
  });

  // fallback log
  setTimeout(() => {
    if (!responded) {
      console.log("⏳ Tunnel starting...");
    }
  }, 5000);
};

/**
 * Proxy Server
 */
const server = new ProxyChain.Server({
  port: 8000,
  hostname: "0.0.0.0",

  prepareRequestFunction: ({ username, password, hostname, port }) => {
    console.log({ username, password, hostname, port });

    // if (username !== "user" || password !== "pass") {
    //   console.log("❌ Authentication failed");
    //   return { requestAuthentication: true };
    // }

    console.log(`🌐 Proxying → ${hostname}:${port}`);

    return {
      requestAuthentication: false,
    };
  },
});

/**
 * Handle server errors
 */
server.on("error", (error) => {
  console.error("❌ Proxy error:", error);
});

/**
 * Start server + tunnel
 */
server.listen(() => {
  console.log(`🟢 Proxy running on port ${server.port}`);
  startTunnelService();
});

/**
 * Cleanup
 */
process.on("SIGINT", () => {
  console.log("\nShutting down...");

  if (tunnelProcess) {
    tunnelProcess.kill();
  }

  server.close();
  process.exit(0);
});

// https://thumbs-pieces-four-brochures.trycloudflare.com

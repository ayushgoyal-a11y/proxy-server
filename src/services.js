import { spawn } from "child_process";

let tunnelProcess = null;
let tunnelUrl = null;

// Helper to extract URL
const extractUrl = (text) => {
  const match = text.match(/https:\/\/[^\s]+trycloudflare\.com/);
  return match ? match[0] : null;
};

export const startTunnelService = (req, res)=>{
  if (tunnelProcess) {
    return res.json({
      message: "Tunnel already running",
      url: tunnelUrl,
    });
  }

  tunnelProcess = spawn("cloudflared", [
    "tunnel",
    "--url",
    "http://localhost:3000",
  ]);

  let responded = false;

  const handleOutput = (data) => {
    const output = data.toString();
    console.log(output);

    const url = extractUrl(output);

    if (url && !tunnelUrl) {
      tunnelUrl = url;

      if (!responded) {
        responded = true;
        res.json({
          message: "Tunnel started",
          url: tunnelUrl,
        });
      }
    }
  };

  // IMPORTANT: listen to both
  tunnelProcess.stdout.on("data", handleOutput);
  tunnelProcess.stderr.on("data", handleOutput);

  tunnelProcess.on("close", () => {
    console.log("Tunnel stopped");
    tunnelProcess = null;
    tunnelUrl = null;
  });

  // fallback (if URL takes too long)
  setTimeout(() => {
    if (!responded) {
      responded = true;
      res.json({
        message: "Tunnel starting...",
        url: tunnelUrl,
      });
    }
  }, 5000);
}

export const stopTunnelService = (req, res) => {
  if (tunnelProcess) {
    tunnelProcess.kill();
    tunnelProcess = null;
    tunnelUrl = null;
    return res.json({ message: "Tunnel stopped" });
  }

  res.json({ message: "No tunnel running" });
};

export const getTunnelUrl = (req, res) => {
  res.json({ url: tunnelUrl });
}
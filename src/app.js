import express from "express";
import { getTunnelUrl, startTunnelService, stopTunnelService } from "./services.js";

const PORT = process.env.PORT || 3000;

const app = express();

app.use(express.json());

// Start tunnel
app.get("/start-tunnel", (req, res) => startTunnelService(req, res));

app.get("/tunnel-url", (req, res) => getTunnelUrl(req, res));

app.get("/stop/tunnel", (req, res) => stopTunnelService(req, res));

app.get("/", (req, res) => {
  res.send("Hello, Express Server!");
});

app.get("/api", (req, res) => {
  res.json({ message: "This is an API route" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

const http = require("http");
const express = require("express");

const EXTENSION_NAME = "express-extension";
const LAMBDA_RUNTIME_API = process.env.AWS_LAMBDA_RUNTIME_API;

// Register extension
async function register() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: LAMBDA_RUNTIME_API.split(":")[0],
      port: LAMBDA_RUNTIME_API.split(":")[1],
      path: "/2020-01-01/extension/register",
      method: "POST",
      headers: {
        "Lambda-Extension-Name": EXTENSION_NAME,
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const extensionId = res.headers["lambda-extension-identifier"];
        console.log("Registered extension:", extensionId);
        resolve(extensionId);
      });
    });

    req.on("error", reject);

    req.write(
      JSON.stringify({
        events: ["INVOKE", "SHUTDOWN"],
      }),
    );

    req.end();
  });
}

// Event loop
async function next(extensionId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: LAMBDA_RUNTIME_API.split(":")[0],
      port: LAMBDA_RUNTIME_API.split(":")[1],
      path: "/2020-01-01/extension/event/next",
      method: "GET",
      headers: {
        "Lambda-Extension-Identifier": extensionId,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data)));
    });

    req.on("error", reject);
    req.end();
  });
}

// Express server
function startServer() {
  const app = express();

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const port = 3000;
  app.listen(port, () => {
    console.log(`Extension server running on port ${port}`);
  });
}

// Main
(async () => {
  const extensionId = await register();

  startServer();

  while (true) {
    const event = await next(extensionId);
    console.log("Received event:", event.eventType);

    if (event.eventType === "SHUTDOWN") {
      console.log("Shutting down extension");
      process.exit(0);
    }
  }
})();

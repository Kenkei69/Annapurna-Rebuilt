import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const SCREENSHOTS_DIR = "/home/runner/workspace/Annapurna-Rebuilt/docs/screenshots";
const convId = process.env.ANTIGRAVITY_CONVERSATION_ID || "5e140e3e-7557-442a-9933-c19d7de93619";
const ARTIFACT_DIR = `/home/runner/.gemini/antigravity-cli/brain/${convId}/screenshots`;

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

async function main() {
  console.log("📸 Starting Automated Screenshot Capture via CDP...");

    // 1. Obtain operator session cookie
    const loginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "operator@transcold.com",
        password: "Operator123!",
      }),
    });

    const setCookieHeader = loginRes.headers.get("set-cookie") || "";
    const cookieMatch = setCookieHeader.match(/annapurna_session=([^;]+)/);
    const cookieValue = cookieMatch ? cookieMatch[1] : "";
    console.log("🔑 Operator session cookie obtained:", cookieValue ? "Valid" : "Missing");

    // Obtain partner session cookie
    const partnerLoginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "director@sahyadricold.com",
        password: "Partner123!",
      }),
    });
    const partnerCookieHeader = partnerLoginRes.headers.get("set-cookie") || "";
    const partnerCookieMatch = partnerCookieHeader.match(/annapurna_session=([^;]+)/);
    const partnerCookieValue = partnerCookieMatch ? partnerCookieMatch[1] : "";
    console.log("🔑 Partner session cookie obtained:", partnerCookieValue ? "Valid" : "Missing");

  // 2. Launch headless Chromium with remote debugging
  const chrome = spawn("/repl/tools/bin/chromium", [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-port=9222",
    "--window-size=1440,900",
  ]);

  await new Promise((r) => setTimeout(r, 1200));

  try {
    const versionRes = await fetch("http://localhost:9222/json/version");
    const versionData = await versionRes.json();
    const wsUrl = versionData.webSocketDebuggerUrl;

    console.log("🌐 Connected to Chrome via CDP:", wsUrl);

    const ws = new WebSocket(wsUrl);

    let id = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise((r) => (ws.onopen = r));

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        pending.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    // Create target page
    const target = await send("Target.createTarget", { url: "about:blank" });
    const pageWsUrl = `ws://localhost:9222/devtools/page/${target.targetId}`;
    const pageWs = new WebSocket(pageWsUrl);

    await new Promise((r) => (pageWs.onopen = r));

    let pageMsgId = 1;
    const pagePending = new Map();
    pageWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pagePending.has(msg.id)) {
        const { resolve, reject } = pagePending.get(msg.id);
        pagePending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    function pageSend(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = pageMsgId++;
        pagePending.set(msgId, { resolve, reject });
        pageWs.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await pageSend("Page.enable");
    await pageSend("Network.enable");

    // Set auth cookie
    if (cookieValue) {
      await pageSend("Network.setCookie", {
        name: "annapurna_session",
        value: cookieValue,
        domain: "localhost",
        path: "/",
        httpOnly: true,
      });
    }

    const pages = [
      { name: "landing-desktop", url: "http://localhost:3000/", width: 1440, height: 900 },
      { name: "landing-mobile", url: "http://localhost:3000/", width: 375, height: 812 },
      { name: "login-desktop", url: "http://localhost:3000/login", width: 1440, height: 900 },
      { name: "dashboard-desktop", url: "http://localhost:3000/dashboard", width: 1440, height: 900 },
      { name: "dashboard-mobile", url: "http://localhost:3000/dashboard", width: 375, height: 812 },
      { name: "shipments-desktop", url: "http://localhost:3000/shipments", width: 1440, height: 900 },
      { name: "alerts-desktop", url: "http://localhost:3000/alerts", width: 1440, height: 900 },
      { name: "rescue-desktop", url: "http://localhost:3000/rescue", width: 1440, height: 900 },
      { name: "rescue-partner-desktop", url: "http://localhost:3000/rescue", width: 1440, height: 900, cookie: partnerCookieValue },
      { name: "simulator-desktop", url: "http://localhost:3000/simulator", width: 1440, height: 900 },
      { name: "audit-desktop", url: "http://localhost:3000/audit", width: 1440, height: 900 },
    ];

    for (const p of pages) {
      console.log(`📸 Capturing ${p.name} (${p.width}x${p.height})...`);
      if (p.cookie) {
        await pageSend("Network.setCookie", {
          name: "annapurna_session",
          value: p.cookie,
          domain: "localhost",
          path: "/",
          httpOnly: true,
        });
      } else if (cookieValue) {
        await pageSend("Network.setCookie", {
          name: "annapurna_session",
          value: cookieValue,
          domain: "localhost",
          path: "/",
          httpOnly: true,
        });
      }

      await pageSend("Emulation.setDeviceMetricsOverride", {
        width: p.width,
        height: p.height,
        deviceScaleFactor: 1,
        mobile: p.width < 768,
      });

      await pageSend("Page.navigate", { url: p.url });
      await new Promise((r) => setTimeout(r, 1200));

      const screenshot = await pageSend("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshot.data, "base64");

      const repoPath = path.join(SCREENSHOTS_DIR, `${p.name}.png`);
      const artifactPath = path.join(ARTIFACT_DIR, `${p.name}.png`);

      fs.writeFileSync(repoPath, buffer);
      fs.writeFileSync(artifactPath, buffer);
      console.log(`  ✓ Saved: ${p.name}.png (${buffer.length} bytes)`);
    }

    pageWs.close();
    ws.close();
    console.log("✅ All screenshots captured successfully!");
  } finally {
    chrome.kill();
  }
}

main().catch((err) => {
  console.error("❌ Screenshot capture failed:", err);
  process.exit(1);
});

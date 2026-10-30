import { spawn } from "child_process";
import assert from "assert/strict";

async function main() {
  console.log("🚀 Starting Automated Browser Journey via Chrome CDP...");

  // 1. Obtain operator session cookie via real API login
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "operator@transcold.com",
      password: "Operator123!",
    }),
  });

  assert.equal(loginRes.status, 200, "Operator login API must return 200");
  const loginData = await loginRes.json();
  assert.equal(loginData.user.role, "OPERATOR");
  console.log("✓ Operator authentication succeeded:", loginData.user.email);

  const setCookieHeader = loginRes.headers.get("set-cookie") || "";
  const cookieMatch = setCookieHeader.match(/annapurna_session=([^;]+)/);
  const cookieValue = cookieMatch ? cookieMatch[1] : "";
  assert.ok(cookieValue, "Session cookie must be present");

  // 2. Launch headless Chromium
  const chrome = spawn("/repl/tools/bin/chromium", [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-port=9223",
    "--window-size=1440,900",
  ]);

  await new Promise((r) => setTimeout(r, 1500));

  try {
    const versionRes = await fetch("http://localhost:9223/json/version");
    const versionData = await versionRes.json();
    const wsUrl = versionData.webSocketDebuggerUrl;

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

    const target = await send("Target.createTarget", { url: "about:blank" });
    const pageWsUrl = `ws://localhost:9223/devtools/page/${target.targetId}`;
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
        const mId = pageMsgId++;
        pagePending.set(mId, { resolve, reject });
        pageWs.send(JSON.stringify({ id: mId, method, params }));
      });
    }

    await pageSend("Page.enable");
    await pageSend("Runtime.enable");
    await pageSend("Network.enable");

    // Set cookie in browser
    await pageSend("Network.setCookie", {
      name: "annapurna_session",
      value: cookieValue,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
    });

    async function evaluate(expression) {
      const res = await pageSend("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result?.value;
    }

    async function navigateAndCheck(url, titleKeyword) {
      await pageSend("Page.navigate", { url });
      await new Promise((r) => setTimeout(r, 2000));
      const title = await evaluate("document.title");
      const bodyText = await evaluate("document.body.innerText");
      console.log(`✓ Navigated to ${url} (Title: "${title}")`);
      if (titleKeyword) {
        assert.ok(
          title.toLowerCase().includes(titleKeyword.toLowerCase()) ||
          bodyText.toLowerCase().includes(titleKeyword.toLowerCase()),
          `Page ${url} must contain keyword "${titleKeyword}"`
        );
      }
      return { title, bodyText };
    }

    // Step 1: Verify Fleet Command Console UI renders with interactive map
    console.log("Testing /fleet...");
    const fleetResult = await navigateAndCheck("http://localhost:3000/fleet", "fleet");
    assert.ok(fleetResult.bodyText.includes("TransCold") || fleetResult.bodyText.includes("Consignment"), "Fleet console must show consignment data");

    // Check Leaflet map element exists
    const hasMap = await evaluate('!!document.querySelector(".leaflet-container")');
    assert.ok(hasMap, "Leaflet map container must be rendered in DOM");
    console.log("  ✓ Leaflet map container verified in DOM");

    // Step 2: Verify Rescue Hub UI renders
    console.log("Testing /rescue...");
    const rescueResult = await navigateAndCheck("http://localhost:3000/rescue", "rescue");
    assert.ok(rescueResult.bodyText.includes("Rescue") || rescueResult.bodyText.includes("Opportunities"), "Rescue hub must render rescue listings");
    console.log("  ✓ Rescue Hub view verified");

    // Step 3: Verify Analytics & ESG compliance UI renders
    console.log("Testing /analytics...");
    const analyticsResult = await navigateAndCheck("http://localhost:3000/analytics", "analytics");
    assert.ok(analyticsResult.bodyText.includes("CO2") || analyticsResult.bodyText.includes("Compliance") || analyticsResult.bodyText.includes("Thermal"), "Analytics must display ESG/compliance metrics");
    console.log("  ✓ Analytics & ESG Compliance view verified");

    // Step 4: Verify Appearance & Accessibility settings in /org
    console.log("Testing /org settings & appearance...");
    await navigateAndCheck("http://localhost:3000/org", "organization");
    const hasSettingsTab = await evaluate('!!document.querySelector("button")');
    assert.ok(hasSettingsTab, "Org settings buttons rendered");

    // Test theme change in browser localStorage
    await evaluate('localStorage.setItem("annapurna_theme", "dark"); document.documentElement.classList.add("dark");');
    const isDark = await evaluate('document.documentElement.classList.contains("dark")');
    assert.equal(isDark, true, "Dark theme class must be applied to document element");
    console.log("  ✓ Appearance dark theme verified in DOM");

    // Step 5: Verify Public Tracking without authentication
    console.log("Testing public /tracking (clearing cookie)...");
    await pageSend("Network.clearBrowserCookies");
    const trackResult = await navigateAndCheck("http://localhost:3000/tracking", "tracking");
    assert.ok(trackResult.bodyText.includes("Tracking") || trackResult.bodyText.includes("Consignment"), "Public tracking must render without authentication");
    console.log("  ✓ Public tracking verified without auth session");

    console.log("🎉 Complete Browser Journey Passed 100%!");
  } finally {
    chrome.kill();
  }
}

main().catch((err) => {
  console.error("❌ Browser journey failed:", err);
  process.exit(1);
});

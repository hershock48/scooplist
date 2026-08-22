import { createRequire } from "module";
import fs from "node:fs";
const require = createRequire("C:/Users/hersh/Glazedweb/truenorth/tools/_.js");
const { chromium } = require("playwright-core");

const mark = fs.readFileSync("C:/Users/hersh/Glazedweb/scooplist/src/app/icon.svg", "utf8");
const out = "C:/Users/hersh/Glazedweb/scooplist/public/og.png";

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#FDFBF7;display:flex;flex-direction:column;
       align-items:center;justify-content:center;font-family:Fraunces,Georgia,serif}
  .mark{width:290px;height:290px;margin-bottom:6px}
  h1{font-size:96px;font-weight:700;color:#B93A60;letter-spacing:-2px;line-height:1}
  p{font-size:34px;font-weight:600;color:#221D27;margin-top:14px}
</style></head>
<body>
  <div class="mark">${mark.replace('viewBox="0 0 64 64"', 'viewBox="0 0 64 64" width="290" height="290"')}</div>
  <h1>Scooplist</h1>
  <p>Flavor boards that taste like the truth.</p>
</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
await browser.close();
console.log("wrote", out, fs.statSync(out).size, "bytes");

const express = require("express");
const { chromium } = require("playwright"); // ✅ use Playwright instead of Puppeteer

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/spotifydl", async (req, res) => {
  const spotifyUrl = req.query.url;
  if (!spotifyUrl)
    return res.status(400).json({ error: "Missing ?url= parameter" });

  let browser;
  try {
    console.log("🚀 Launching Playwright Chromium...");
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto("https://spotimate.io", {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    await page.fill('input[name="url"]', spotifyUrl);
    await Promise.all([
      page.click('button[type="submit"], button'),
      page.waitForLoadState("networkidle"),
    ]);

    const data = await page.evaluate(() => {
      try {
        const pre = document.querySelector("pre");
        if (pre) return JSON.parse(pre.textContent);
        const match = document.body.innerText.match(/\{.*"mp3DownloadLink".*\}/s);
        if (match) return JSON.parse(match[0]);
      } catch (e) {}
      return null;
    });

    await browser.close();

    if (!data)
      return res.status(500).json({ error: "Failed to extract song info" });

    res.json({
      songTitle: data.songTitle || "Unknown",
      artist: data.artist || "Unknown",
      coverImage: data.coverImage || null,
      mp3DownloadLink: data.mp3DownloadLink || null,
    });
  } catch (err) {
    console.error("❌ Error:", err);
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Spotify Downloader API (Playwright) is running!");
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

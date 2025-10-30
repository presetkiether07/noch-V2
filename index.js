const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

async function getChromePath() {
  // Find the correct Chrome binary from Puppeteer's cache
  const baseDir = "/opt/render/.cache/puppeteer/chrome";
  try {
    const dirs = fs.readdirSync(baseDir);
    if (dirs.length > 0) {
      const latest = dirs.sort().reverse()[0]; // newest version
      return `${baseDir}/${latest}/chrome-linux64/chrome`;
    }
  } catch (err) {
    console.warn("⚠️ Could not find Chrome in cache:", err.message);
  }
  return null;
}

app.get("/api/spotifydl", async (req, res) => {
  const spotifyUrl = req.query.url;
  if (!spotifyUrl) return res.status(400).json({ error: "Missing ?url= parameter" });

  let executablePath = await getChromePath();

  try {
    console.log("🚀 Launching browser with:", executablePath);

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
      ],
    });

    const page = await browser.newPage();

    await page.goto("https://spotimate.io", { waitUntil: "networkidle2", timeout: 60000 });

    await page.waitForSelector('input[name="url"]', { timeout: 20000 });
    await page.type('input[name="url"]', spotifyUrl, { delay: 20 });

    await Promise.all([
      page.click('button[type="submit"], button'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }),
    ]);

    const data = await page.evaluate(() => {
      try {
        const pre = document.querySelector("pre");
        if (pre) return JSON.parse(pre.textContent);
        const match = document.body.innerText.match(/\{.*"mp3DownloadLink".*\}/s);
        if (match) return JSON.parse(match[0]);
      } catch {}
      return null;
    });

    await browser.close();

    if (!data) return res.status(500).json({ error: "Failed to extract song info" });

    res.json({
      songTitle: data.songTitle || "Unknown",
      artist: data.artist || "Unknown",
      coverImage: data.coverImage || null,
      mp3DownloadLink: data.mp3DownloadLink || null,
    });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", async (req, res) => {
  const path = await getChromePath();
  res.send(`✅ Spotify Downloader API is running!<br>Chrome path: ${path || "Not found"}`);
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

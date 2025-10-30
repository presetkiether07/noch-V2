const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

// 🧠 Warm-up Puppeteer once on startup to reduce first-call delay
let warmBrowser = null;
(async () => {
  try {
    console.log("🚀 Launching warm-up browser...");
    warmBrowser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ],
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        (await puppeteer.executablePath())
    });
    console.log("✅ Warm-up browser ready!");
  } catch (err) {
    console.warn("⚠️ Warm-up skipped:", err.message);
  }
})();

// 🧩 Spotify downloader endpoint
app.get("/api/spotifydl", async (req, res) => {
  const spotifyUrl = req.query.url;
  if (!spotifyUrl) {
    return res.status(400).json({ error: "Missing ?url= parameter" });
  }

  let browser = null;
  try {
    // Reuse warm browser if ready
    browser =
      warmBrowser && (await warmBrowser.createIncognitoBrowserContext())
        ? warmBrowser
        : await puppeteer.launch({
            headless: true,
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-gpu"
            ],
            executablePath:
              process.env.PUPPETEER_EXECUTABLE_PATH ||
              (await puppeteer.executablePath())
          });

    const page = await browser.newPage();

    console.log(`🎵 Fetching from Spotimate: ${spotifyUrl}`);
    await page.goto("https://spotimate.io", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // Wait for input & type the Spotify link
    await page.waitForSelector('input[name="url"]', { timeout: 20000 });
    await page.type('input[name="url"]', spotifyUrl, { delay: 20 });

    // Click submit & wait for result
    await Promise.all([
      page.click('button[type="submit"], button'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 })
    ]);

    // Extract JSON response from the page
    const data = await page.evaluate(() => {
      try {
        const pre = document.querySelector("pre");
        if (pre) return JSON.parse(pre.textContent);

        const match = document.body.innerText.match(/\{.*"mp3DownloadLink".*\}/s);
        if (match) return JSON.parse(match[0]);
      } catch (e) {
        return null;
      }
      return null;
    });

    if (!data) {
      return res.status(500).json({ error: "Failed to extract song info from Spotimate" });
    }

    res.json({
      songTitle: data.songTitle || "Unknown",
      artist: data.artist || "Unknown",
      coverImage: data.coverImage || null,
      mp3DownloadLink: data.mp3DownloadLink || null
    });

    await page.close();
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    // Do not close warm browser, reuse it
    if (browser && browser !== warmBrowser) {
      await browser.close().catch(() => {});
    }
  }
});

// 🧠 Root route (for UptimeRobot or Render health check)
app.get("/", (req, res) => {
  res.send(`
    <h2>✅ Spotify Downloader API is running!</h2>
    <p>Use endpoint: <code>/api/spotifydl?url=SPOTIFY_TRACK_URL</code></p>
  `);
});

// 🟢 Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

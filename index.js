const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/spotifydl", async (req, res) => {
  const spotifyUrl = req.query.url;
  if (!spotifyUrl) {
    return res.status(400).json({ error: "Missing ?url= parameter" });
  }

  try {
    // ✅ Smart Chrome path detection
    const execPath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      "/usr/bin/google-chrome" ||
      "/usr/bin/google-chrome-stable";

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process"
      ],
      executablePath: execPath
    });

    const page = await browser.newPage();

    // ✅ Load Spotimate
    await page.goto("https://spotimate.io", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // ✅ Type the Spotify URL
    await page.waitForSelector('input[name="url"]', { timeout: 20000 });
    await page.type('input[name="url"]', spotifyUrl, { delay: 20 });

    // ✅ Click submit
    await Promise.all([
      page.click('button[type="submit"], button'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 })
    ]);

    // ✅ Extract JSON response
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

    await browser.close();

    if (!data) {
      return res.status(500).json({ error: "Failed to extract song info from Spotimate" });
    }

    res.json({
      songTitle: data.songTitle || "Unknown",
      artist: data.artist || "Unknown",
      coverImage: data.coverImage || null,
      mp3DownloadLink: data.mp3DownloadLink || null
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Keep Render alive
app.get("/", (req, res) => {
  res.send("✅ Spotify Downloader API is running!");
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

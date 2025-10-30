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
    // Detect proper executable path for Chrome
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
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || (await puppeteer.executablePath())
    });

    const page = await browser.newPage();

    await page.goto("https://spotimate.io", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Wait for input then type Spotify URL
    await page.waitForSelector('input[name="url"]', { timeout: 20000 });
    await page.type('input[name="url"]', spotifyUrl, { delay: 20 });

    // Click submit and wait for the download button or JSON data
    await Promise.all([
      page.click('button[type="submit"], button'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }),
    ]);

    // Extract data from the page
    const data = await page.evaluate(() => {
      try {
        const pre = document.querySelector("pre");
        if (pre) return JSON.parse(pre.textContent);

        // Look for text that includes mp3DownloadLink
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
      mp3DownloadLink: data.mp3DownloadLink || null,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Basic root route
app.get("/", (req, res) => {
  res.send("✅ Spotify Downloader API is running!");
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

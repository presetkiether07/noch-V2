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
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.goto("https://spotimate.io", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // wait for input and type Spotify URL
    await page.waitForSelector('input[name="url"]', { timeout: 20000 });
    await page.type('input[name="url"]', spotifyUrl, { delay: 20 });

    // click submit and wait for result
    await Promise.all([
      page.click('button[type="submit"], button'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }),
    ]);

    // extract JSON from the page (Spotimate embeds it in a <pre> or script)
    const data = await page.evaluate(() => {
      try {
        const pre = document.querySelector("pre");
        if (pre) return JSON.parse(pre.textContent);
        const text = document.body.innerText.match(/\{.*"mp3DownloadLink".*\}/s);
        if (text) return JSON.parse(text[0]);
      } catch (e) {}
      return null;
    });

    await browser.close();

    if (!data) {
      return res.status(500).json({ error: "Failed to fetch song info" });
    }

    res.json({
      songTitle: data.songTitle,
      artist: data.artist,
      coverImage: data.coverImage,
      mp3DownloadLink: data.mp3DownloadLink,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

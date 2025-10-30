const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const ytdl = require("ytdl-core");
const ytSearch = require("yt-search");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const { getPreview } = require("spotify-url-info"); // <-- fixed

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.json());

const DOWNLOADS_DIR = path.resolve(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR);
app.use("/downloads", express.static(DOWNLOADS_DIR));

// ... rest of your code unchanged


app.get("/download", async (req, res) => {
  const spotifyUrl = req.query.url;
  if (!spotifyUrl) return res.status(400).json({ error: "Missing url query parameter" });

  try {
    // 1️⃣ Get Spotify track info
    const trackInfo = await getPreview(spotifyUrl);
    if (!trackInfo || !trackInfo.name || !trackInfo.artists) {
      return res.status(500).json({ success: false, error: "Failed to fetch Spotify track info" });
    }

    const query = `${trackInfo.artists[0].name} - ${trackInfo.name} audio`;

    // 2️⃣ Search YouTube
    const searchResult = await ytSearch(query);
    if (!searchResult || !searchResult.videos || searchResult.videos.length === 0) {
      return res.status(404).json({ success: false, error: "No YouTube result found" });
    }

    const videoUrl = searchResult.videos[0].url;
    const safeFileName = `${trackInfo.artists[0].name} - ${trackInfo.name}.mp3`.replace(/[\/\\?%*:|"<>]/g, '-');
    const filePath = path.join(DOWNLOADS_DIR, safeFileName);

    // 3️⃣ Download & convert to MP3
    const stream = ytdl(videoUrl, { quality: "highestaudio" });
    ffmpeg(stream)
      .audioBitrate(128)
      .save(filePath)
      .on("end", () => {
        const downloadUrl = `${req.protocol}://${req.get("host")}/downloads/${encodeURIComponent(safeFileName)}`;
        res.json({ success: true, filename: safeFileName, downloadUrl });
      })
      .on("error", (err) => {
        console.error(err);
        res.status(500).json({ success: false, error: err.message || err.toString() });
      });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message || err.toString() });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Spotify → MP3 API running on http://localhost:${PORT}`));

const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch"); // npm install node-fetch@2

const app = express();
app.use(cors());
app.use(express.json());

const DOWNLOADS_DIR = path.resolve(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR);

// Serve downloaded MP3s
app.use("/downloads", express.static(DOWNLOADS_DIR));

async function getSpotifyTrackInfo(spotifyUrl) {
  // Extract Spotify track ID
  const match = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
  if (!match) throw new Error("Invalid Spotify track URL");

  const trackId = match[1];
  const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: {
      "Authorization": `Bearer ${process.env.SPOTIFY_TOKEN}` // Create a Spotify API token
    }
  });

  if (!res.ok) throw new Error("Failed to fetch Spotify track info");
  const data = await res.json();

  return {
    title: data.name,
    artist: data.artists.map(a => a.name).join(", ")
  };
}

// GET endpoint: /spotifydl?url=<spotify-url>
app.get("/spotifydl", async (req, res) => {
  const spotifyUrl = req.query.url;
  if (!spotifyUrl) return res.status(400).json({ error: "Missing url query parameter" });

  try {
    const { title, artist } = await getSpotifyTrackInfo(spotifyUrl);
    const searchQuery = `${artist} - ${title}`;

    const outputTemplate = path.join(DOWNLOADS_DIR, "%(title)s.%(ext)s");

    const cmd = spawn("yt-dlp", [
      `ytsearch1:${searchQuery}`,
      "-x",
      "--audio-format", "mp3",
      "-o", outputTemplate
    ]);

    let stdout = "", stderr = "";

    cmd.stdout.on("data", d => { stdout += d.toString(); });
    cmd.stderr.on("data", d => { stderr += d.toString(); });

    cmd.on("close", code => {
      if (code !== 0) {
        return res.status(500).json({ success: false, error: "yt-dlp failed", code, stderr });
      }

      // Find the downloaded file
      const downloadedFiles = fs.readdirSync(DOWNLOADS_DIR)
        .filter(f => f.toLowerCase().endsWith(".mp3"))
        .sort((a,b) => fs.statSync(path.join(DOWNLOADS_DIR,b)).mtimeMs - fs.statSync(path.join(DOWNLOADS_DIR,a)).mtimeMs);

      const filename = downloadedFiles[0];
      const downloadUrl = `${req.protocol}://${req.get("host")}/downloads/${encodeURIComponent(filename)}`;

      res.json({
        success: true,
        title,
        artist,
        downloadUrl
      });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SpotifyDL REST API running on http://localhost:${PORT}`));

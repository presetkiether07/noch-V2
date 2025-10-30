const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const SpotifyWebApi = require("spotify-web-api-node");
const ytDlp = require("yt-dlp-exec");

const app = express();
app.use(cors());
app.use(express.json());

const DOWNLOADS_DIR = path.resolve(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR);

// Serve downloaded MP3s
app.use("/downloads", express.static(DOWNLOADS_DIR));

// Spotify API credentials
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

// Refresh Spotify token
async function refreshToken() {
  const data = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(data.body['access_token']);
}
refreshToken();
setInterval(refreshToken, 1000 * 60 * 50); // refresh every 50 mins

// Endpoint: /spotifydl?url=<spotify-track-url>
app.get("/spotifydl", async (req, res) => {
  const spotifyUrl = req.query.url;
  if (!spotifyUrl) return res.status(400).json({ success: false, error: "Missing url query parameter" });

  try {
    // Extract Spotify track ID
    const match = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
    if (!match) return res.status(400).json({ success: false, error: "Invalid Spotify track URL" });
    const trackId = match[1];

    // Get track info from Spotify
    const trackData = await spotifyApi.getTrack(trackId);
    const title = trackData.body.name;
    const artist = trackData.body.artists.map(a => a.name).join(", ");
    const query = `${artist} - ${title} audio`;

    // Search and download from YouTube using yt-dlp
    const fileName = `${artist} - ${title}.mp3`.replace(/[\/\\?%*:|"<>]/g, '-');
    const filePath = path.join(DOWNLOADS_DIR, fileName);

    await ytDlp(`ytsearch1:${query}`, {
      extractAudio: true,
      audioFormat: "mp3",
      output: filePath
    });

    // Return JSON with download link
    const downloadUrl = `${req.protocol}://${req.get("host")}/downloads/${encodeURIComponent(fileName)}`;
    res.json({
      success: true,
      title,
      artist,
      downloadUrl
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message || err.toString() });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SpotifyDL API running at http://localhost:${PORT}`));

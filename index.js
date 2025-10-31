require("dotenv").config();
const express = require("express");
const ytdl = require("ytdl-core");
const { YTMusic } = require("ytmusic-api");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const ytmusic = new YTMusic();

// Placeholder Spotify metadata
async function getSpotifyTrackInfo(trackId) {
  return {
    title: trackId, 
    artist: "Unknown Artist"
  };
}

function parseSpotifyUrl(url) {
  const regex = /track\/([a-zA-Z0-9]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

app.get("/api/spotifydl", async (req, res) => {
  const spotifyUrl = req.query.url;
  if (!spotifyUrl) return res.status(400).json({ error: "Missing url parameter" });

  try {
    const trackId = parseSpotifyUrl(spotifyUrl);
    if (!trackId) return res.status(400).json({ error: "Invalid Spotify URL" });

    const trackInfo = await getSpotifyTrackInfo(trackId);
    const searchQuery = `${trackInfo.title} ${trackInfo.artist}`;

    // Search YouTube Music
    const results = await ytmusic.search(searchQuery, "songs");
    if (!results || !results[0]) return res.status(404).json({ error: "Track not found on YouTube Music" });

    const topSong = results[0];
    const videoUrl = `https://www.youtube.com/watch?v=${topSong.videoId}`;

    // Get audio link
    const info = await ytdl.getInfo(videoUrl);
    const format = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });
    if (!format || !format.url) return res.status(500).json({ error: "Failed to get audio link" });

    res.json({
      title: topSong.title,
      image: topSong.thumbnails[0].url,
      duration: topSong.duration,
      downloadLink: format.url
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

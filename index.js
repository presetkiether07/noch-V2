const express = require("express");
const ytsr = require("ytsr");
const ytdl = require("ytdl-core");
const app = express();
const PORT = process.env.PORT || 3000;

// Simple Spotify URL parser
function parseSpotifyUrl(url) {
  // Example: https://open.spotify.com/track/TRACK_ID
  const regex = /track\/([a-zA-Z0-9]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Fake Spotify metadata fetch (or use spotipy / any Spotify API)
async function getSpotifyTrackInfo(trackId) {
  // For demo purposes, we just return trackId as title
  // Ideally, integrate Spotify Web API here
  return {
    title: trackId, // later replace with real track title
    artist: "Unknown Artist",
  };
}

// Endpoint
app.get("/api/spotifydl", async (req, res) => {
  const spotifyUrl = req.query.url;
  if (!spotifyUrl) return res.status(400).json({ error: "Missing url parameter" });

  try {
    const trackId = parseSpotifyUrl(spotifyUrl);
    if (!trackId) return res.status(400).json({ error: "Invalid Spotify URL" });

    const trackInfo = await getSpotifyTrackInfo(trackId);
    const searchQuery = `${trackInfo.title} ${trackInfo.artist}`;

    // Search YouTube
    const searchResults = await ytsr(searchQuery, { limit: 5 });
    const video = searchResults.items.find((i) => i.type === "video");
    if (!video) return res.status(404).json({ error: "Track not found on YouTube" });

    // Get YouTube audio download link
    const info = await ytdl.getInfo(video.url);
    const format = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });
    if (!format || !format.url) return res.status(500).json({ error: "Failed to get download link" });

    res.json({
      title: video.title,
      image: video.thumbnails[0].url,
      duration: video.duration,
      downloadLink: format.url,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

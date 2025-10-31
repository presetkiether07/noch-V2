require("dotenv").config();
const express = require("express");
const ytsr = require("ytsr");
const ytdl = require("ytdl-core");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Parse Spotify track ID
function parseSpotifyUrl(url) {
  const regex = /track\/([a-zA-Z0-9]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Placeholder Spotify metadata fetch
async function getSpotifyTrackInfo(trackId) {
  // TODO: Integrate Spotify Web API for real metadata
  // For now, use trackId as title for demo
  return {
    title: trackId,
    artist: "Unknown Artist",
  };
}

// Endpoint
app.get("/api/spotifydl", async (req, res) => {
  const spotifyUrl = req.query.url;
  if (!spotifyUrl)
    return res.status(400).json({ error: "Missing url parameter" });

  try {
    const trackId = parseSpotifyUrl(spotifyUrl);
    if (!trackId)
      return res.status(400).json({ error: "Invalid Spotify URL" });

    const trackInfo = await getSpotifyTrackInfo(trackId);
    const searchQuery = `${trackInfo.title} ${trackInfo.artist}`;

    // Search YouTube
    const searchResults = await ytsr(searchQuery, { limit: 10 });
    const videos = searchResults.items.filter((i) => i.type === "video");

    if (!videos.length)
      return res.status(404).json({ error: "Track not found on YouTube" });

    // Loop to find first working audio link
    let downloadLink, videoSelected;
    for (const video of videos) {
      try {
        const info = await ytdl.getInfo(video.url);
        const format = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });
        if (format && format.url) {
          downloadLink = format.url;
          videoSelected = video;
          break;
        }
      } catch (err) {
        console.warn("Skipping unavailable video:", video.url);
      }
    }

    if (!downloadLink)
      return res.status(500).json({ error: "No valid YouTube audio found" });

    // Return response
    res.json({
      title: videoSelected.title,
      image: videoSelected.thumbnails[0].url,
      duration: videoSelected.duration,
      downloadLink: downloadLink,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

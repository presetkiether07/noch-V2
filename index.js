const express = require("express");
const cors = require("cors");
const YTMusic = require("ytmusic-api");
const ytdl = require("ytdl-core");

const app = express();
app.use(cors());
app.use(express.json());

const ytmusic = new YTMusic();

app.get("/api/spotifydl", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "No Spotify URL provided" });

  try {
    // search song title using Spotify URL (just parse track ID)
    // for simplicity, extract last part of URL
    const trackId = url.split("/").pop().split("?")[0];
    const searchQuery = trackId; // here you can enhance: call Spotify API for title

    // search on YouTube Music
    const results = await ytmusic.search(searchQuery, "song");
    if (!results || results.length === 0)
      return res.status(404).json({ error: "No results found on YouTube Music" });

    const song = results[0];
    const videoUrl = `https://www.youtube.com/watch?v=${song.videoId}`;

    // generate direct mp3 link using ytdl (can be downloaded by client)
    const info = await ytdl.getInfo(videoUrl);
    const format = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });

    res.json({
      title: song.title,
      image: song.thumbnails[0]?.url || "",
      duration: song.duration,
      downloadLink: format.url
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

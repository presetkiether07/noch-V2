const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON
app.use(express.json());

// Spotify Downloader Endpoint
app.get("/api/spotifydl", async (req, res) => {
  const songUrl = req.query.url;
  if (!songUrl) return res.status(400).json({ error: "Missing url parameter" });

  try {
    const response = await axios.get(
      "https://spotify-downloader9.p.rapidapi.com/downloadSong",
      {
        params: { songId: songUrl },
        headers: {
          "X-RapidAPI-Key": "0335845866msh40aeda85b865883p184bf3jsn87526d84da3c",
          "X-RapidAPI-Host": "spotify-downloader9.p.rapidapi.com",
        },
      }
    );

    const result = response.data;

    if (result.success && result.data) {
      return res.json({
        title: result.data.title,
        image: result.data.image,
        duration: result.data.duration,
        downloadLink: result.data.downloadLink,
      });
    } else {
      return res.status(500).json({ error: "Failed to get song data" });
    }
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: "Error fetching data from RapidAPI" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

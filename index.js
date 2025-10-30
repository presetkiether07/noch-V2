const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const DOWNLOADS_DIR = path.resolve(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR);

// Serve downloaded MP3s
app.use("/downloads", express.static(DOWNLOADS_DIR));

// GET endpoint: /spotdl?url=<spotify-url>
app.get("/spotdl", async (req, res) => {
  const spotifyUrl = req.query.url;
  if (!spotifyUrl) return res.status(400).json({ error: "Missing url query parameter" });

  try {
    const cmd = spawn("spotdl", [spotifyUrl, "--output", DOWNLOADS_DIR]);

    let stdout = "";
    let stderr = "";

    cmd.stdout.on("data", (data) => { stdout += data.toString(); });
    cmd.stderr.on("data", (data) => { stderr += data.toString(); });

    cmd.on("close", (code) => {
      if (code !== 0) {
        return res.status(500).json({ success: false, error: "spotDL failed", code, stderr });
      }

      // Parse filename from stdout
      const match = stdout.match(/Saved\s.*\/(.*\.mp3)/);
      const filename = match ? match[1] : null;
      const filePath = filename ? path.join(DOWNLOADS_DIR, filename) : null;

      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(500).json({ success: false, error: "Could not find downloaded file", stdout, stderr });
      }

      // JSON response with download link
      const downloadUrl = `${req.protocol}://${req.get("host")}/downloads/${encodeURIComponent(filename)}`;
      res.json({
        success: true,
        filename,
        downloadUrl
      });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message || err.toString() });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`spotDL REST API running on http://localhost:${PORT}`));

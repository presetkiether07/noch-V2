// --- Add /download endpoint to index.js ---
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// If you already have an `app` in your index.js, just add the route function below
// Route: GET /download?url=<spotify-url>
app.get('/download', async (req, res) => {
  try {
    const spotifyUrl = req.query.url;
    if (!spotifyUrl) return res.status(400).json({ error: 'Missing url query param. Example: /download?url=https://open.spotify.com/track/...' });

    // 1) Request metadata + download links
    const metaResp = await axios.post('https://spotidown.app/api/spotify', { url: spotifyUrl }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    const meta = metaResp.data;
    // try find best download link
    let downloadEntry = null;
    if (Array.isArray(meta.downloads) && meta.downloads.length > 0) {
      // prefer highest bitrate if bitrate present (e.g., "320kbps")
      downloadEntry = meta.downloads.reduce((best, cur) => {
        if (!best) return cur;
        const bVal = (best.bitrate || '').match(/(\d+)/);
        const cVal = (cur.bitrate || '').match(/(\d+)/);
        const bNum = bVal ? parseInt(bVal[1]) : 0;
        const cNum = cVal ? parseInt(cVal[1]) : 0;
        return cNum > bNum ? cur : best;
      }, null);
    }

    // fallback: maybe meta.link or meta.url
    if (!downloadEntry) {
      if (meta.link) downloadEntry = { link: meta.link };
      else if (meta.url) downloadEntry = { link: meta.url };
    }

    if (!downloadEntry || !downloadEntry.link) {
      return res.status(404).json({ error: 'No download link found in Spotidown response', debug: meta });
    }

    // 2) Build final download URL used by site
    const encoded = encodeURIComponent(downloadEntry.link);
    const finalUrl = `https://spotidown.app/api/download?url=${encoded}`;

    // OPTION A (default): redirect browser to final download url so you can test quickly in browser
    return res.redirect(finalUrl);

    // OPTION B (alternative): proxy/stream the file through your server (uncomment if you prefer)
    /*
    const streamResp = await axios.get(finalUrl, { responseType: 'stream', timeout: 60000 });
    // forward content-type & content-length if present
    if (streamResp.headers['content-type']) res.setHeader('Content-Type', streamResp.headers['content-type']);
    if (streamResp.headers['content-length']) res.setHeader('Content-Length', streamResp.headers['content-length']);
    return streamResp.data.pipe(res);
    */
  } catch (err) {
    console.error('Error in /download:', err.message || err);
    const status = (err.response && err.response.status) || 500;
    const body = (err.response && err.response.data) ? err.response.data : undefined;
    return res.status(status).json({ error: 'Failed to fetch from Spotidown', details: err.message, body });
  }
});

// If you already have app.listen() in index.js, skip this block.
// If not, add these lines to run server for testing:
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

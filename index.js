const express = require('express');
const ytmusic = require('youtube-music-api'); // npm install youtube-music-api
const SpotifyWebApi = require('spotify-web-api-node'); // npm install spotify-web-api-node

const app = express();
const api = new ytmusic();

api.initalize(); // initialize YT Music API

// Setup Spotify API
const spotify = new SpotifyWebApi({
  clientId: '9c947484d1d74725a2ae7dfa1ead35b6',
  clientSecret: '2ea2f43035574686a494dbb2ac243457'
});

async function getSpotifyTrack(url) {
  const trackId = url.split('/track/')[1].split('?')[0];
  const token = await spotify.clientCredentialsGrant();
  spotify.setAccessToken(token.body['access_token']);
  const data = await spotify.getTrack(trackId);
  return {
    name: data.body.name,
    artist: data.body.artists.map(a => a.name).join(', ')
  };
}

app.get('/download', async (req, res) => {
  const spotifyUrl = req.query.track;
  if(!spotifyUrl) return res.status(400).json({error: 'Missing track url'});

  try {
    const track = await getSpotifyTrack(spotifyUrl);
    const results = await api.search(`${track.name} - ${track.artist}`, 'song');
    const top = results.content[0];
    if(!top) return res.json({success: false, error: 'No YouTube Music result found'});

    res.json({
      success: true,
      title: track.name,
      artist: track.artist,
      youtubeUrl: `https://music.youtube.com/watch?v=${top.videoId}`
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({success: false, error: e.message});
  }
});

app.listen(3000, ()=>console.log('Server running on port 3000'));

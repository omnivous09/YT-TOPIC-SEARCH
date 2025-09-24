require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use('/', express.static('frontend'));

const API_KEY = process.env.YT_API_KEY;
const PORT = process.env.PORT || 3000;
const BASE = 'https://www.googleapis.com/youtube/v3';

// Helper: convert ISO 8601 duration → mm:ss
function parseISO8601Duration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] || 0, 10);
  const min = parseInt(m[2] || 0, 10);
  const s = parseInt(m[3] || 0, 10);
  return h > 0
    ? `${h}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${min}:${String(s).padStart(2,'0')}`;
}

// 🎵 Search endpoint
app.get('/search', async (req, res) => {
  const song = req.query.song;
  if (!song) return res.status(400).json({ error: 'Missing ?song=' });

  try {
    // Step 1: Search for videos
    const searchParams = new URLSearchParams({
      key: API_KEY,
      q: song,
      part: 'snippet',
      type: 'video',
      maxResults: '15'
    });
    const searchResp = await fetch(`${BASE}/search?${searchParams}`);
    const searchJson = await searchResp.json();

    // Step 2: Filter videos only from Topic channels
    const topicVideos = (searchJson.items || []).filter(
      i => i.snippet.channelTitle.toLowerCase().endsWith(' - topic')
    );

    if (!topicVideos.length) {
      return res.json([]);
    }

    const videoIds = topicVideos.map(v => v.id.videoId).join(',');

    // Step 3: Fetch video details including description + album cover
    const vidsResp = await fetch(
      `${BASE}/videos?part=snippet,contentDetails&id=${videoIds}&key=${API_KEY}`
    );
    const vidsJson = await vidsResp.json();

    const results = vidsJson.items.map(v => ({
      videoId: v.id,
      title: v.snippet.title,
      description: v.snippet.description,
      channelTitle: v.snippet.channelTitle,
      publishedAt: v.snippet.publishedAt,
      albumCover: (v.snippet.thumbnails.maxres || v.snippet.thumbnails.high || v.snippet.thumbnails.default).url,
      duration: parseISO8601Duration(v.contentDetails.duration)
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ API running at http://localhost:${PORT}`);
});

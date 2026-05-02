const spotify = require("../index");

function extractId(url) {
  const match = url.match(/(track|album|artist|playlist)\/([a-zA-Z0-9]+)/);
  if (!match) return null;
  return { type: match[1], id: match[2] };
}

export default async function handler(req, res) {
  try {
    const { url, q } = req.query;

    // 🔍 Search
    if (q) {
      const result = await spotify.search(q);
      return res.status(200).json({ status: true, result });
    }

    // 🎵 URL-based fetch
    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Provide ?url= or ?q="
      });
    }

    const parsed = extractId(url);
    if (!parsed) {
      return res.status(400).json({
        status: false,
        error: "Invalid Spotify URL"
      });
    }

    let data;

    switch (parsed.type) {
      case "track":
        data = await spotify.track(parsed.id);
        break;
      case "album":
        data = await spotify.album(parsed.id);
        break;
      case "artist":
        data = await spotify.artist(parsed.id);
        break;
      case "playlist":
        data = await spotify.playlist(parsed.id);
        break;
      default:
        return res.status(400).json({ error: "Unsupported type" });
    }

    res.status(200).json({
      status: true,
      type: parsed.type,
      result: data
    });

  } catch (err) {
    res.status(500).json({
      status: false,
      error: err.message
    });
  }
}

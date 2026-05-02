const Spotify = require("../lib/spotify");
const downloader = require("../lib/downloader");

// extract track ID
function extractTrackId(input) {
  if (!input) return null;

  if (/^[a-zA-Z0-9]{22}$/.test(input)) return input;

  const match = input.match(/track\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

export default async function handler(req, res) {
  try {
    const { id, url, q } = req.query;

    const spotify = new Spotify();

    // =========================
    // 🔍 SEARCH MODE (?q=)
    // =========================
    if (q) {
      const search = await spotify.search(q);

      const results = (search?.tracks || []).slice(0, 5).map(t => ({
        id: t.id,
        title: t.name,
        artist: t.artists?.map(a => a.name).join(", "),
        cover: t.album?.images?.[0]?.url || null,
        url: t.url
      }));

      return res.status(200).json({
        status: true,
        type: "search",
        total: results.length,
        result: results
      });
    }

    // =========================
    // 🎵 TRACK MODE (?id= or ?url=)
    // =========================
    const trackId = extractTrackId(id || url);

    if (!trackId) {
      return res.status(400).json({
        status: false,
        error: "Provide ?id= or ?url= or ?q="
      });
    }

    const data = await spotify.track(trackId);

    if (!data) {
      return res.status(404).json({
        status: false,
        error: "Track not found"
      });
    }

    let downloadData = null;

    // =========================
    // ⬇️ DOWNLOAD (only when URL provided)
    // =========================
    if (url) {
      downloadData = await downloader(url);
    }

    return res.status(200).json({
      status: true,
      type: "track",
      result: {
        ...data,
        download: downloadData || null
      }
    });

  } catch (err) {
    return res.status(500).json({
      status: false,
      error: err.message
    });
  }
}

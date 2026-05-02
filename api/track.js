const Spotify = require("../lib/spotify"); // adjust path if needed

// helper to extract track ID
function extractTrackId(input) {
  if (!input) return null;

  // if already ID
  if (/^[a-zA-Z0-9]{22}$/.test(input)) return input;

  // from URL
  const match = input.match(/track\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

export default async function handler(req, res) {
  try {
    const { id, url } = req.query;

    const trackId = extractTrackId(id || url);

    if (!trackId) {
      return res.status(400).json({
        status: false,
        error: "Provide valid ?id= or ?url="
      });
    }

    const spotify = new Spotify();

    const data = await spotify.track(trackId);

    if (!data) {
      return res.status(404).json({
        status: false,
        error: "Track not found"
      });
    }

    return res.status(200).json({
      status: true,
      result: data
    });

  } catch (err) {
    return res.status(500).json({
      status: false,
      error: err.message
    });
  }
}

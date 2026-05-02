// ================== IMPORTS ==================
const crypto = require("crypto");
const axios = require("axios");

// ================== CONFIG ==================
const cfg = {
  secret: "376136387538459893883312310911992847112448894410210511297108",
  version: 61,
  client_version: "1.2.88.61.ge172202b",
  query: {
    search: {
      opt: "searchDesktop",
      sha: "21b3fe49546912ba782db5c47e9ef5a7dbd20329520ba0c7d0fcfadee671d24e"
    },
    track: {
      opt: "getTrack",
      sha: "612585ae06ba435ad26369870deaae23b5c8800a256cd8a57e08eddc25a37294"
    }
  }
};

// ================== FETCH WRAPPER ==================
class FetchInstance {
  constructor(config = {}) {
    this.instance = axios.create(config);
    this.defaults = this.instance.defaults;
  }
  get(url, config) {
    return this.instance.get(url, config);
  }
  post(url, data, config) {
    return this.instance.post(url, data, config);
  }
}

// ================== PARSER ==================
class Parser {
  _getImg(o) {
    return (o?.sources || []).map(s => ({
      url: s.url,
      width: s.width || null,
      height: s.height || null
    }));
  }

  _getLink(uri) {
    if (!uri) return {};
    const p = uri.split(":");
    return {
      id: p[2],
      url: `https://open.spotify.com/${p[1]}/${p[2]}`
    };
  }

  parseTrack(t) {
    if (!t) return null;
    const allArtists = [
      ...(t.firstArtist?.items || []),
      ...(t.otherArtists?.items || [])
    ];

    return {
      ...this._getLink(t.uri),
      name: t.name,
      duration_ms: t.duration?.totalMilliseconds,
      playcount: parseInt(t.playcount) || 0,
      artists: allArtists.map(a => ({
        name: a.profile?.name
      })),
      cover: t.albumOfTrack?.coverArt?.sources?.[0]?.url
    };
  }

  parseSearch(res) {
    return (res?.tracksV2?.items || []).map(n => {
      const t = n.item?.data;
      return {
        id: t?.uri?.split(":")[2],
        title: t?.name,
        artist: t?.artists?.items?.map(a => a.profile?.name).join(", "),
        cover: t?.albumOfTrack?.coverArt?.sources?.[0]?.url,
        url: `https://open.spotify.com/track/${t?.uri?.split(":")[2]}`
      };
    });
  }
}

// ================== SPOTIFY CORE ==================
class Spotify {
  constructor() {
    this.parser = new Parser();
    this.is = new FetchInstance({
      headers: {
        referer: "https://open.spotify.com/",
        origin: "https://open.spotify.com",
        "user-agent": "Mozilla/5.0"
      }
    });
  }

  generateTOTP(tsms) {
    const counter = Math.floor((tsms / 1000) / 30);
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));
    const hmac = crypto.createHmac("sha1", Buffer.from(cfg.secret))
      .update(buffer)
      .digest();

    const offset = hmac[hmac.length - 1] & 0xf;
    const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
    return code.toString().padStart(6, "0");
  }

  async getToken() {
    if (this.is.defaults.headers.authorization) return true;

    const { data: token } = await this.is.get(
      "https://open.spotify.com/api/token",
      {
        params: {
          reason: "init",
          productType: "web-player",
          totp: this.generateTOTP(Date.now()),
          totpServer: this.generateTOTP(Date.now()),
          totpVer: cfg.version
        }
      }
    );

    const { data: client } = await this.is.post(
      "https://clienttoken.spotify.com/v1/clienttoken",
      {
        client_data: {
          client_version: cfg.client_version,
          client_id: token.clientId
        }
      }
    );

    Object.assign(this.is.defaults.headers, {
      authorization: `Bearer ${token.accessToken}`,
      "client-token": client.granted_token.token
    });

    return true;
  }

  async query(name, vars) {
    await this.getToken();

    const sel = cfg.query[name];

    const { data } = await this.is.post(
      "https://api-partner.spotify.com/pathfinder/v2/query",
      {
        variables: vars,
        operationName: sel.opt,
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: sel.sha
          }
        }
      }
    );

    return data;
  }

  async track(id) {
    const res = await this.query("track", {
      uri: `spotify:track:${id}`
    });

    return this.parser.parseTrack(res.data.trackUnion);
  }

  async search(q) {
    const res = await this.query("search", {
      searchTerm: q,
      offset: 0,
      limit: 5
    });

    return this.parser.parseSearch(res.data.searchV2);
  }
}

// ================== DOWNLOADER ==================
async function download(url) {
  try {
    const { data } = await axios.post(
      "https://gamepvz.com/api/download/get-url",
      { url }
    );

    return {
      title: data.title,
      author: data.authorName,
      cover: data.coverUrl,
      dl: Buffer.from(
        data.originalVideoUrl.split("url=")[1],
        "base64"
      ).toString("utf-8")
    };
  } catch {
    return null;
  }
}

// ================== HELPER ==================
function extractId(input) {
  if (!input) return null;
  if (/^[a-zA-Z0-9]{22}$/.test(input)) return input;
  const m = input.match(/track\/([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

// ================== API HANDLER ==================
export default async function handler(req, res) {
  try {
    const { id, url, q } = req.query;
    const spotify = new Spotify();

    // 🔍 SEARCH
    if (q) {
      const result = await spotify.search(q);
      return res.json({ status: true, type: "search", result });
    }

    const trackId = extractId(id || url);
    if (!trackId) {
      return res.json({ status: false, error: "Missing input" });
    }

    const data = await spotify.track(trackId);

    let dl = null;
    if (url) dl = await download(url);

    res.json({
      status: true,
      type: "track",
      result: {
        ...data,
        download: dl
      }
    });

  } catch (e) {
    res.json({ status: false, error: e.message });
  }
}

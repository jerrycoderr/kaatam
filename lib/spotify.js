const crypto = require("crypto");
const Parser = require("./parser");
const FetchInstance = require("./fetch");
const cfg = require("./constant");

class Spotify {
    constructor() {
        this.cfg = cfg;
        this.is = new FetchInstance({
            headers: {
                'referer': 'https://open.spotify.com/',
                'origin': 'https://open.spotify.com',
                'content-type': 'application/json',
                'accept': 'application/json',
                'user-agent': 'Mozilla/5.0 (Linux; Android 16; NX729J) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.34 Mobile Safari/537.36',
            }
        });
        this.parser = new Parser();
    }

    generateTOTP(tsms) {
        const counter = Math.floor((tsms / 1000) / 30);
        const buffer = Buffer.alloc(8);
        buffer.writeBigInt64BE(BigInt(counter));
        const hmac = crypto.createHmac('sha1', Buffer.from(this.cfg.secret, "utf8")).update(buffer);
        const digest = hmac.digest();
        const offset = digest[digest.length - 1] & 0xf;
        const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
        return code.toString().padStart(6, '0');
    }

    async getToken() {
        try {
            if (this.is.defaults.headers.authorization) return true;
            const sts = Math.floor(Date.now() / 1000);
            
            const { data: token } = await this.is.get("https://open.spotify.com/api/token", {
                params: {
                    reason: "init",
                    productType: "web-player",
                    totp: this.generateTOTP(Date.now()),
                    totpServer: this.generateTOTP(sts * 1000),
                    totpVer: String(this.cfg.version)
                }
            });

            const { data: client } = await this.is.post('https://clienttoken.spotify.com/v1/clienttoken', {
                client_data: {
                    client_version: this.cfg.client_version,
                    client_id: token.clientId,
                    js_sdk_data: {
                        device_brand: "unknown",
                        device_model: "unknown",
                        os: "linux",
                        os_version: "24.04",
                        device_id: crypto.randomUUID(),
                        device_type: "computer"
                    }
                }
            });

            Object.assign(this.is.defaults.headers, {
                'accept-language': 'en',
                'app-platform': 'WebPlayer',
                'authorization': `Bearer ${token.accessToken}`,
                'client-token': client.granted_token.token,
                'spotify-app-version': this.cfg.client_version
            });
            
            return true;
        } catch (error) {
            return false;
        }
    }

    async query(name, vars) {
        try {
            if (!(await this.getToken())) return;
            const sel = this.cfg.query[name];

            const { data: res } = await this.is.post('https://api-partner.spotify.com/pathfinder/v2/query', {
                variables: vars,
                operationName: sel.opt,
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: sel.sha
                    }
                }
            });
            
            return res;
        } catch (error) {
            throw error;
        }
    }

    async search(query) {
        try {
            const res = await this.query("search", {
                searchTerm: query,
                offset: 0,
                limit: 10,
                numberOfTopResults: 5,
                includeAudiobooks: true,
                includeArtistHasConcertsField: false,
                includePreReleases: true,
                includeAuthors: false,
                includeEpisodeContentRatingsV2: false
            });
            return this.parser.parseSearch(res.data.searchV2);
        } catch (error) {
            throw error;
        }
    }

    async track(ids) {
        try {
            const res = await this.query("track", {
                uri: `spotify:track:${ids}`
            });
            return this.parser.parseTrack(res.data.trackUnion);
        } catch (error) {
            throw error;
        }
    }

    async artist(ids) {
        try {
            const res = await this.query("artist", {
                uri: `spotify:artist:${ids}`,
                locale: "",
                preReleaseV2: false
            });
            return this.parser.parseArtist(res.data.artistUnion);
        } catch (error) {
            throw error;
        }
    }

    async album(ids) {
        try {
            const res = await this.query("album", {
                uri: `spotify:album:${ids}`,
                locale: "",
                offset: 0,
                limit: 50
            });
            return this.parser.parseAlbum(res.data.albumUnion);
        } catch (error) {
            throw error;
        }
    }

    async playlist(ids) {
        try {
            const res = await this.query("playlist", {
                uri: `spotify:playlist:${ids}`,
                offset: 0,
                limit: 25,
                enableWatchFeedEntrypoint: false,
                includeEpisodeContentRatingsV2: false
            });
            return this.parser.parsePlaylist(res.data.playlistV2);
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Spotify;

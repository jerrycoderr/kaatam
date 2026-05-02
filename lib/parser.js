class Parser {
    _getImg(o) {
        return (o?.sources || []).map(s => ({
            url: s.url,
            width: s.width || s.maxWidth || null,
            height: s.height || s.maxHeight || null
        }));
    }

    _getCol(o) {
        return o?.extractedColors?.colorRaw?.hex || o?.extractedColors?.colorDark?.hex || null;
    }

    _getVI(v) {
        return v?.squareCoverImage?.extractedColorSet ? {
            text_color: v.squareCoverImage.extractedColorSet.encoreBaseSetTextColor || null,
            high_contrast: v.squareCoverImage.extractedColorSet.highContrast || null,
            higher_contrast: v.squareCoverImage.extractedColorSet.higherContrast || null,
            min_contrast: v.squareCoverImage.extractedColorSet.minContrast || null
        } : null;
    }

    _getLink(uri) {
        if (!uri) return { id: null, url: null };
        const p = uri.split(':');
        return {
            uri,
            id: p[2] || null,
            url: p[2] ? `https://open.spotify.com/${p[1]}/${p[2]}` : null
        };
    }

    parseSearch(res) {
        if (!res) return null;

        const parse = (arr, mapFn, isTrack = false) => (arr || []).reduce((acc, node) => {
            const d = isTrack ? node.item?.data : node.data;
            if (d) acc.push({ ...mapFn(d), ...(node.matchedFields && { matched_fields: node.matchedFields }) });
            return acc;
        }, []);

        const trackItems = res.tracksV2?.items?.length ? res.tracksV2.items : res.topResultsV2?.itemsV2?.filter(i => i.item?.__typename === "TrackResponseWrapper");

        return {
            top_results: (res.topResultsV2?.itemsV2 || []).reduce((acc, node) => {
                const wrap = node.item;
                const d = wrap?.data;
                if (!d) return acc;
                const type = wrap.__typename?.replace('ResponseWrapper', '') || 'Unknown';
                acc.push({
                    type: type, ...this._getLink(d.uri),
                    name: d.name || d.profile?.name || d.displayName || null,
                    images: this._getImg(d.coverArt || d.visuals?.avatarImage || d.images?.items?.[0] || d.avatar),
                    matched_fields: node.matchedFields || []
                });
                return acc;
            }, []),
            tracks: parse(trackItems, t => ({
                ...this._getLink(t.uri), name: t.name || null, duration_ms: t.duration?.totalMilliseconds || 0,
                explicit: t.contentRating?.label === "EXPLICIT", media_type: t.trackMediaType || null,
                playability: { playable: !!t.playability?.playable, reason: t.playability?.reason || null },
                associations: { audio_count: t.associationsV3?.audioAssociations?.totalCount || 0, video_count: t.associationsV3?.videoAssociations?.totalCount || 0 },
                artists: (t.artists?.items || []).map(a => ({ ...this._getLink(a.uri), uri: a.uri, name: a.profile?.name })),
                album: {
                    ...this._getLink(t.albumOfTrack?.uri), name: t.albumOfTrack?.name || null,
                    images: this._getImg(t.albumOfTrack?.coverArt), color_dark: this._getCol(t.albumOfTrack?.coverArt), visual_identity: this._getVI(t.albumOfTrack?.visualIdentity)
                },
                sixteen_by_nine_cover: t.visualIdentity?.sixteenByNineCoverImage?.image?.data?.sources || []
            }), true),
            albums: parse(res.albumsV2?.items, a => ({
                ...this._getLink(a.uri), name: a.name || null, type: a.type || null, release_year: a.date?.year || null,
                playability: { playable: !!a.playability?.playable, reason: a.playability?.reason || null },
                artists: (a.artists?.items || []).map(art => ({ ...this._getLink(art.uri), uri: art.uri, name: art.profile?.name })),
                images: this._getImg(a.coverArt), color_dark: this._getCol(a.coverArt), visual_identity: this._getVI(a.visualIdentity)
            })),
            artists: parse(res.artists?.items, art => ({
                ...this._getLink(art.uri), name: art.profile?.name || null, images: this._getImg(art.visuals?.avatarImage), color_dark: this._getCol(art.visuals?.avatarImage), visual_identity: this._getVI(art.visualIdentity)
            })),
            episodes: parse(res.episodes?.items, ep => ({
                ...this._getLink(ep.uri), name: ep.name || null, description: ep.description || null, duration_ms: ep.duration?.totalMilliseconds || 0, explicit: ep.contentRating?.label === "EXPLICIT", media_types: ep.mediaTypes || [], release_date: ep.releaseDate?.isoString || null,
                playability: { playable: ep.playability?.reason === "PLAYABLE", reason: ep.playability?.reason || null }, played_state: ep.playedState?.state || null, is_paywall: !!ep.restrictions?.paywallContent,
                images: this._getImg(ep.coverArt), color_dark: this._getCol(ep.coverArt), visual_identity: this._getVI(ep.visualIdentity), video_preview_thumbnail: this._getImg(ep.videoPreviewThumbnail?.imagePreview?.data),
                podcast: { ...this._getLink(ep.podcastV2?.data?.uri), name: ep.podcastV2?.data?.name || null, publisher: ep.podcastV2?.data?.publisher?.name || null, media_type: ep.podcastV2?.data?.mediaType || null }
            })),
            podcasts: parse(res.podcasts?.items, pod => ({
                ...this._getLink(pod.uri), name: pod.name || null, publisher: pod.publisher?.name || null, media_type: pod.mediaType || null,
                topics: (pod.topics?.items || []).map(t => ({ ...this._getLink(t.uri), uri: t.uri, title: t.title })),
                images: this._getImg(pod.coverArt), color_dark: this._getCol(pod.coverArt), visual_identity: this._getVI(pod.visualIdentity)
            })),
            playlists: parse(res.playlists?.items, pl => ({
                ...this._getLink(pl.uri), name: pl.name || null, description: pl.description || null, format: pl.format || null, attributes: pl.attributes || [],
                images: this._getImg(pl.images?.items?.[0]), color_dark: this._getCol(pl.images?.items?.[0]), visual_identity: this._getVI(pl.visualIdentity),
                owner: { ...this._getLink(pl.ownerV2?.data?.uri), display_name: pl.ownerV2?.data?.name || null, username: pl.ownerV2?.data?.username || null, images: this._getImg(pl.ownerV2?.data?.avatar) }
            })),
            genres: parse(res.genres?.items, g => ({
                ...this._getLink(g.uri), name: g.name || null, images: this._getImg(g.image), color_dark: this._getCol(g.image)
            })),
            users: parse(res.users?.items, u => ({
                ...this._getLink(u.uri), display_name: u.displayName || null, username: u.username || null, images: this._getImg(u.avatar), color_dark: this._getCol(u.avatar)
            }))
        };
    }

    parseTrack(data) {
        const t = data?.track || data;
        if (!t || t.__typename !== 'Track') return null;
        const allArtists = [...(t.firstArtist?.items || []), ...(t.otherArtists?.items || [])];

        return {
            ...this._getLink(t.uri), name: t.name || null, duration_ms: t.duration?.totalMilliseconds || 0,
            playcount: parseInt(t.playcount) || 0, explicit: t.contentRating?.label === "EXPLICIT", track_number: t.trackNumber || null,
            album: {
                ...this._getLink(t.albumOfTrack?.uri), name: t.albumOfTrack?.name || null, type: t.albumOfTrack?.type || null, release_year: t.albumOfTrack?.date?.year || null,
                images: this._getImg(t.albumOfTrack?.coverArt), color: this._getCol(t.albumOfTrack?.coverArt), visual_identity: this._getVI(t.albumOfTrack?.visualIdentity)
            },
            artists: allArtists.map(node => ({ ...this._getLink(node.uri), name: node.profile?.name || null, images: this._getImg(node.visuals?.avatarImage) }))
        };
    }

    parseArtist(data) {
        const a = data?.artist || data;
        if (!a || a.__typename !== 'Artist') return null;

        return {
            ...this._getLink(a.uri || `spotify:artist:${a.id}`), uri: a.uri || `spotify:artist:${a.id}`, name: a.profile?.name || null, verified: !!a.profile?.verified,
            images: this._getImg(a.visuals?.avatarImage), header_images: this._getImg(a.visuals?.headerImage?.data || a.headerImage?.data), color: this._getCol(a.visuals?.avatarImage),
            statistics: { followers: a.stats?.followers || 0, monthly_listeners: a.stats?.monthlyListeners || 0 },
            top_tracks: (a.discography?.topTracks?.items || []).map(node => ({
                ...this._getLink(node.track?.uri), name: node.track?.name || null, playcount: parseInt(node.track?.playcount) || 0, duration_ms: node.track?.duration?.totalMilliseconds || 0,
                album: { ...this._getLink(node.track?.albumOfTrack?.uri), name: node.track?.albumOfTrack?.name || null, images: this._getImg(node.track?.albumOfTrack?.coverArt) }
            }))
        };
    }

    parseAlbum(data) {
        const al = data?.albumUnion || data?.album || data;
        if (!al || (al.__typename !== 'Album' && al.__typename !== 'AlbumRelease')) return null;

        return {
            ...this._getLink(al.uri), name: al.name || null, type: al.type || null,
            release_date: al.date?.isoString || al.date?.year || null, label: al.label || null,
            playability: { playable: !!al.playability?.playable, reason: al.playability?.reason || null },
            images: this._getImg(al.coverArt), color: this._getCol(al.coverArt), visual_identity: this._getVI(al.visualIdentity),
            artists: (al.artists?.items || []).map(art => ({ ...this._getLink(art.uri), name: art.profile?.name || null })),
            copyrights: al.copyrights?.items || [],
            tracks: (al.tracks?.items || al.tracksV2?.items || []).map(node => {
                const t = node.track || node;
                return {
                    ...this._getLink(t.uri), name: t.name || null, duration_ms: t.duration?.totalMilliseconds || 0,
                    playcount: parseInt(t.playcount) || 0, explicit: t.contentRating?.label === "EXPLICIT", track_number: t.trackNumber || null,
                    artists: (t.artists?.items || []).map(a => ({ ...this._getLink(a.uri), uri: a.uri, name: a.profile?.name }))
                };
            })
        };
    }

    parsePlaylist(data) {
        const pl = data?.playlistV2 || data?.playlist || data;
        if (!pl || (pl.__typename !== 'Playlist' && pl.__typename !== 'PlaylistResponseWrapper')) return null;

        return {
            ...this._getLink(pl.uri), name: pl.name || null, description: pl.description || null, format: pl.format || null,
            followers: pl.followers || pl.ownerV2?.data?.followers || 0,
            images: this._getImg(pl.images?.items?.[0] || pl.image), color: this._getCol(pl.images?.items?.[0] || pl.image), visual_identity: this._getVI(pl.visualIdentity),
            owner: {
                ...this._getLink(pl.ownerV2?.data?.uri), display_name: pl.ownerV2?.data?.name || null, username: pl.ownerV2?.data?.username || null,
                images: this._getImg(pl.ownerV2?.data?.avatar)
            },
            tracks: (pl.content?.items || pl.tracks?.items || []).map(node => {
                const t = node.item?.data || node.track || node;
                if (!t || t.__typename !== 'Track') return null;
                return {
                    ...this._getLink(t.uri), name: t.name || null, duration_ms: t.duration?.totalMilliseconds || 0, explicit: t.contentRating?.label === "EXPLICIT",
                    album: { ...this._getLink(t.albumOfTrack?.uri), name: t.albumOfTrack?.name || null, images: this._getImg(t.albumOfTrack?.coverArt) },
                    artists: (t.artists?.items || []).map(a => ({ ...this._getLink(a.uri), uri: a.uri, name: a.profile?.name }))
                };
            }).filter(item => item !== null)
        };
    }
}

module.exports = Parser;

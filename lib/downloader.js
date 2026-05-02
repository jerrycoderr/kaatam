const FetchInstance = require('./fetch');

async function SpotifyDl(url) {
    try {
        const fetcher = new FetchInstance({
            headers: {
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0 (Linux; Android 16; NX729J) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.34 Mobile Safari/537.36',
            }
        });
        
        const { data: pp } = await fetcher.post('https://gamepvz.com/api/download/get-url', { url });
        
        return {
            status: true,
            title: pp.title,
            author: pp.authorName,
            cover: pp.coverUrl,
            dl: atob(pp.originalVideoUrl.split('url=')[1])
        }
    } catch (e) {
        return { status: false }
    }
}

module.exports = SpotifyDl;

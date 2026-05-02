class FetchInstance {
    constructor(defaultOptions = {}) {
        this.defaults = {
            headers: defaultOptions.headers || {}
        };
    }

    async request(url, options = {}) {
        const headers = { ...this.defaults.headers, ...(options.headers || {}) };
        
        let urlObj;
        try {
            urlObj = new URL(url);
        } catch {
            throw new Error(`Invalid URL: ${url}`);
        }
        
        if (options.params) {
            for (const [key, value] of Object.entries(options.params)) {
                urlObj.searchParams.append(key, value);
            }
        }

        const res = await fetch(urlObj.toString(), {
            ...options,
            headers
        });

        let data;
        try {
            data = await res.json();
        } catch (e) {
            data = await res.text();
        }

        return { data, status: res.status, headers: res.headers };
    }

    async get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    async post(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'POST',
            body: typeof data === 'object' ? JSON.stringify(data) : data
        });
    }
}

module.exports = FetchInstance;

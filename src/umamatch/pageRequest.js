function createPageRequest({ page, baseUrl }) {
    return async function request({ method, path, body }) {
        const url = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
        return page.evaluate(async payload => {
            const options = {
                method: payload.method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'cache-control': 'no-cache'
                }
            };

            if (payload.body !== undefined) {
                options.body = JSON.stringify(payload.body);
            }

            const response = await fetch(payload.url, options);
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (error) {
                return {
                    code: response.status,
                    message: text || response.statusText || error.message
                };
            }
        }, { url, method, body });
    };
}

module.exports = {
    createPageRequest
};

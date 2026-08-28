const fs = require('fs');

async function loadCookies({ context, cookiePath, logger = console }) {
    if (!fs.existsSync(cookiePath)) {
        logger.warn(`Cookie file not found: ${cookiePath}`);
        return false;
    }

    try {
        const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
        await context.addCookies(cookies);
        logger.info(`Cookies loaded from ${cookiePath}`);
        return true;
    } catch (error) {
        logger.error(`Failed to load cookies from ${cookiePath}: ${error.message}`);
        return false;
    }
}

// 只保留目標站台的 cookie；context.cookies() 會連第三方追蹤 cookie 一併回傳。
const SESSION_COOKIE_DOMAIN = 'komoejoy.com';

function keepSessionCookies(cookies) {
    return (Array.isArray(cookies) ? cookies : [])
        .filter(cookie => String(cookie && cookie.domain || '').includes(SESSION_COOKIE_DOMAIN));
}

async function saveCookies({ context, cookiePath, logger = console }) {
    const cookies = keepSessionCookies(await context.cookies());
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
    logger.info(`Cookies saved to ${cookiePath}`);
}

module.exports = {
    SESSION_COOKIE_DOMAIN,
    keepSessionCookies,
    loadCookies,
    saveCookies
};

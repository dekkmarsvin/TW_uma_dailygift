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

async function saveCookies({ context, cookiePath, logger = console }) {
    const cookies = await context.cookies();
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
    logger.info(`Cookies saved to ${cookiePath}`);
}

module.exports = {
    loadCookies,
    saveCookies
};

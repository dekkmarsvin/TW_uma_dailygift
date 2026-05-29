function parseCliOptions(args) {
    const options = { claim: false };

    for (const arg of args) {
        if (arg === '--claim') {
            options.claim = true;
        } else if (arg === '--dry-run') {
            options.claim = false;
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return options;
}

module.exports = {
    parseCliOptions
};

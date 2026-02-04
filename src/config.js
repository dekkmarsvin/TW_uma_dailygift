require('dotenv').config();

module.exports = {
    username: process.env.login_username,
    password: process.env.login_password,
    cookieString: process.env.cookie,
    targetUrl: 'https://uma.komoejoy.com/event/dailygift/'
};

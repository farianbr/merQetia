const { join } = require('path');

/**
 * Keep Puppeteer's downloaded Chromium inside the project directory.
 *
 * On Render (and similar hosts) the build step and the runtime share the
 * project filesystem, but the default `~/.cache/puppeteer` location is NOT
 * preserved into runtime. Pinning the cache next to the code ensures the
 * browser downloaded at `npm install` time is still present when the server runs.
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};

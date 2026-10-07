const fs = require('fs');
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const devMusicDir = path.join(projectRoot, 'dev-assets', 'music');

/**
 * DEV ONLY: serve the synthetic music sample (dev-assets/music) at
 * /dev-music/<file> from the Metro dev server. The file is never `require`d,
 * so it is not part of release bundles. See src/features/reels/music/README.md.
 */
function serveDevMusic(middleware) {
  return (req, res, next) => {
    const match = /^\/dev-music\/([a-z0-9._-]+\.(m4a|mp3|wav))$/i.exec(
      (req.url || '').split('?')[0],
    );
    if (!match) return middleware(req, res, next);
    const file = path.join(devMusicDir, path.basename(match[1]));
    if (!fs.existsSync(file)) {
      res.statusCode = 404;
      return res.end('Not found');
    }
    const type = { m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav' }[
      match[2].toLowerCase()
    ];
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Length', fs.statSync(file).size);
    return fs.createReadStream(file).pipe(res);
  };
}

/**
 * Metro configuration for pnpm monorepo
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    disableHierarchicalLookup: true,
  },
  server: {
    enhanceMiddleware: middleware => serveDevMusic(middleware),
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);

export function precachePaths(assets) {
  return [...new Set(['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', ...assets])];
}
export function precacheUrls(assets, base) {
  return precachePaths(assets).map(path => new URL(path, base).href);
}

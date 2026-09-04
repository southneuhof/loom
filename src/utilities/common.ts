export function parseURL(url: string, prefix = '', suffix = '') {
  if (url.slice(-7) === '?custom') return url.slice(0, -7)
  return prefix + url + suffix
}

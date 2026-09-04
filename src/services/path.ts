export function parseURL(url: string, prefix: string = '', suffix: string = '') {
  if (url.endsWith('?custom')) return url.slice(0, -7)
  return `${prefix}${url}${suffix}`
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/**
 * Validates an href string against an allowlist of protocols.
 * Returns the href unchanged if safe, or '#' if the scheme is disallowed
 * (e.g. javascript:, data:, vbscript:).
 *
 * @param {string|undefined|null} href
 * @returns {string}
 */
export function safeHref(href) {
  if (!href) return '#'
  try {
    const { protocol } = new URL(href)
    return ALLOWED_PROTOCOLS.has(protocol) ? href : '#'
  } catch {
    // Relative URLs have no protocol — allow them
    return href.startsWith('/') || href.startsWith('.') ? href : '#'
  }
}

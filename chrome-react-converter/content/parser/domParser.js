// domParser.js - normalize HTML string into a simple tree via DOMParser in content; here a fallback no-op
export function htmlToTree(html) {
  // This module is not used in content; background receives raw HTML and we may treat it as opaque.
  return { type: 'root', raw: html };
}

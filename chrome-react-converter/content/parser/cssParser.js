// cssParser.js - placeholder for advanced PostCSS parsing in future
export function filterCss(rules) {
  // Deduplicate
  const seen = new Set();
  return rules.filter(r => { if (seen.has(r)) return false; seen.add(r); return true; });
}

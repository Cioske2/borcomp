// parseAdapter.js - integrate parse5 for robust HTML parsing & attribute normalization
// We vendor parse5 via package.json dependency. In MV3 context without bundling, you must bundle or copy parse5 source
// into the extension (e.g., place a built file under vendor/ and import it). This adapter attempts dynamic import.

let parse5Module = null;
async function ensureParse5(){
  if (parse5Module) return parse5Module;
  try {
    // Attempt standard import (works if bundled or dependency copied)
    parse5Module = await import(/* @vite-ignore */ 'parse5');
  } catch (e) {
    console.warn('[parseAdapter] parse5 not available, falling back to DOMParser:', e);
    parse5Module = null;
  }
  return parse5Module;
}

// Convert parse5 AST to our simplified tree format { type:'element'|'text', tag, attrs, children }
function convertNode(node){
  if (!node) return null;
  if (node.nodeName === '#text') {
    return { type: 'text', text: node.value || '' };
  }
  if (node.nodeName === '#comment') return null; // skip comments
  if (node.tagName) {
    const attrs = {};
    if (Array.isArray(node.attrs)) {
      for (const a of node.attrs) {
        // parse5 preserves attribute case; HTML is case-insensitive
        attrs[a.name] = a.value ?? '';
      }
    }
    const children = [];
    if (Array.isArray(node.childNodes)) {
      for (const c of node.childNodes) {
        const conv = convertNode(c);
        if (conv) children.push(conv);
      }
    }
    return { type: 'element', tag: node.tagName, attrs, children };
  }
  // Document or fragment
  if (Array.isArray(node.childNodes)) {
    const children = node.childNodes.map(convertNode).filter(Boolean);
    return { type: 'fragment', children };
  }
  return null;
}

export async function robustParse(html){
  const mod = await ensureParse5();
  if (!mod) {
    // Fallback: use DOMParser only if available (not available in service worker)
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        return domToSimple(doc.body || doc);
      } catch (err) {
        console.error('DOMParser fallback failed', err);
        return null; // let caller fallback to provided tree
      }
    }
    // No parser available in this context; signal caller to fallback to provided tree
    return null;
  }
  try {
    const ast = mod.parseFragment(html, { sourceCodeLocationInfo: false });
    return convertNode(ast) || { type: 'fragment', children: [] };
  } catch (err) {
    console.error('parse5 parse error, fallback to DOMParser:', err);
    return robustParseFallback(html);
  }
}

function robustParseFallback(html){
  if (typeof DOMParser === 'undefined') return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return domToSimple(doc.body || doc);
  } catch { return null; }
}

function domToSimple(root){
  function walk(node){
    if (node.nodeType === 3) { // text
      if (!node.nodeValue.trim()) return null;
      return { type: 'text', text: node.nodeValue };
    }
    if (node.nodeType !== 1) return null;
    const tag = node.tagName.toLowerCase();
    const attrs = {};
    for (const attr of node.attributes) attrs[attr.name] = attr.value;
    const children = [];
    for (const child of node.childNodes){
      const c = walk(child);
      if (c) children.push(c);
    }
    return { type: 'element', tag, attrs, children };
  }
  const outChildren = [];
  for (const child of root.childNodes){
    const c = walk(child);
    if (c) outChildren.push(c);
  }
  return { type: 'fragment', children: outChildren };
}

// Merge style data from original selection tree into parsed tree (matching preorder traversal of elements)
export function mergeStyles(parsed, original){
  const origElements = [];
  (function collect(n){ if (!n) return; if (n.type==='element') origElements.push(n); (n.children||[]).forEach(collect); })(original);
  let idx = 0;
  (function apply(n){
    if (!n) return; if (n.type==='element'){ const src = origElements[idx++]; if (src && src.style) n.style = src.style; }
    (n.children||[]).forEach(apply);
  })(parsed);
  return parsed;
}

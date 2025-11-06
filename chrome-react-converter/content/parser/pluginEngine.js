// pluginEngine.js - pluggable recognizers for UI frameworks
import { bootstrapPlugin } from './plugins/bootstrap.js';
import { tailwindPlugin } from './plugins/tailwind.js';
import { muiPlugin } from './plugins/mui.js';

const plugins = [bootstrapPlugin, tailwindPlugin, muiPlugin];

function walk(node, fn, path=[]) {
  fn(node, path);
  (node.children||[]).forEach((c, i) => walk(c, fn, path.concat(i)));
}

export function analyzeWithPlugins(root){
  const suggestions = [];
  walk(root, (node, path) => {
    if (!node || node.type !== 'element') return;
    for (const p of plugins){
      try{
        const out = p.detect(node, { path });
        if (Array.isArray(out)) suggestions.push(...out);
      }catch(err){ /* ignore plugin errors */ }
    }
  });
  // Optional: dedupe similar suggestions by framework+component+path
  const key = s => `${s.framework}|${s.component}|${s.path?.join('.')||''}`;
  const map = new Map();
  for (const s of suggestions){ const k = key(s); if (!map.has(k) || (s.confidence||0) > (map.get(k).confidence||0)) map.set(k, s); }
  return Array.from(map.values());
}

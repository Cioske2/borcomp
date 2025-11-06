// reactGenerator.js - core code generation logic (simplified)
import { filterCss } from './cssParser.js';
import { extractHandlers } from './jsExtractor.js';
import { robustParse, mergeStyles } from './parseAdapter.js';
import { analyzeWithPlugins } from './pluginEngine.js';

export async function generateReactProject(selection, options={}) {
  const { html, cssRules, jsEvents, tree } = selection;
  const css = filterCss(cssRules || []);
  const handlers = extractHandlers(jsEvents || []);
  const inlineMode = options?.cssMode === 'inline';

  // Robust parse (parse5) for edge-case attribute handling. Merge styles from original tree.
  let parsedTree = null;
  if (html) {
    try {
      parsedTree = await robustParse(html);
      if (!parsedTree) {
        // parseAdapter signaled no parser available; fallback to original tree
        parsedTree = tree;
      } else if (parsedTree && tree) {
        parsedTree = mergeStyles(parsedTree, tree);
      }
    } catch (err) {
      console.warn('[reactGenerator] robustParse failed, fallback to provided tree', err);
      parsedTree = tree;
    }
  }
  const workingTree = parsedTree || tree;

  // Post-process selects to defaultValue
  if (workingTree) postProcessSelects(workingTree);

  // Try to split into high-level sections (Header, SearchBar, LanguageSelector, SocialMedia)
  const split = workingTree ? splitIntoSections(workingTree, handlers) : null;
  let components = {};
  let appBody = '';
  if (split && split.order.length) {
    components = split.components;
    appBody = split.order.map(n => `<${n}/>`).join('\n');
    // Layout wrapper detection: if root has multiple major sections, wrap them
    if (split.order.length >= 2 && workingTree) {
      const layoutName = 'Layout';
      const wrapperClass = (workingTree.attrs?.class || '').toLowerCase();
      const isLayouty = /container|layout|wrapper|main|content/.test(wrapperClass);
      if (isLayouty) {
        const inner = split.order.map(n => `<${n} />`).join('\n');
        components[`${layoutName}.jsx`] = wrapAsComponent(layoutName, `<div className=\"${escapeHtml(workingTree.attrs.class)}\">${inner}</div>`, handlers);
        appBody = `<${layoutName}/>`;
      }
    }
  } else {
    // Always produce a component per selezione se nessuna sezione rilevata
    const mainName = guessName(workingTree || { tag: 'Fragment' });
    const mainJsx = workingTree ? toJsx(workingTree, inlineMode) : htmlToJsx(html);
    components = { [`${mainName}.jsx`]: wrapAsComponent(mainName, mainJsx, handlers) };
    appBody = `<${stripExt(`${mainName}.jsx`)}/>`;
  }

  const app = `import React from 'react';\n${Object.keys(components).map(name=>`import ${stripExt(name)} from './components/${name}';`).join('\n')}\nimport './styles.css';\nexport default function App(){\n  return (<>${appBody}</>);\n}`;
  const index = `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App/>);`;
  const styles = css.join('\n');

  // Plugin-based recognition suggestions
  let suggestions = [];
  try {
    if (workingTree) suggestions = analyzeWithPlugins(workingTree);
  } catch (err) {
    console.warn('[reactGenerator] plugin analysis failed', err);
  }

  return {
    'App.jsx': app,
    'index.js': index,
    'styles.css': styles || '/* no styles extracted */',
    components,
    meta: { handlers: handlers.map(h=>h.name), suggestions }
  };
}

function stripExt(n){ return n.replace(/\.jsx$/, ''); }

function wrapAsComponent(name, bodyJsx, handlers){
  const handlerFns = handlers.map(h=>`function ${h.name}(e){/* original: ${escapeJs(h.original)} */}`).join('\n');
  return `import React from 'react';\n${handlerFns}\nexport default function ${name}(){\n  return (<>${bodyJsx}</>);\n}`;
}

function escapeJs(s=''){ return (s+'').replace(/`/g,'\\`'); }

function htmlToJsx(html){
  return sanitizeHtmlToJsx(html);
}

function toJsx(node, inlineMode=false){
  if (!node) return '';
  if (node.type === 'text') return escapeHtml(node.text);
  const attrs = toAttrs(node.tag, node.attrs || {}, node.style, inlineMode);
  const children = (node.children||[]).map(c => toJsx(c, inlineMode)).join('');
  const selfClosing = VOID_TAGS.has(node.tag);
  if (selfClosing) return `<${node.tag}${attrs ? ' '+attrs : ''} />`;
  return `<${node.tag}${attrs ? ' '+attrs : ''}>${children}</${node.tag}>`;
}

function toAttrs(tag, attrs, style, inlineMode){
  const out = [];
  for (const [k0,v0] of Object.entries(attrs)){
    if (/^on/i.test(k0)) continue; // inline events removed
    const { key, value, isBool } = mapAttr(tag, k0, v0);
    if (key === null) continue;
    if (isBool) out.push(`${key}={true}`); else out.push(`${key}="${escapeHtml(value)}"`);
  }
  if (inlineMode && style) {
    const styleProp = styleToProp(style);
    if (styleProp) out.push(`style={{${styleProp}}}`);
  }
  return out.join(' ');
}

function escapeHtml(s=''){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function detectRepeats(tree){
  if (!tree || tree.type !== 'element') return null;
  const childEls = (tree.children||[]).filter(c=>c.type==='element');
  const groups = new Map();
  for (const c of childEls){
    const key = c.signature || (c.tag + JSON.stringify(Object.keys(c.attrs||{})));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  let best = null; let bestKey=null;
  for (const [k,arr] of groups){ if (arr.length >= 2 && (!best || arr.length > best.count)) { best = { count: arr.length, sample: arr[0] }; bestKey=k; } }
  return best;
}

function guessName(node){
  const cls = (node.attrs?.class||'').toLowerCase();
  if (cls.includes('card')) return 'Card';
  if (cls.includes('item')) return 'Item';
  if (cls.includes('nav')) return 'Navbar';
  return capitalize(node.tag);
}

function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

// --- Helpers: JSX sanitation ---
const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

function mapAttr(tag, k, v){
  let key = k;
  let value = v ?? '';
  let isBool = false;
  if (k === 'class') key = 'className';
  else if (k === 'for') key = 'htmlFor';
  else if (k === 'autocomplete') key = 'autoComplete';
  else if (k === 'tabindex') key = 'tabIndex';
  else if (k === 'crossorigin') key = 'crossOrigin';
  else if (k === 'novalidate') { key = 'noValidate'; isBool = true; }
  else if (k === 'contenteditable') key = 'contentEditable';
  else if (k === 'autofocus') { key = 'autoFocus'; isBool = true; }
  else if (k === 'readonly') { key = 'readOnly'; isBool = true; }
  else if (k === 'muted') { key = 'muted'; isBool = true; }
  else if (k === 'playsinline') { key = 'playsInline'; isBool = true; }
  else if (k === 'checked') {
    key = (tag === 'input') ? 'defaultChecked' : 'checked';
    isBool = true;
  }
  else if (k === 'srcset') { key = 'srcSet'; }
  else if (k.startsWith('aria-')) { key = k; }
  else if (k === 'role') { key = 'role'; }
  return { key, value, isBool };
}

function sanitizeHtmlToJsx(html){
  let s = html.replace(/class=/g,'className=');
  s = s.replace(/\son[a-z]+=\"[^\"]*\"/gi,'');
  s = s.replace(/<(img|input|br|hr|meta|link)([^>]*)>/gi, (m,tag,attrs) => `<${tag}${attrs} />`);
  s = s.replace(/\bfor=/g,'htmlFor=').replace(/autocomplete=/g,'autoComplete=').replace(/tabindex=/g,'tabIndex=');
  s = s.replace(/\schecked(=\"\")?/gi,' defaultChecked');
  s = s.replace(/target=\"_blank\"/gi, 'target="_blank" rel="noopener noreferrer"');
  return s;
}

// --- Section splitter ---
function splitIntoSections(root, handlers){
  const sections = {};
  walk(root, node => {
    const cls = (node.attrs?.class||'').toLowerCase();
    if (!sections.Header && (cls.includes('site-header') || cls.includes('header'))) sections.Header = node;
    if (!sections.Navbar && (cls.includes('navbar') || cls.includes('topbar'))) sections.Navbar = node;
    if (!sections.SearchBar && (cls.includes('searcharea') || cls.includes('search-bar') || cls.includes('topnavbarform') || cls.includes('search'))) sections.SearchBar = node;
    if (!sections.LanguageSelector && (cls.includes('languageselector') || cls.includes('language-selector'))) sections.LanguageSelector = node;
    if (!sections.SocialMedia && (cls.includes('social-media') || cls.includes('social'))) sections.SocialMedia = node;
    if (!sections.Menu && cls.includes('menu')) sections.Menu = node;
    if (!sections.Footer && cls.includes('footer')) sections.Footer = node;
    if (!sections.Sidebar && (cls.includes('sidebar') || cls.includes('aside'))) sections.Sidebar = node;
  });
  const order = [];
  const components = {};
  for (const [name, node] of Object.entries(sections)){
    if (!node) continue;
    const jsx = toJsx(node);
    components[`${name}.jsx`] = wrapAsComponent(name, jsx, handlers);
    order.push(name);
  }
  if (!order.length) return null;
  const extras = buildListComponents(root, handlers);
  Object.assign(components, extras.components);
  order.push(...extras.order);
  return { components, order };
}

function walk(node, fn){
  fn(node);
  (node.children||[]).forEach(c => { if (c && typeof c === 'object') walk(c, fn); });
}

function buildListComponents(root, handlers){
  const components = {};
  const order = [];
  walk(root, parent => {
    if (parent.type !== 'element') return;
    const kids = (parent.children||[]).filter(c=>c.type==='element');
    if (kids.length < 2) return;
    const sig = (n)=> (n.tag + '|' + (n.attrs?.class||''));
    const groups = kids.reduce((m,k)=>{ const s=sig(k); (m[s]||(m[s]=[])).push(k); return m; }, {});
    for (const arr of Object.values(groups)){
      if (arr.length < 3) continue; // repeated when >=3
      const sample = arr[0];
      const compName = guessName(sample)+'Item';
      const propMap = inferProps(sample);
      const compJsx = toJsxWithProps(sample, propMap);
      components[`${compName}.jsx`] = componentFromJsx(compName, compJsx, handlers);
      const dataName = compName.charAt(0).toLowerCase()+compName.slice(1)+'Data';
      const data = arr.map(n => extractData(n, propMap));
      const mapExpr = `{${dataName}.map((it,i)=> <${compName} key={i} ${Object.keys(propMap).map(p=>`${p}={it.${p}}`).join(' ')} />)}`;
      order.push(`/* data for ${compName} */\nconst ${dataName} = ${JSON.stringify(data, null, 2)};\n<div className=\"converted-list\">${mapExpr}</div>`);
    }
  });

  // Second pass: nested grandchildren patterns
  walk(root, parent => {
    if (parent.type !== 'element') return;
    const grandKids = [];
    for (const child of (parent.children||[])){
      if (child.type==='element') grandKids.push(...(child.children||[]).filter(c=>c.type==='element'));
    }
    if (grandKids.length < 3) return;
    const sig = (n)=> (n.tag + '|' + (n.attrs?.class||''));
    const groups = grandKids.reduce((m,k)=>{ const s=sig(k); (m[s]||(m[s]=[])).push(k); return m; }, {});
    for (const arr of Object.values(groups)){
      if (arr.length < 4) continue; // require more repeats deeper
      const sample = arr[0];
      const compName = guessName(sample)+'DeepItem';
      if (components[`${compName}.jsx`]) continue;
      const propMap = inferProps(sample);
      const compJsx = toJsxWithProps(sample, propMap);
      components[`${compName}.jsx`] = componentFromJsx(compName, compJsx, handlers);
      const dataName = compName.charAt(0).toLowerCase()+compName.slice(1)+'Data';
      const data = arr.map(n => extractData(n, propMap));
      const mapExpr = `{${dataName}.map((it,i)=> <${compName} key={i} ${Object.keys(propMap).map(p=>`${p}={it.${p}}`).join(' ')} />)}`;
      order.push(`/* data for ${compName} (deep) */\nconst ${dataName} = ${JSON.stringify(data, null, 2)};\n<div className=\"converted-list converted-list--deep\">${mapExpr}</div>`);
    }
  });
  return { components, order };
}

function inferProps(node){
  const props = new Set();
  if (node.attrs?.href) props.add('href');
  if (node.attrs?.src) props.add('src');
  if (node.attrs?.alt) props.add('alt');
  if (node.attrs?.title) props.add('title');
  if (node.attrs?.value) props.add('value');
  const text = findFirstText(node);
  if (text) props.add('label');
  return Array.from(props);
}

function toJsxWithProps(node, propList){
  const propSet = new Set(propList);
  function render(n){
    if (n.type==='text'){
      if (propSet.has('label')) { propSet.delete('label'); return '{label}'; }
      return escapeHtml(n.text);
    }
    const attrs = {...(n.attrs||{})};
    if (propSet.has('href') && attrs.href) attrs.href = '{href}';
    if (propSet.has('src') && attrs.src) attrs.src = '{src}';
    if (propSet.has('alt') && attrs.alt) attrs.alt = '{alt}';
    if (propSet.has('title') && attrs.title) attrs.title = '{title}';
    if (propSet.has('value') && attrs.value) attrs.value = '{value}';
    const attrStr = toAttrs(n.tag, attrs, null, false).replace(/\"\{/g,'{').replace(/\}\"/g,'}');
    const children = (n.children||[]).map(render).join('');
    const selfClosing = VOID_TAGS.has(n.tag);
    if (selfClosing) return `<${n.tag}${attrStr? ' '+attrStr:''} />`;
    return `<${n.tag}${attrStr? ' '+attrStr:''}>${children}</${n.tag}>`;
  }
  return render(node);
}

function componentFromJsx(name, bodyJsx, handlers){
  const handlerFns = handlers.map(h=>`function ${h.name}(e){/* original: ${escapeJs(h.original)} */}`).join('\n');
  return `import React from 'react';\n${handlerFns}\nexport default function ${name}(props){\n  const { href, src, alt, title, value, label } = props;\n  return (<>${bodyJsx}</>);\n}`;
}

function extractData(node, propList){
  const out = {};
  if (propList.includes('href') && node.attrs?.href) out.href = node.attrs.href;
  if (propList.includes('src') && node.attrs?.src) out.src = node.attrs.src;
  if (propList.includes('alt') && node.attrs?.alt) out.alt = node.attrs.alt;
  if (propList.includes('title') && node.attrs?.title) out.title = node.attrs.title;
  if (propList.includes('value') && node.attrs?.value) out.value = node.attrs.value;
  if (propList.includes('label')) out.label = collectText(node).trim();
  return out;
}

function collectText(node){
  if (node.type==='text') return node.text||'';
  return (node.children||[]).map(collectText).join(' ');
}

function findFirstText(node){
  if (node.type==='text') return node.text?.trim();
  for (const c of (node.children||[])){
    const t = findFirstText(c);
    if (t) return t;
  }
  return '';
}

// Convert minimal CSS style object to JSX style prop string: backgroundColor:'red', width:'100px'
function styleToProp(style){
  const entries = Object.entries(style || {}).filter(([,v]) => v && v !== 'auto' && v !== '0px' && v !== 'none');
  if (!entries.length) return '';
  return entries.map(([k,v]) => `${k}: '${String(v)}'`).join(', ');
}

// Improve selects: defaultValue inferred from selected option
function postProcessSelects(tree){
  walk(tree, node => {
    if (node.type==='element' && node.tag==='select'){
      const sel = (node.children||[]).find(c=>c.type==='element' && c.tag==='option' && c.attrs && ('selected' in c.attrs));
      if (sel){
        node.attrs = node.attrs || {};
        node.attrs.defaultValue = sel.attrs.value || collectText(sel).trim();
        delete sel.attrs.selected;
      }
    }
  });
}

// content.js - injected into pages to allow user to select elements and send DOM snapshot
(function(){
  let selecting = false;
  let hoverEl = null;
  const overlayCss = `#react-converter-overlay{position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:2147483647;} .react-converter-highlight{outline:2px solid #3b82f6; background:rgba(59,130,246,0.15);}`;
  if (!document.getElementById('react-converter-style')) {
    const style = document.createElement('style');
    style.id = 'react-converter-style';
    style.textContent = overlayCss;
    document.head.appendChild(style);
  }
  const overlay = document.createElement('div');
  overlay.id = 'react-converter-overlay';
  document.documentElement.appendChild(overlay);

  function enableSelection() { selecting = true; document.body.style.cursor = 'crosshair'; }
  function disableSelection() { selecting = false; document.body.style.cursor = ''; clearHighlight(); }
  function highlight(el) {
    clearHighlight();
    hoverEl = el;
    el.classList.add('react-converter-highlight');
  }
  function clearHighlight(){ if (hoverEl){ hoverEl.classList.remove('react-converter-highlight'); hoverEl=null; } }

  document.addEventListener('mousemove', e => {
    if (!selecting) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el !== hoverEl) highlight(el);
  }, true);

  document.addEventListener('click', e => {
    if (!selecting) return;
    e.preventDefault(); e.stopPropagation();
    selecting = false; document.body.style.cursor='';
    const target = hoverEl || e.target;
    clearHighlight();
    const snapshot = serializeSubtree(target);
    chrome.runtime.sendMessage({ type: 'ELEMENT_CAPTURED', payload: snapshot }, resp => {
      // Optionally handle response
      console.log('React conversion project', resp);
    });
  }, true);

  function serializeSubtree(root) {
    const html = root.outerHTML;
    const cssRules = collectCssRules(root);
    const jsEvents = collectJsEvents(root);
    const tree = buildTree(root, true);
    return { html, cssRules, jsEvents, tree };
  }

  function buildTree(node, includeStyles){
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent.trim();
      if (!t) return null;
      return { type:'text', text: t };
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style') return null;
    const attrs = {};
    for (const attr of Array.from(node.attributes)) {
      attrs[attr.name] = attr.value;
    }
    // Inline style extraction (minimal) when option toggled later; store computed for generator to decide
    let style = null;
    try {
      const cs = getComputedStyle(node);
      style = {
        display: cs.display,
        position: cs.position,
        flexDirection: cs.flexDirection,
        justifyContent: cs.justifyContent,
        alignItems: cs.alignItems,
        gap: cs.gap,
        width: cs.width,
        height: cs.height,
        margin: `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`,
        padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        border: cs.border,
        borderRadius: cs.borderRadius,
        boxShadow: cs.boxShadow,
        overflow: cs.overflow,
        zIndex: cs.zIndex,
        transform: cs.transform !== 'none' ? cs.transform : undefined
      };
    } catch {}
    const children = [];
    for (const child of Array.from(node.childNodes)) {
      const c = buildTree(child, includeStyles);
      if (c) children.push(c);
    }
    const signature = tag + '#' + (attrs.id||'') + '.' + (attrs.class||'');
    return { type:'element', tag, attrs, children, signature, style };
  }

  function collectCssRules(root) {
    const classNames = new Set();
    root.querySelectorAll('*').forEach(el => el.classList.forEach(c=>classNames.add(c)));
    const matches = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        if (rule.selectorText) {
          for (const c of classNames) {
            if (rule.selectorText.includes('.'+c)) {
              matches.push(rule.cssText);
              break;
            }
          }
        }
      }
    }
    return matches;
  }

  function collectJsEvents(root) {
    // Heuristic: scan attributes beginning with on and data-*
    const events = [];
    root.querySelectorAll('*').forEach(el => {
      for (const attr of Array.from(el.attributes)) {
        if (/^on[a-z]+/i.test(attr.name)) {
          events.push({ type: attr.name.slice(2), handlerSource: attr.value });
        }
        if (/^data-/i.test(attr.name)) {
          events.push({ type: 'data', name: attr.name, value: attr.value });
        }
      }
    });
    return events;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'START_SELECTION') {
      enableSelection();
      // Send a small acknowledgement back (optional)
      try { chrome.runtime.sendMessage({ type: 'SELECTION_MODE_ENABLED' }); } catch(e) {}
    }
  });
})();
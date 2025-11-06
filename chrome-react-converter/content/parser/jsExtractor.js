// jsExtractor.js - extract inline event handlers and data attributes into React-friendly stubs
export function extractHandlers(events){
  const handlers = [];
  for (const e of events) {
    if (e.type === 'data') continue;
    const name = 'handle' + e.type.charAt(0).toUpperCase()+e.type.slice(1);
    handlers.push({ name, original: e.handlerSource });
  }
  // Deduplicate by name
  const map = new Map();
  for (const h of handlers) if (!map.has(h.name)) map.set(h.name, h);
  return Array.from(map.values());
}

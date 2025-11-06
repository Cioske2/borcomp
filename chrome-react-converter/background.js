// background.js - handles messages, parsing pipeline, generation, and zip export
// In MV3 module service worker context (type: module)
import { generateReactProject } from './content/parser/reactGenerator.js';

const state = {
  lastSelection: null,
  generatedProject: null,
  options: {
    cssMode: 'external', // 'external' | 'inline'
    framework: 'react', // future: 'next' | 'vite'
  }
};

// Utility: send message to all tabs (debug)
async function broadcast(type, payload) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { type, payload }).catch(()=>{});
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case 'ELEMENT_CAPTURED': {
        state.lastSelection = msg.payload; // raw DOM snapshot
        try {
          const project = await buildReactProject(state.lastSelection, state.options);
          state.generatedProject = project;
          sendResponse({ ok: true, project });
          if (state.options.autoPreview) {
            chrome.tabs.create({ url: chrome.runtime.getURL('popup/viewer.html'), active: true });
          }
        } catch (err) {
          console.error('Generation error:', err);
          sendResponse({ ok: false, error: String(err) });
        }
        break;
      }
      case 'REQUEST_PREVIEW': {
        sendResponse({ project: state.generatedProject });
        break;
      }
      case 'SET_OPTIONS': {
        state.options = { ...state.options, ...msg.payload };
        sendResponse({ ok: true });
        break;
      }
      case 'DOWNLOAD_ZIP': {
        if (!state.generatedProject) {
          sendResponse({ ok: false, error: 'Nothing generated yet' });
          break;
        }
        const dataUrl = await createZipAndGetDataUrl(state.generatedProject);
        await chrome.downloads.download({ url: dataUrl, filename: 'react-converted.zip' });
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
  })();
  return true; // keep channel open for async response
});

async function buildReactProject(selection, options) {
  // selection: { html, cssRules, jsEvents }
  const files = await generateReactProject(selection, options);
  // If suggestions exist, also emit a SUGGESTIONS.md file summarizing them
  if (files?.meta?.suggestions?.length) {
    const lines = ['# Component Suggestions', '', 'Riconoscimenti automatici dai plugin (Bootstrap, Tailwind, MUI):', ''];
    for (const s of files.meta.suggestions) {
      lines.push(`- [${s.framework}] ${s.component} (confidence: ${Math.round((s.confidence||0)*100)}%) — ${s.reason || ''}`);
    }
    files['SUGGESTIONS.md'] = lines.join('\n');
  }
  return files;
}

async function createZipAndGetDataUrl(projectFiles) {
  // Lightweight ZIP (store, no compression)
  const encoder = new TextEncoder();
  const filesArray = [];
  const central = [];
  let offset = 0;

  function u16(n){ return new Uint8Array([n & 0xFF, (n>>8)&0xFF]); }
  function u32(n){ return new Uint8Array([n & 0xFF, (n>>8)&0xFF, (n>>16)&0xFF, (n>>24)&0xFF]); }
  function concat(...arrays){
    const total = arrays.reduce((s,a)=>s + a.length, 0);
    const out = new Uint8Array(total);
    let i=0; for(const a of arrays){ out.set(a, i); i += a.length; }
    return out;
  }

  // CRC32 implementation
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();
  function crc32(buf){
    let c = 0 ^ (-1);
    for (let i=0;i<buf.length;i++) c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xFF];
    return (c ^ (-1)) >>> 0;
  }

  function addOne(filename, text){
  const nameBytes = encoder.encode(filename);
  const data = encoder.encode(text);
  const crc = crc32(data);
    const localHeader = concat(
      new Uint8Array([0x50,0x4b,0x03,0x04]),
      u16(20), // version
      u16(0), // flags
      u16(0), // method store
      u16(0), u16(0), // time/date
      u32(crc),
      u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0),
      nameBytes,
      data
    );
    filesArray.push(localHeader);

    const centralHeader = concat(
      new Uint8Array([0x50,0x4b,0x01,0x02]),
      u16(20), u16(20), u16(0), u16(0),
      u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(offset),
      nameBytes
    );
    central.push(centralHeader);
    offset += localHeader.length;
  }

  for (const [name, content] of Object.entries(projectFiles)) {
    if (name === 'components') {
      for (const [cName, cContent] of Object.entries(content)) {
        if (typeof cContent === 'string') addOne(`components/${cName}`, cContent);
      }
      continue;
    }
    if (name === 'meta') continue; // do not include raw meta object
    if (typeof content !== 'string') {
      try { addOne(name, JSON.stringify(content, null, 2)); } catch { /* skip */ }
      continue;
    }
    addOne(name, content);
  }

  const centralSize = central.reduce((s, b) => s + b.length, 0);
  const cdOffset = offset;
  const entries = central.length;
  const end = concat(
    new Uint8Array([0x50,0x4b,0x05,0x06]),
    u16(0), u16(0), u16(entries), u16(entries),
    u32(centralSize), u32(cdOffset), u16(0)
  );
  const blob = new Blob([...filesArray, ...central, end], { type: 'application/zip' });
  // MV3 service worker may not expose URL.createObjectURL; convert to data URL
  function blobToDataUrl(b){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(b);
    });
  }
  return await blobToDataUrl(blob);
}

// Backward-compat: if some caller still invokes the old name, return a data URL (also accepted by chrome.downloads)
async function createZipAndGetBlobUrl(projectFiles) {
  return await createZipAndGetDataUrl(projectFiles);
}
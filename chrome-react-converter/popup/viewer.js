// viewer.js - standalone preview page opened automatically after capture
const preview = document.getElementById('preview');
const componentsList = document.getElementById('components');
const btnCopyApp = document.getElementById('btn-copy-app');
const btnDownload = document.getElementById('btn-download');
const suggestionsList = document.getElementById('suggestions');
const compCode = document.getElementById('component-code');
let latestProject = null;

async function loadProject(){
  try{
    const resp = await chrome.runtime.sendMessage({ type: 'REQUEST_PREVIEW' });
    const project = resp?.project;
    if (!project){
      preview.textContent = 'Nessun progetto generato.';
      return;
    }
    latestProject = project;
    preview.textContent = project['App.jsx'] || '';
    // Suggestions
    suggestionsList.innerHTML = '';
    const sugg = project?.meta?.suggestions || [];
    for (const s of sugg){
      const li = document.createElement('li');
      const pct = Math.round((s.confidence||0)*100);
      li.textContent = `[${s.framework}] ${s.component} (${pct}%) — ${s.reason||''}`;
      suggestionsList.appendChild(li);
    }
    componentsList.innerHTML = '';
    const comps = project.components || {};
    Object.keys(comps).forEach(name => {
      const li = document.createElement('li');
      li.textContent = name;
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        compCode.textContent = latestProject?.components?.[name] || '// componente non trovato';
      });
      componentsList.appendChild(li);
    });
    // Auto-select the first component if available
    const first = Object.keys(comps)[0];
    if (first) compCode.textContent = project.components[first];
  }catch(err){
    console.error('Errore REQUEST_PREVIEW', err);
    preview.textContent = 'Errore durante il caricamento dell\'anteprima.';
  }
}

btnCopyApp.addEventListener('click', async () => {
  const text = preview.textContent || '';
  try{ await navigator.clipboard.writeText(text); }
  catch(err){ console.error('Clipboard error', err); }
});

btnDownload.addEventListener('click', async ()=>{
  try { await chrome.runtime.sendMessage({ type: 'DOWNLOAD_ZIP' }); }
  catch(err){ console.error('DOWNLOAD_ZIP error', err); }
});

loadProject();

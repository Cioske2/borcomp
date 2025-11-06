// popup.js - controls for selection & export
const btnSelect = document.getElementById('btn-select');
const btnPreview = document.getElementById('btn-preview');
const btnDownload = document.getElementById('btn-download');
const preview = document.getElementById('preview');
const componentsList = document.getElementById('components');

function getOptions(){
  const cssMode = document.querySelector('input[name="cssmode"]:checked')?.value || 'external';
  const autoPreview = document.getElementById('auto-preview')?.checked ?? true;
  return { cssMode, autoPreview };
}

btnSelect.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.runtime.sendMessage({ type: 'SET_OPTIONS', payload: getOptions() });
  try {
    // Try to message the content script in the active tab. This will fail on chrome:// pages
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'START_SELECTION' });
    // If no error thrown, consider success even if resp undefined (content script may not reply)
    window.close();
  } catch (err) {
    console.error('Errore invio START_SELECTION', err);
    alert('Errore: impossibile avviare la selezione nella scheda corrente.\nControlla la console del service worker per dettagli e assicurati di usare una pagina web normale (non chrome://).');
  }
});

btnPreview.addEventListener('click', async () => {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'REQUEST_PREVIEW' });
    renderPreview(resp?.project);
  } catch (err) {
    console.error('Errore REQUEST_PREVIEW', err);
    preview.textContent = 'Impossibile richiedere l\'anteprima: controlla la console del service worker.';
  }
});

btnDownload.addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: 'DOWNLOAD_ZIP' });
  } catch (err) {
    console.error('Errore DOWNLOAD_ZIP', err);
    alert('Impossibile richiedere il download: controlla la console del service worker.');
  }
});

function renderPreview(project){
  if (!project) { preview.textContent = 'Nessun progetto generato. Usa "Seleziona elemento" prima.'; componentsList.innerHTML=''; return; }
  preview.textContent = project['App.jsx'] || '';
  componentsList.innerHTML = '';
  const comps = project.components || {};
  Object.keys(comps).forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    componentsList.appendChild(li);
  });
}

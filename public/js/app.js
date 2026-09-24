const API_BASE = '/api';

const state = {
  files: [],
  activeCategory: '',
  searchTerm: '',
  selectedFile: null
};

// -------------------- Utilities --------------------
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return document.querySelectorAll(sel); }

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('is-error', isError);
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 3200);
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// -------------------- Loading & rendering files --------------------
async function loadFiles() {
  try {
    const params = new URLSearchParams();
    if (state.activeCategory) params.set('category', state.activeCategory);
    if (state.searchTerm) params.set('search', state.searchTerm);
    state.files = await api(`/files?${params.toString()}`);
    renderCategories();
    renderFileGrid();
  } catch (err) {
    showToast(err.message, true);
  }
}

function renderCategories() {
  const list = $('#categoryList');
  const cats = {};
  state.files.forEach((f) => { cats[f.category || 'Uncategorized'] = (cats[f.category || 'Uncategorized'] || 0) + 1; });

  $('#countAll').textContent = state.files.length;

  list.querySelectorAll('.category-item:not([data-category=""])').forEach((el) => el.remove());
  Object.keys(cats).sort().forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = 'category-item' + (state.activeCategory === cat ? ' is-active' : '');
    btn.dataset.category = cat;
    btn.innerHTML = `<span class="dot" style="background:var(--ink-300)"></span> ${escapeHtml(cat)} <span class="count">${cats[cat]}</span>`;
    btn.addEventListener('click', () => selectCategory(cat));
    list.appendChild(btn);
  });

  list.querySelector('[data-category=""]').classList.toggle('is-active', state.activeCategory === '');
}

function selectCategory(cat) {
  state.activeCategory = cat;
  $('#mainTitle').textContent = cat || 'All files';
  $('#mainSubtitle').textContent = cat ? `Files shelved under "${cat}".` : "Everything you've added to the knowledge base.";
  loadFiles();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function renderFileGrid() {
  const grid = $('#fileGrid');
  const empty = $('#emptyState');
  grid.innerHTML = '';

  if (!state.files.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  state.files.forEach((file) => {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.innerHTML = `
      <div class="file-card-top">
        <div class="file-card-title">${escapeHtml(file.original_name)}</div>
        <span class="file-type-pill">${escapeHtml((file.file_type || 'file').toUpperCase())}</span>
      </div>
      <div class="file-card-summary">${escapeHtml(file.summary) || (file.extraction_status === 'processing' ? 'Processing…' : 'No summary available for this file type.')}</div>
      <div class="file-card-bottom">
        <span>${formatBytes(file.file_size)} · ${formatDate(file.uploaded_at)}</span>
        <span class="status-tag status-${file.extraction_status}">${statusLabel(file.extraction_status)}</span>
      </div>
    `;
    card.addEventListener('click', () => openFileDrawer(file.id));
    grid.appendChild(card);
  });
}

function statusLabel(status) {
  return { done: 'Indexed', processing: 'Processing', unsupported: 'No text', failed: 'Failed', pending: 'Queued' }[status] || status;
}

// -------------------- File drawer --------------------
async function openFileDrawer(id) {
  try {
    const file = await api(`/files/${id}`);
    state.selectedFile = file;

    $('#drawerCategory').textContent = file.category || 'Uncategorized';
    $('#drawerFileName').textContent = file.original_name;
    $('#drawerSummary').textContent = file.summary || 'No summary available for this file. It may not contain extractable text, or an API key may not be configured.';
    $('#drawerMeta').innerHTML = `
      <span>${(file.file_type || '').toUpperCase()}</span>
      <span>${formatBytes(file.file_size)}</span>
      <span>Uploaded ${formatDate(file.uploaded_at)}</span>
      <span class="status-tag status-${file.extraction_status}">${statusLabel(file.extraction_status)}</span>
    `;

    const kpList = $('#drawerKeyPoints');
    kpList.innerHTML = '';
    const points = Array.isArray(file.key_points) ? file.key_points : [];
    if (points.length) {
      points.forEach((p) => {
        const li = document.createElement('li');
        li.textContent = p;
        kpList.appendChild(li);
      });
    } else {
      kpList.innerHTML = '<li class="muted">No key points generated yet.</li>';
    }

    $('#drawerContent').textContent = file.extracted_text || 'No extracted text available for this file type.';

    switchDrawerTab('overview');
    $('#fileDrawerBackdrop').hidden = false;

    if (window.initFileChat) window.initFileChat(file.id);
  } catch (err) {
    showToast(err.message, true);
  }
}

function switchDrawerTab(tab) {
  $all('.drawer-tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === tab));
  $all('.tab-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === tab));
}

$all('.drawer-tab').forEach((tab) => tab.addEventListener('click', () => switchDrawerTab(tab.dataset.tab)));

$('#closeDrawerBtn').addEventListener('click', () => { $('#fileDrawerBackdrop').hidden = true; });
$('#fileDrawerBackdrop').addEventListener('click', (e) => { if (e.target === $('#fileDrawerBackdrop')) $('#fileDrawerBackdrop').hidden = true; });

$('#downloadFileBtn').addEventListener('click', () => {
  if (state.selectedFile) window.open(`${API_BASE}/files/${state.selectedFile.id}/download`, '_blank');
});

$('#deleteFileBtn').addEventListener('click', async () => {
  if (!state.selectedFile) return;
  if (!confirm(`Delete "${state.selectedFile.original_name}"? This can't be undone.`)) return;
  try {
    await api(`/files/${state.selectedFile.id}`, { method: 'DELETE' });
    $('#fileDrawerBackdrop').hidden = true;
    showToast('File deleted');
    loadFiles();
  } catch (err) {
    showToast(err.message, true);
  }
});

// -------------------- Upload modal --------------------
let pendingFile = null;

function openUploadModal() {
  pendingFile = null;
  $('#uploadForm').reset();
  $('#dropzoneLabel').textContent = 'Click to choose a file, or drag one here';
  $('#uploadStatus').textContent = '';
  $('#uploadModal').hidden = false;
}
function closeUploadModal() { $('#uploadModal').hidden = true; }

$('#openUploadBtn').addEventListener('click', openUploadModal);
$('#emptyUploadBtn').addEventListener('click', openUploadModal);
$('#closeUploadModal').addEventListener('click', closeUploadModal);
$('#cancelUploadBtn').addEventListener('click', closeUploadModal);
$('#uploadModal').addEventListener('click', (e) => { if (e.target === $('#uploadModal')) closeUploadModal(); });

const dropzone = $('#dropzone');
const fileInput = $('#fileInput');
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) {
    pendingFile = fileInput.files[0];
    $('#dropzoneLabel').textContent = pendingFile.name;
  }
});
['dragover', 'dragenter'].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('is-dragover'); }));
['dragleave', 'drop'].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('is-dragover'); }));
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) {
    pendingFile = file;
    $('#dropzoneLabel').textContent = file.name;
  }
});

$('#uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!pendingFile) { showToast('Choose a file first', true); return; }

  const formData = new FormData();
  formData.append('file', pendingFile);
  formData.append('category', $('#categoryInput').value.trim() || 'Uncategorized');
  formData.append('tags', $('#tagsInput').value.trim());

  const submitBtn = $('#submitUploadBtn');
  submitBtn.disabled = true;
  $('#uploadStatus').textContent = 'Uploading and analyzing content — this may take a moment…';

  try {
    await api('/files/upload', { method: 'POST', body: formData });
    showToast('File added to the archive');
    closeUploadModal();
    loadFiles();
  } catch (err) {
    $('#uploadStatus').textContent = '';
    showToast(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

// -------------------- Search --------------------
let searchDebounce;
$('#searchInput').addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.searchTerm = e.target.value.trim();
    loadFiles();
  }, 350);
});

// -------------------- Category "All files" click --------------------
$('#categoryList').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-category=""]');
  if (btn) selectCategory('');
});

// -------------------- Init --------------------
loadFiles();

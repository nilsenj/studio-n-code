/* Original Studio Git UI. Repository data arrives from the bundled Git API. */
(() => {
  const api = acquireVsCodeApi();
  const state = api.getState() || { selected: [], message: '', amend: false, query: '' };
  let snapshot;
  let selectedCommit;
  let details;
  let busy = false;
  const kind = document.body.dataset.kind;
  const app = document.getElementById('app');
  const send = (type, extra = {}) => { if (['commit','fetch','pull','push','refresh'].includes(type)) { success.hidden = true; showError(''); } api.postMessage({ type, ...extra }); };
  const persist = () => api.setState(state);
  function el(tag, cls, text) { const element = document.createElement(tag); if (cls) element.className = cls; if (text !== undefined) element.textContent = text; return element; }
  function button(text, title, action, cls = '') { const element = el('button', cls, text); element.title = title; element.setAttribute('aria-label', title); element.onclick = action; return element; }
  const error = el('div', 'error'); error.setAttribute('role', 'alert');
  const success = el('div', 'success'); success.setAttribute('role', 'status'); success.hidden = true;
  function showError(text) { if (text) success.hidden = true; error.textContent = text; error.classList.toggle('visible', !!text); }
  function preserveInteraction(render) {
    const focused = document.activeElement;
    const key = focused?.dataset.focusKey;
    const selection = key && typeof focused.selectionStart === 'number' ? [focused.selectionStart, focused.selectionEnd] : null;
    const scroll = ['.changes-scroll', '.history', '.branches', '.details'].map(selector => [selector, document.querySelector(selector)?.scrollTop || 0]);
    render();
    for (const [selector, top] of scroll) { const target = document.querySelector(selector); if (target) target.scrollTop = top; }
    if (key) {
      const target = [...document.querySelectorAll('[data-focus-key]')].find(element => element.dataset.focusKey === key);
      if (target) { target.focus({ preventScroll: true }); if (selection) target.setSelectionRange(...selection); }
    }
  }
  function renderCommit() { preserveInteraction(renderCommitContent); }
  function renderLog() { preserveInteraction(renderLogContent); }
  function repoSelector(toolbar) {
    if ((snapshot?.repositories.length || 0) > 1) {
      const select = el('select'); select.setAttribute('aria-label', 'Repository');
      for (const repo of snapshot.repositories) { const option = el('option', '', repo.name); option.value = repo.id; select.append(option); }
      select.value = snapshot.repository; select.onchange = () => { state.selected = []; send('repository', { id: select.value }); }; toolbar.append(select);
    }
  }
  function renderCommitContent() {
    app.replaceChildren();
    const layout = el('main', 'commit-layout'); app.append(layout);
    const toolbar = el('div', 'toolbar'); layout.append(toolbar);
    toolbar.append(button('↻', 'Refresh Changes', () => send('refresh')), button('↗', 'Open Git Log (Alt+9)', () => send('openLog')));
    repoSelector(toolbar); toolbar.append(el('span', 'spacer'), el('span', 'muted', snapshot?.branch || ''));
    layout.append(error);
    layout.append(success);
    const scroll = el('div', 'changes-scroll'); layout.append(scroll);
    if (snapshot?.noRepository) { scroll.append(el('div', 'empty', 'Open a project with a Git repository to view its changes.')); return; }
    const files = snapshot?.changes || [];
    const known = new Set(files.map(file => file.path));
    state.selected = state.selected.filter(file => known.has(file));
    if (!state.initialized && files.length) { state.selected = files.map(file => file.path); state.initialized = true; }
    const heading = el('label', 'section-title'); const all = el('input'); all.type = 'checkbox'; all.checked = files.length > 0 && state.selected.length === files.length; all.indeterminate = state.selected.length > 0 && !all.checked;
    all.onchange = () => { state.selected = all.checked ? files.map(file => file.path) : []; persist(); renderCommit(); };
    heading.append(all, el('span', '', `Changes (${files.length})`)); scroll.append(heading);
    if (!files.length) scroll.append(el('div', 'empty', 'No changes detected.'));
    for (const file of files) {
      const row = el('div', 'file-row'); row.dataset.status = file.status;
      const check = el('input'); check.type = 'checkbox'; check.checked = state.selected.includes(file.path); check.setAttribute('aria-label', `Include ${file.relativePath}`);
      check.dataset.focusKey = `file:${file.path}`;
      check.onchange = () => { state.selected = check.checked ? [...state.selected, file.path] : state.selected.filter(item => item !== file.path); persist(); renderCommit(); };
      const name = file.relativePath.split('/').at(-1); const directory = file.relativePath.slice(0, -(name.length + 1));
      const label = el('span', 'file-name', name); label.title = file.relativePath; label.onclick = () => send('openChange', { path: file.path });
      row.append(check, label); if (directory) row.append(el('span', 'file-dir', directory)); row.append(el('span', 'status', file.conflict ? 'Conflict' : file.status));
      row.ondblclick = () => send('openChange', { path: file.path }); scroll.append(row);
    }
    const form = el('div', 'commit-form'); const amendLabel = el('label', 'amend'); const amend = el('input'); amend.type = 'checkbox'; amend.checked = state.amend; amend.onchange = () => { state.amend = amend.checked; persist(); };
    amendLabel.append(amend, document.createTextNode('Amend')); form.append(amendLabel);
    const message = el('textarea'); message.dataset.focusKey = 'commit-message'; message.placeholder = 'Commit message'; message.setAttribute('aria-label', 'Commit message'); message.value = state.message; message.oninput = () => { state.message = message.value; persist(); commit.disabled = busy || !state.selected.length || !state.message.trim(); }; form.append(message);
    const count = el('div', 'selection-count', `${state.selected.length} of ${files.length} files selected`); form.append(count);
    const footer = el('div', 'commit-footer');
    const commit = button(busy ? 'Committing…' : 'Commit', 'Commit Selected Files', () => {
      busy = true; showError(''); commit.disabled = true; commit.textContent = 'Committing…'; send('commit', { paths: state.selected, message: state.message, amend: state.amend });
    }, 'primary');
    commit.disabled = busy || !state.selected.length || !state.message.trim();
    footer.append(commit, button('Push…', 'Push Commits', () => send('push'), 'secondary')); form.append(footer); layout.append(form); persist();
  }

  function renderLogContent() {
    app.replaceChildren(); const layout = el('main', 'log-layout'); app.append(layout);
    const toolbar = el('div', 'toolbar'); layout.append(toolbar);
    const search = el('input', 'log-search'); search.placeholder = '⌕  Text or hash'; search.setAttribute('aria-label', 'Filter commit history'); search.value = state.query;
    search.dataset.focusKey = 'history-search';
    search.oninput = () => { state.query = search.value; persist(); renderHistory(history); }; toolbar.append(search);
    repoSelector(toolbar); toolbar.append(button('Branch ▾', 'Show Branches', () => send('branches')), el('span', 'spacer'),
      button('↻', 'Refresh Git Log', () => send('refresh')), button('↓', 'Fetch', () => send('fetch')), button('↙', 'Update Project', () => send('pull')), button('↑', 'Push', () => send('push')), el('span', 'log-count', `${snapshot?.commits.length || 0} commits`));
    layout.append(error);
    layout.append(success);
    if (snapshot?.noRepository) { layout.append(el('div', 'empty', 'Open a Git repository to view its history.')); return; }
    const content = el('div', 'log-content'); const branches = el('aside', 'branches'); const history = el('section', 'history'); const detail = el('aside', 'details'); content.append(branches, history, detail); layout.append(content);
    branches.append(button('HEAD (Current)', 'Show Current Branch', () => send('filterBranch', { ref: '' }), `branch-row${!snapshot?.ref ? ' active' : ''}`));
    for (const [type, label] of [[0, '⌄ Local'], [1, '⌄ Remote']]) {
      branches.append(el('div', 'branch-heading', label));
      for (const branch of snapshot?.branches.filter(item => item.type === type) || []) {
        const item = button(branch.name, `Filter by ${branch.name}`, () => send('filterBranch', { ref: branch.name }), `branch-row${snapshot.ref === branch.name ? ' active' : ''}`);
        item.prepend(el('span', 'branch-icon', '⑂')); branches.append(item);
      }
    }
    renderHistory(history); renderDetails(detail);
  }

  function renderHistory(container) {
    container.replaceChildren();
    const header = el('div', 'history-header'); header.append(el('span', '', 'Subject'), el('span', '', 'Author'), el('span', '', 'Date')); container.append(header);
    const query = state.query.toLowerCase(); const commits = snapshot?.commits.filter(commit => `${commit.message} ${commit.hash} ${commit.authorName}`.toLowerCase().includes(query)) || [];
    if (!commits.length) { container.append(el('div', 'empty', snapshot?.commits.length ? 'No matching commits.' : 'This repository has no commits yet.')); return; }
    const canvas = el('div', 'history-canvas'); container.append(canvas);
    const colors = ['#7e6ee8', '#6aab73', '#56a8f5', '#d5b778', '#c77dbb', '#56a8b3'];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('graph'); svg.setAttribute('width', '73'); svg.setAttribute('height', String(commits.length * 29));
    if (!query) for (const commit of commits) for (const edge of commit.parents) {
      const line = document.createElementNS(svg.namespaceURI, 'path'); const x1 = 15 + commit.lane * 12; const x2 = 15 + edge.lane * 12; const y1 = commit.row * 29 + 14; const y2 = edge.row * 29 + 14;
      line.setAttribute('d', `M${x1} ${y1} C${x1} ${y1 + 15} ${x2} ${y2 - 15} ${x2} ${y2}`); line.setAttribute('fill', 'none'); line.setAttribute('stroke', colors[commit.lane % colors.length]); line.setAttribute('stroke-width', '1.5'); svg.append(line);
    }
    for (const [index, commit] of commits.entries()) {
      const row = el('div', `commit-row${selectedCommit === commit.hash ? ' selected' : ''}`); row.tabIndex = 0; row.setAttribute('role', 'button');
      const subject = el('div', 'commit-subject'); const refs = snapshot.branches.filter(branch => branch.commit === commit.hash && branch.type === 0);
      for (const ref of refs.slice(0, 2)) subject.append(el('span', 'ref-badge', ref.name)); subject.append(document.createTextNode(commit.message.split('\n')[0])); subject.title = commit.message;
      const date = commit.authorDate ? new Date(commit.authorDate) : null;
      row.append(subject, el('span', 'commit-author', commit.authorName || ''), el('span', 'commit-date', date ? date.toLocaleDateString() : ''));
      const choose = () => { selectedCommit = commit.hash; send('selectCommit', { hash: commit.hash }); renderHistory(container); };
      row.onclick = choose; row.onkeydown = event => { if (event.key === 'Enter') choose(); }; canvas.append(row);
      const dot = document.createElementNS(svg.namespaceURI, 'circle'); dot.setAttribute('cx', String(15 + commit.lane * 12)); dot.setAttribute('cy', String(index * 29 + 14)); dot.setAttribute('r', '3.5'); dot.setAttribute('fill', colors[commit.lane % colors.length]); svg.append(dot);
    }
    canvas.append(svg);
  }

  function renderDetails(container) {
    container.replaceChildren();
    if (!details || details.hash !== selectedCommit) { container.append(el('div', 'empty', 'Select a commit to view its changes.')); return; }
    container.append(el('div', 'section-title', `${snapshot?.name || ''} · ${details.files.length} files`));
    const files = el('div', 'details-files');
    for (const file of details.files) {
      const row = button(file.relativePath, `Open Diff: ${file.relativePath}`, () => send('openCommitFile', { hash: details.hash, path: file.path }), 'file-row'); row.style.color = '#6f9de7'; files.append(row);
    }
    const message = el('div', 'commit-message', details.message); message.append(el('div', 'commit-meta', `${details.author || ''}\n${details.hash.slice(0, 12)}`)); container.append(files, message);
  }

  window.addEventListener('message', event => {
    const message = event.data;
    if (message.type === 'committed') showError('');
    if (message.type === 'snapshot') { snapshot = message; if (kind === 'commit') renderCommit(); else renderLog(); }
    if (message.type === 'error') { busy = false; if (kind === 'commit') renderCommit(); showError(message.message); }
    if (message.type === 'committed') { busy = false; state.message = ''; state.selected = []; state.initialized = false; state.amend = false; persist(); success.textContent = `✓ Committed ${message.files || 0} file${message.files === 1 ? '' : 's'}${message.hash ? ` · ${message.hash}` : ''}`; success.hidden = false; if (kind === 'commit') renderCommit(); }
    if (message.type === 'commitDetails') { details = message; const container = document.querySelector('.details'); if (container) renderDetails(container); }
  });
  if (kind === 'commit') renderCommit(); else renderLog();
  send('ready');
})();

(() => {
  const vscode = acquireVsCodeApi();
  const state = { board: null, tab: 'areas', query: '', limit: 120, detailsId: '' };
  const send = (type, more = {}) => vscode.postMessage({ type, ...more });
  const $ = selector => document.querySelector(selector);
  const make = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const categories = [['files', 'Files'], ['areas', 'Areas'], ['changes', 'Changes'], ['features', 'Features'], ['commits', 'History']];
  function render() {
    const board = state.board;
    if (!board) return;
    $('#project').textContent = board.noWorkspace ? 'Open a folder to explore your code.' : `${board.root.split(/[\\/]/).filter(Boolean).at(-1) || 'Project'}${board.branch ? ` · ${board.branch}` : ''}`;
    const metrics = $('#metrics'); metrics.replaceChildren();
    for (const [key, label] of [['files','Files'],['areas','Areas'],['changes','Changes'],['commits','Commits']]) {
      const box = make('div','metric'); box.append(make('strong','',String(board[key]?.length || 0)),make('span','',label)); metrics.append(box);
    }
    const nav = $('#tabs'); nav.replaceChildren();
    for (const [key, label] of categories) {
      const button = make('button',key === state.tab ? 'selected' : '',`${label} · ${board[key]?.length || 0}`);
      button.type = 'button'; button.onclick = () => { state.tab = key; state.limit = 120; render(); }; nav.append(button);
    }
    const items = board[state.tab] || [];
    const terms = state.query.toLowerCase().split(/\s+/).filter(Boolean);
    const matching = terms.length ? items.filter(item => terms.every(term => `${item.title} ${item.path || ''} ${item.scope || ''} ${item.hash || ''}`.toLowerCase().includes(term))) : items;
    const cards = $('#cards'); cards.replaceChildren();
    for (const item of matching.slice(0,state.limit)) {
      const card = make('article','card'); card.setAttribute('role','listitem'); card.tabIndex=0; card.setAttribute('aria-label',`${item.kind}: ${item.title}. Open details.`);
      card.onclick=()=>send('details',{id:item.id});card.onkeydown=event=>{if(event.target===card&&(event.key==='Enter'||event.key===' ')){event.preventDefault();send('details',{id:item.id});}};
      card.append(make('span','kind',item.kind === 'area' ? `${item.fileCount} files` : item.kind),make('h3','',item.title),make('span','path',item.path || item.scope || item.date || item.hash?.slice(0,12) || ''));
      const actions = make('div','actions');
      if (item.kind === 'file' || item.kind === 'change' || item.kind === 'commit') {
        const open = make('button','',item.kind === 'commit' ? 'Details' : 'Open'); open.type='button'; open.onclick=event=>{event.stopPropagation();send('open',{id:item.id});}; actions.append(open);
      }
      const explain = make('button','explain','✦ Explain'); explain.type='button'; explain.setAttribute('aria-label',`Explain ${item.title}`); explain.onclick=event=>{event.stopPropagation();send('explain',{id:item.id});}; actions.append(explain);
      card.append(actions); cards.append(card);
    }
    if (!matching.length) cards.append(make('div','empty',state.query ? 'No matches. Try another search.' : 'Nothing in this category yet.'));
    $('#more').hidden = matching.length <= state.limit;
  }
  $('#search').oninput = event => { state.query = event.target.value.trim(); state.limit = 120; render(); };
  $('#refresh').onclick = () => send('refresh');
  $('#open-ai').onclick = () => send('ai');
  $('#more').onclick = () => { state.limit += 120; render(); };
  $('#details-close').onclick=()=>$('#details-dialog').close();
  $('#details-dialog').addEventListener('click',event=>{if(event.target===$('#details-dialog'))$('#details-dialog').close();});
  $('#details-explain').onclick=()=>{const id=state.detailsId;$('#details-dialog').close();send('explain',{id});};
  $('#details-open').onclick=()=>{const id=state.detailsId;$('#details-dialog').close();send('open',{id});};
  function detailField(label,value){if(value===undefined||value===null||value==='')return;const row=make('div','detail-row');row.append(make('span','detail-label',label),make('span','detail-value',String(value)));$('#details-content').append(row);}
  function detailList(title,items){if(!items?.length)return;const section=make('section','detail-section');section.append(make('h3','',title));const list=make('ul','detail-list');for(const item of items.slice(0,200)){let text=typeof item==='string'?item:`${item.status||''} ${item.path||''}`;if(typeof item==='object'&&('additions'in item||'deletions'in item))text+=`  (+${item.additions??'—'} −${item.deletions??'—'})`;list.append(make('li','',text));}section.append(list);$('#details-content').append(section);}
  function detailCode(title,value){if(!value)return;const section=make('section','detail-section');section.append(make('h3','',title));const pre=make('pre','detail-code',value);section.append(pre);$('#details-content').append(section);}
  function detailExplanations(items){if(!items?.length)return;const section=make('section','detail-section explanation-history');section.append(make('h3','','Saved AI explanations'));for(const item of items.slice(0,6)){const entry=make('article','explanation-entry');const date=item.savedAt?new Date(item.savedAt).toLocaleString():'Saved explanation';entry.append(make('div','explanation-meta',[date,[item.provider,item.model].filter(Boolean).join(' · ')].filter(Boolean).join(' · ')));if(item.prompt)entry.append(make('p','explanation-prompt',`Question: ${item.prompt}`));entry.append(make('pre','explanation-response',item.response||''));section.append(entry);}$('#details-content').append(section);}
  window.addEventListener('message', event => {
    const message = event.data;
    if (message.type === 'board') { state.board = message.board; $('#message').textContent = ''; render(); }
    if (message.type === 'details') {
      const d=message.details;if(!d)return;state.detailsId=`${d.kind}:${d.hash||d.path||d.title}`;$('#details-kind').textContent=d.kind.toUpperCase();$('#details-title').textContent=d.title||d.path||d.hash;
      const content=$('#details-content');content.replaceChildren();detailField('Path',d.path);detailField('Type',d.language);detailField('Status',d.status||(d.kind==='file'?'Clean':d.kind==='change'?'Changed':''));detailField('Staged status',d.indexStatus);detailField('Working-tree status',d.worktreeStatus);detailField('Author',d.authorEmail?`${d.author} <${d.authorEmail}>`:d.author);detailField('Author date',d.authorDate);detailField('Commit date',d.commitDate||d.date);detailField('Commit',d.hash);detailField('Parents',d.parents?.join(', '));detailField('Files',d.fileCount);detailField('Change totals',d.stats?`${d.stats.files} files · +${d.stats.additions} −${d.stats.deletions}`:'');detailList('Changed files',d.changedFiles);detailList('Area members',d.members);detailList('History',d.history);detailCode('Patch and change summary',d.patch);detailExplanations(d.explanationHistory);
      const canOpen=['file','change'].includes(d.kind);$('#details-open').hidden=!canOpen;$('#details-open').textContent='Open file';if(!$('#details-dialog').open)$('#details-dialog').showModal();
    }
    if (message.type === 'error') $('#message').textContent = message.message;
  });
  send('ready');
})();

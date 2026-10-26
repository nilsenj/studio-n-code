(() => {
  const vscode = acquireVsCodeApi();
  const $ = selector => document.querySelector(selector);
  let mode = 'ask', active = null, busy = false, configured = false, models = [];
  const send = (type, more = {}) => vscode.postMessage({ type, ...more });
  function status(text, error = false) { $('#status').textContent = text; $('#status').classList.toggle('error',error); }
  function bubble(role, value = '') {
    $('.welcome')?.remove();
    const box = document.createElement('article'); box.className = `message ${role}`;
    const label = document.createElement('div'); label.className = 'role'; label.textContent = role === 'user' ? 'YOU' : 'STUDIO AI';
    const content = document.createElement('div'); content.className = 'content'; content.textContent = value;
    box.append(label,content); $('#messages').append(box); box.scrollIntoView({block:'end'}); return content;
  }
  function setBusy(value) { busy=value; $('#send').disabled=value; $('#stop').hidden=!value; }
  function setMode(value) {
    mode=value; for (const button of $('#modes').querySelectorAll('button')) button.classList.toggle('selected',button.dataset.mode===value);
    $('#prompt').placeholder = {ask:'Ask about this project…',explain:'What should AI explain?',plan:'What change would you like to plan?',edit:'Describe the change to the selected file…'}[value];
    if(value==='explain' && !$('#prompt').value) $('#prompt').value='Explain this clearly: its purpose, flow, dependencies and risks.';
  }
  $('#modes').onclick=event=>{const value=event.target.dataset.mode;if(value)setMode(value)};
  $('#send').onclick=()=>{
    if(busy)return;const prompt=$('#prompt').value.trim();if(!prompt){status('Enter a question or instruction.');return;}
    bubble('user',prompt);active=bubble('assistant','');$('#prompt').value='';$('#preview-edit').hidden=true;$('#apply-edit').hidden=true;
    setBusy(true);status('Working…');send('ask',{mode,prompt});
  };
  $('#prompt').onkeydown=event=>{if(event.key==='Enter'&&event.ctrlKey){event.preventDefault();$('#send').click()}};
  $('#stop').onclick=()=>send('stop');
  $('#clear').onclick=()=>{if(busy)send('stop');$('#messages').replaceChildren();send('clear');status('Conversation cleared.');};
  $('#board').onclick=()=>send('board');
  $('#active-file').onclick=()=>send('useActiveFile');
  $('#settings-toggle').onclick=()=>{$('#settings').hidden=!$('#settings').hidden};
  $('#settings-close').onclick=()=>{$('#settings').hidden=true};
  $('#provider').onchange=()=>{models=[];$('#model').replaceChildren(new Option('Discover models first',''));$('#model').disabled=true;$('#key').value='';send('loadProvider',{provider:$('#provider').value});};
  $('#discover-models').onclick=()=>{status('Discovering provider models…');send('discoverModels',{provider:$('#provider').value,key:$('#key').value});};
  $('#key').onchange=()=>{if($('#key').value.trim()){status('Discovering provider models…');send('discoverModels',{provider:$('#provider').value,key:$('#key').value});}};
  $('#save-settings').onclick=()=>send('saveSettings',{provider:$('#provider').value,model:$('#model').value,key:$('#key').value});
  $('#clear-key').onclick=()=>send('clearKey',{provider:$('#provider').value});
  $('#preview-edit').onclick=()=>send('previewEdit'); $('#apply-edit').onclick=()=>send('applyEdit');
  window.addEventListener('message',event=>{
    const message=event.data;
    if(message.type==='settings'){configured=!!message.model;$('#provider').value=message.provider||'openai';$('#key').value='';$('#key-status').textContent=message.hasKey?'Key saved':'No key saved';if(message.model){models=[{id:message.model,label:message.model}];fillModels(message.model);}else{models=[];$('#model').replaceChildren(new Option('Discover models first',''));$('#model').disabled=true;}status(message.model?'Ready to ask.':'Connect a provider and discover models to begin.');if(message.hasKey){status('Discovering saved provider models…');send('discoverModels',{provider:message.provider||'openai',key:''});}}
    if(message.type==='models'){models=message.options||[];fillModels(message.recommended);const recommended=models.find(item=>item.id===message.recommended);$('#model-note').textContent=recommended?`Balanced recommendation: ${recommended.label}. Choose any discovered model.`:'Choose any model returned by this provider.';status(`${models.length} models discovered.`);}
    if(message.type==='context'){$('#context').textContent=message.label||'No board item selected. Your active file will be used when available.';if(message.explain){setMode('explain');$('#prompt').value='Explain this clearly: its purpose, flow, dependencies and risks.';if(configured)$('#send').click();else $('#settings').hidden=false;}}
    if(message.type==='delta'&&active){active.textContent+=message.text;active.parentElement.scrollIntoView({block:'end'});}
    if(message.type==='done'){setBusy(false);status(message.message||'Completed.');if(message.edit){$('#preview-edit').hidden=false;$('#apply-edit').hidden=false;}active=null;}
    if(message.type==='error'){setBusy(false);status(message.message,true);if(active&&!active.textContent)active.textContent=`Error: ${message.message}`;active=null;}
    if(message.type==='stopped'){setBusy(false);status('Request stopped.');active=null;}
    if(message.type==='applied'){$('#apply-edit').hidden=true;$('#preview-edit').hidden=true;status('Edit applied. Review and save the file.');}
    if(message.type==='cleared'){setBusy(false);active=null;}
  });
  function fillModels(selected){const select=$('#model');select.replaceChildren();for(const item of models){const option=new Option(item.label+(item.recommended?' · Balanced':''),item.id);option.title=item.description||item.id;select.add(option);}select.disabled=!models.length;if(selected&&models.some(item=>item.id===selected))select.value=selected;}
  send('ready');
})();

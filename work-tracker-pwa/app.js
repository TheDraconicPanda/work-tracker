(() => {
  'use strict';
  const DB_NAME = 'personal-work-tracker';
  const DB_VERSION = 1;
  const DEFAULT_SETTINGS = {
    weeklyTarget: 40, dailyTarget: 8,
    schedule: { Mon: 'Office', Tue: 'Home', Wed: 'Office', Thu: 'Office', Fri: 'Home' }
  };
  let db;
  let weekOffset = 0;
  let deferredInstallPrompt = null;
  const $ = id => document.getElementById(id);
  const dayKeys = ['Mon','Tue','Wed','Thu','Fri'];
  const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseDate = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d,12,0,0); };
  const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
  const mondayOf = d => { const x = new Date(d.getFullYear(),d.getMonth(),d.getDate(),12); x.setDate(x.getDate() - ((x.getDay()+6)%7)); return x; };
  const fmtDate = s => parseDate(s).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  const fmtLong = s => parseDate(s).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}) : 'Open';
  const minsBetween = (a,b) => Math.max(0,Math.round((new Date(b)-new Date(a))/60000));
  const fmtHM = mins => { const sign = mins < 0 ? '−' : ''; const n=Math.abs(Math.round(mins)); return `${sign}${Math.floor(n/60)}h ${pad(n%60)}m`; };
  const dayOfWeekKey = s => dayKeys[(parseDate(s).getDay()+6)%7];
  const localStamp = (date,time) => new Date(`${date}T${time}:00`).toISOString();
  const dateTimeFromIso = iso => { const d=new Date(iso); return {date:dateKey(d),time:`${pad(d.getHours())}:${pad(d.getMinutes())}`}; };
  const safeText = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function openDb() {
    return new Promise((resolve,reject) => {
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const d=req.result;
        if(!d.objectStoreNames.contains('sessions')) d.createObjectStore('sessions',{keyPath:'id'});
        if(!d.objectStoreNames.contains('holidays')) d.createObjectStore('holidays',{keyPath:'id'});
        if(!d.objectStoreNames.contains('settings')) d.createObjectStore('settings',{keyPath:'key'});
      };
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
  }
  function store(name,mode='readonly'){return db.transaction(name,mode).objectStore(name);}
  function getAll(name){return new Promise((resolve,reject)=>{const r=store(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  function put(name,value){return new Promise((resolve,reject)=>{const r=store(name,'readwrite').put(value);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  function del(name,key){return new Promise((resolve,reject)=>{const r=store(name,'readwrite').delete(key);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});}
  function clearStore(name){return new Promise((resolve,reject)=>{const r=store(name,'readwrite').clear();r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});}
  async function getSettings(){const x=await new Promise((resolve,reject)=>{const r=store('settings').get('main');r.onsuccess=()=>resolve(r.result?.value);r.onerror=()=>reject(r.error);});return {...DEFAULT_SETTINGS,...(x||{}),schedule:{...DEFAULT_SETTINGS.schedule,...(x?.schedule||{})}};}
  async function saveSettings(s){await put('settings',{key:'main',value:s});}
  async function allData(){const [sessions,holidays,settings]=await Promise.all([getAll('sessions'),getAll('holidays'),getSettings()]);return {sessions,holidays,settings};}
  function sessionMinutes(s){if(!s.endAt)return 0;return Math.max(0,minsBetween(s.startAt,s.endAt)-Number(s.lunchMinutes||0));}
  function sumDay(sessions,date){return sessions.filter(s=>s.date===date && s.endAt).reduce((a,s)=>a+sessionMinutes(s),0);}
  function getOpenSession(sessions){return sessions.find(s=>!s.endAt)||null;}
  function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2600);}
  async function toggleSession(source='app'){
    const sessions=await getAll('sessions'); const open=getOpenSession(sessions);
    if(open){open.endAt=new Date().toISOString();open.updatedAt=new Date().toISOString();open.source=source;await put('sessions',open);toast(`Checked out at ${fmtTime(open.endAt)}`);}
    else{
      const now=new Date();const s={id:crypto.randomUUID(),date:dateKey(now),location:(await getSettings()).schedule[dayKeys[(now.getDay()+6)%7]]||'Other',startAt:now.toISOString(),endAt:null,lunchMinutes:0,status:'Pending',notes:'',source,createdAt:now.toISOString()};
      await put('sessions',s);toast(`Checked in at ${fmtTime(s.startAt)}`);
    }
    await render();
  }
  function tab(name){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('hidden',p.id!==`${name}Panel`));}
  function inWeek(date,start,end){return date>=dateKey(start)&&date<=dateKey(end);}
  async function render(){
    const [sessions,holidays,settings]=await Promise.all([getAll('sessions'),getAll('holidays'),getSettings()]);
    sessions.sort((a,b)=>b.startAt.localeCompare(a.startAt));
    const open=getOpenSession(sessions);$('statusDot').classList.toggle('on',!!open);$('timerStatus').textContent=open?`Checked in since ${fmtTime(open.startAt)}`:'Not checked in';$('toggleBtn').textContent=open?'Check out':'Check in';$('quickBreakBtn').classList.toggle('hidden',!open);
    const today=dateKey(new Date());$('todaySummary').textContent=`Today's recorded work: ${fmtHM(sumDay(sessions,today))}`;
    $('liveTimer').textContent=open?fmtHM(minsBetween(open.startAt,new Date().toISOString())):'--:--:--';
    renderOverview(sessions,holidays,settings);renderSessions(sessions);renderPlanner(sessions,holidays,settings);renderSettings(settings);$('storageInfo').textContent=`${sessions.length} session record(s), ${holidays.length} holiday credit(s) stored on this device.`;
  }
  function renderOverview(sessions,holidays,settings){
    const start=addDays(mondayOf(new Date()),weekOffset*7),end=addDays(start,4),key=s=>inWeek(s,start,end);
    const work=sessions.filter(s=>key(s.date)&&s.endAt).reduce((a,s)=>a+sessionMinutes(s),0);
    const holiday=holidays.filter(h=>key(h.date)&&h.status==='Confirmed').reduce((a,h)=>a+Number(h.hours)*60,0);
    const target=Number(settings.weeklyTarget)*60;const bal=work+holiday-target;
    $('weekRange').textContent=`${fmtDate(dateKey(start))} – ${fmtDate(dateKey(end))}`;$('weekWorked').textContent=fmtHM(work);$('weekHoliday').textContent=fmtHM(holiday);$('weekCredited').textContent=fmtHM(work+holiday);$('weekBalance').textContent=fmtHM(bal);$('weekBalance').className=bal>=0?'positive':'';
    $('dailyProgress').innerHTML=dayKeys.map((k,i)=>{const d=addDays(start,i),ds=dateKey(d),m=sumDay(sessions,ds),pct=Math.min(100,m/(Number(settings.dailyTarget)*60)*100);return `<div class="progress-row"><span>${k}</span><div class="bar"><i style="width:${pct}%"></i></div><strong>${fmtHM(m)}</strong></div>`;}).join('');
    $('recentSessions').innerHTML=sessions.slice(0,5).map(sessionHtml).join('')||'<div class="empty muted" style="padding:18px 0">No sessions recorded yet.</div>';
  }
  function sessionHtml(s){const dur=s.endAt?fmtHM(sessionMinutes(s)):'In progress';return `<div class="session-row"><div class="session-main"><div class="session-title">${safeText(fmtLong(s.date))} · ${safeText(s.location||'Other')}</div><div class="session-meta">${fmtTime(s.startAt)} – ${fmtTime(s.endAt)}${s.lunchMinutes?` · ${s.lunchMinutes}m lunch deduction`:''}</div></div><div class="session-side"><div class="session-hours">${dur}</div><span class="pill ${s.status==='Confirmed'?'confirmed':''}">${safeText(s.status||'Pending')}</span></div></div>`;}
  function renderSessions(sessions){$('sessionList').innerHTML=sessions.map(s=>`<div class="session-row"><div class="session-main"><div class="session-title">${safeText(fmtLong(s.date))} · ${safeText(s.location||'Other')}</div><div class="session-meta">${fmtTime(s.startAt)} – ${fmtTime(s.endAt)} · ${safeText(s.notes||'No notes')}</div></div><div class="session-side"><div class="session-hours">${s.endAt?fmtHM(sessionMinutes(s)):'Open'}</div><button class="text-button" data-edit-session="${s.id}">Edit</button></div></div>`).join('')||'<div class="muted" style="padding:18px 0">No sessions yet. Check in or add a session.</div>';}
  function renderPlanner(sessions,holidays,settings){const start=addDays(mondayOf(new Date()),weekOffset*7),end=addDays(start,4);$('weekRange').textContent=`${fmtDate(dateKey(start))} – ${fmtDate(dateKey(end))}`;
    $('plannerRows').innerHTML=dayKeys.map((k,i)=>{const d=addDays(start,i),ds=dateKey(d),m=sumDay(sessions,ds),credit=holidays.filter(h=>h.date===ds&&h.status==='Confirmed').reduce((a,h)=>a+Number(h.hours)*60,0),diff=m+credit-Number(settings.dailyTarget)*60;return `<div class="planner-row"><div><div class="planner-day">${dayNames[i]} · ${fmtDate(ds)}</div><div class="planner-sub">${settings.schedule[k]} · ${credit?`Holiday credit ${fmtHM(credit)} · `:''}${sessions.filter(s=>s.date===ds).length} session(s)</div></div><div><div class="planner-value">${fmtHM(m)}</div><div class="planner-balance ${diff>=0?'positive':'negative'}">${diff>=0?'+':''}${fmtHM(diff)} vs daily target</div></div></div>`;}).join('');
    const w=sessions.filter(s=>inWeek(s.date,start,end)&&s.endAt).reduce((a,s)=>a+sessionMinutes(s),0),h=holidays.filter(x=>inWeek(x.date,start,end)&&x.status==='Confirmed').reduce((a,x)=>a+Number(x.hours)*60,0),t=Number(settings.weeklyTarget)*60,b=w+h-t;
    $('plannerTotals').innerHTML=`<div class="session-row"><span>Actual work</span><strong>${fmtHM(w)}</strong></div><div class="session-row"><span>Confirmed holiday credit</span><strong>${fmtHM(h)}</strong></div><div class="session-row"><span>Weekly target</span><strong>${fmtHM(t)}</strong></div><div class="session-row"><strong>Balance</strong><strong class="${b>=0?'positive':'negative'}">${b>=0?'+':''}${fmtHM(b)}</strong></div>`;
    $('holidayList').innerHTML=holidays.filter(x=>inWeek(x.date,start,end)).sort((a,b)=>a.date.localeCompare(b.date)).map(h=>`<div class="session-row"><div><div class="session-title">${fmtLong(h.date)} · ${h.hours}h</div><div class="session-meta">Paid holiday credit</div></div><div><span class="pill ${h.status==='Confirmed'?'confirmed':''}">${h.status}</span>${h.status!=='Confirmed'?` <button class="text-button" data-confirm-holiday="${h.id}">Confirm</button>`:''} <button class="danger-link" data-delete-holiday="${h.id}">Delete</button></div></div>`).join('')||'<p class="muted">No holiday credits this week.</p>';
  }
  function renderSettings(s){$('weeklyTarget').value=s.weeklyTarget;$('dailyTarget').value=s.dailyTarget;$('scheduleGrid').innerHTML=dayKeys.map(k=>`<div class="day-setting"><label>${k}<select data-schedule="${k}"><option ${s.schedule[k]==='Office'?'selected':''}>Office</option><option ${s.schedule[k]==='Home'?'selected':''}>Home</option><option ${s.schedule[k]==='Other'?'selected':''}>Other</option></select></label></div>`).join('');}
  function openEditor(s=null){$('sessionEditor').classList.remove('hidden');$('sessionEditorTitle').textContent=s?'Edit session':'Add session';$('sessionId').value=s?.id||'';$('sessionDate').value=s?.date||dateKey(new Date());$('sessionStart').value=s?dateTimeFromIso(s.startAt).time:'09:00';$('sessionEnd').value=s?.endAt?dateTimeFromIso(s.endAt).time:'';$('sessionLunch').value=s?.lunchMinutes||0;$('sessionStatus').value=s?.status||'Pending';$('sessionLocation').value=s?.location||'Office';$('sessionNotes').value=s?.notes||'';$('deleteSession').classList.toggle('hidden',!s);$('sessionEditor').scrollIntoView({behavior:'smooth',block:'start'});}
  async function saveSession(e){e.preventDefault();const id=$('sessionId').value||crypto.randomUUID(),date=$('sessionDate').value,start=$('sessionStart').value,end=$('sessionEnd').value;if(!date||!start){toast('Date and start time are required.');return;}const startAt=localStamp(date,start);let endAt=null;if(end){endAt=localStamp(date,end);if(new Date(endAt)<=new Date(startAt)){const next=addDays(parseDate(date),1);endAt=localStamp(dateKey(next),end);}}
    const existing=(await getAll('sessions')).find(s=>s.id===id);const s={...(existing||{}),id,date,startAt,endAt,lunchMinutes:Number($('sessionLunch').value||0),status:$('sessionStatus').value,location:$('sessionLocation').value,notes:$('sessionNotes').value,updatedAt:new Date().toISOString()};await put('sessions',s);$('sessionEditor').classList.add('hidden');await render();toast('Session saved.');}
  async function savePrefs(){const s=await getSettings();s.weeklyTarget=Number($('weeklyTarget').value);s.dailyTarget=Number($('dailyTarget').value);document.querySelectorAll('[data-schedule]').forEach(el=>s.schedule[el.dataset.schedule]=el.value);await saveSettings(s);await render();toast('Settings saved.');}
  async function addHoliday(e){e.preventDefault();const h={id:crypto.randomUUID(),date:$('holidayDate').value,hours:Number($('holidayHours').value),status:'Pending',createdAt:new Date().toISOString(),note:'Paid holiday credit'};if(!h.date||!h.hours){toast('Enter a date and number of hours.');return;}await put('holidays',h);$('holidayForm').reset();$('holidayHours').value=8;await render();toast('Holiday credit added as pending. Confirm it to count toward the target.');}
  function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function exportBackup(){const data=await allData();const backup={app:'personal-work-tracker',schemaVersion:1,exportedAt:new Date().toISOString(),...data};download(`work-tracker-backup-${dateKey(new Date())}.json`,JSON.stringify(backup,null,2),'application/json');$('dataMessage').textContent='JSON backup downloaded.';}
  async function importBackup(file){try{const data=JSON.parse(await file.text());if(data.app!=='personal-work-tracker'||data.schemaVersion!==1||!Array.isArray(data.sessions)||!Array.isArray(data.holidays)||!data.settings)throw new Error('This is not a supported Work Tracker backup.');if(!confirm(`Restore ${data.sessions.length} sessions and ${data.holidays.length} holiday credits? This replaces all Work Tracker data currently stored in this browser.`))return;await Promise.all(['sessions','holidays','settings'].map(clearStore));for(const s of data.sessions)await put('sessions',s);for(const h of data.holidays)await put('holidays',h);await saveSettings({...DEFAULT_SETTINGS,...data.settings,schedule:{...DEFAULT_SETTINGS.schedule,...data.settings.schedule}});await render();$('dataMessage').textContent=`Restored backup from ${data.exportedAt||'unknown date'}.` ;toast('Backup restored.');}catch(err){toast(`Restore failed: ${err.message}`);}}
  async function exportCsv(){const sessions=await getAll('sessions');const cols=['date','location','startAt','endAt','lunchMinutes','workedMinutes','status','notes','source'];const lines=[cols.join(','),...sessions.sort((a,b)=>a.startAt.localeCompare(b.startAt)).map(s=>cols.map(k=>{let v=k==='workedMinutes'?(s.endAt?sessionMinutes(s):''):s[k]??'';return `"${String(v).replace(/"/g,'""')}"`;}).join(','))];download(`work-tracker-sessions-${dateKey(new Date())}.csv`,lines.join('\r\n'),'text/csv;charset=utf-8');}
  function handleShortcut(){const url=new URL(location.href);if(url.searchParams.get('action')==='toggle'){url.searchParams.delete('action');url.searchParams.delete('source');history.replaceState({},'',url.pathname+url.search+url.hash);toggleSession('iphone-shortcut').catch(e=>toast(e.message));}}
  function bind(){
    $('toggleBtn').addEventListener('click',()=>toggleSession());$('quickBreakBtn').addEventListener('click',()=>toggleSession());
    document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
    document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.go)));
    $('addSessionBtn').addEventListener('click',()=>openEditor());$('cancelSession').addEventListener('click',()=>$('sessionEditor').classList.add('hidden'));$('sessionForm').addEventListener('submit',saveSession);
    $('sessionList').addEventListener('click',async e=>{const b=e.target.closest('[data-edit-session]');if(b){const s=(await getAll('sessions')).find(x=>x.id===b.dataset.editSession);if(s)openEditor(s);}});
    $('deleteSession').addEventListener('click',async()=>{const id=$('sessionId').value;if(id&&confirm('Delete this session?')){await del('sessions',id);$('sessionEditor').classList.add('hidden');await render();toast('Session deleted.');}});
    $('saveSettings').addEventListener('click',savePrefs);$('holidayForm').addEventListener('submit',addHoliday);
    $('prevWeek').addEventListener('click',async()=>{weekOffset--;await render();});$('nextWeek').addEventListener('click',async()=>{weekOffset++;await render();});
    $('holidayList').addEventListener('click',async e=>{const c=e.target.closest('[data-confirm-holiday]'),d=e.target.closest('[data-delete-holiday]');if(c){const h=(await getAll('holidays')).find(x=>x.id===c.dataset.confirmHoliday);if(h){h.status='Confirmed';await put('holidays',h);await render();}}if(d&&confirm('Delete this holiday credit?')){await del('holidays',d.dataset.deleteHoliday);await render();}});
    $('exportJson').addEventListener('click',exportBackup);$('exportCsv').addEventListener('click',exportCsv);$('importJsonBtn').addEventListener('click',()=>$('importJson').click());$('importJson').addEventListener('change',e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value='';});
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;$('installBtn').classList.remove('hidden');});$('installBtn').addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$('installBtn').classList.add('hidden');});
  }
  async function init(){try{db=await openDb();const settings=await getSettings();await saveSettings(settings);bind();await render();handleShortcut();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});setInterval(async()=>{const sessions=await getAll('sessions');const open=getOpenSession(sessions);if(open){$('liveTimer').textContent=fmtHM(minsBetween(open.startAt,new Date().toISOString()));}},15000);}catch(e){document.body.innerHTML=`<main><h1>Work Tracker could not start</h1><p>${safeText(e.message)}</p><p>Use a modern browser with IndexedDB enabled.</p></main>`;}}
  init();
})();

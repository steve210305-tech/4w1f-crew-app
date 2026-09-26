/* 4W1F 3.4.0 feature pack — loaded after update-3.3.js */
(function(){
  'use strict';
  const RELEASE_VERSION_340='3.4.4';
  const RELEASE_BUILD_340='2026-09-26.1';
  let soundRealtime340=null,audioCtx340=null;
  const prefsDefaults340={notification_sound:'engine_start',support_sound:'support_terminal_d',sound_enabled:true,support_sound_enabled:true,first_home_seen_at:null,last_home_seen_at:null,last_gallery_seen_at:null};
  const privacyDefaults340={instagram:true,vehicle:true,power:true,mods:true,photos:true};

  const style340=document.createElement('style');
  style340.textContent=`
    .home-greeting340{padding:15px;margin-bottom:13px;background:linear-gradient(135deg,rgba(119,37,255,.18),rgba(14,14,19,.96));border-color:rgba(155,52,255,.38)}
    .home-greeting340 h2{margin:4px 0 5px;font-family:"Barlow Condensed";font-size:29px;text-transform:uppercase}.home-greeting340 h2 span{color:var(--purple)}
    .home-quick340{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:12px}.home-quick340 button{padding:10px 5px;text-align:center;min-height:72px}.home-quick340 b{display:block;font-size:17px}.home-quick340 span{font-size:8px;color:var(--muted)}
    .sound-grid340{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sound-card340{padding:12px;text-align:left}.sound-card340.active{border-color:#9b34ff;box-shadow:0 0 0 1px rgba(155,52,255,.25)}.sound-card340 b{display:block}.sound-card340 span{font-size:10px;color:var(--muted)}
    .privacy-list340{display:grid;gap:7px}.privacy-row340{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px;border:1px solid var(--line);border-radius:11px;background:#0c0c11}.privacy-row340 input{width:19px;height:19px;accent-color:#9b34ff}
    .photo-actions340{display:flex;gap:8px;margin-top:12px}.trash-grid340{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.trash-item340{overflow:hidden}.trash-item340 img{width:100%;aspect-ratio:1;object-fit:cover;display:block}.trash-item340 .body{padding:9px}.trash-item340 .actions{margin-top:7px}
    .support-confirm340{text-align:center;padding:16px 4px}.support-confirm340 .check{width:66px;height:66px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:rgba(50,218,131,.14);border:1px solid rgba(50,218,131,.45);font-size:30px}.support-confirm340 h3{font-size:23px;margin:6px 0}
    .support-owner340{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border:1px solid var(--line);border-radius:11px;margin-top:9px}.support-event340{text-align:center;font-size:9px;color:var(--muted);padding:7px 4px}.internal-note340{border-color:rgba(255,179,40,.45);background:rgba(126,82,14,.12)}
    .notif-tabs340{display:flex;gap:6px;overflow:auto;margin-bottom:10px}.notif-tabs340 button{white-space:nowrap}.notif-item340.unread{border-color:rgba(155,52,255,.48)}.notif-dot340{color:#cf72ff;font-size:12px}
    .crew-place-chips340{display:flex;gap:7px;overflow:auto;padding:2px 0 8px}.crew-place-chips340 button{white-space:nowrap}.place-row340{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}
    .audit-row340{padding:11px}.audit-row340 b{font-size:12px}.audit-row340 .meta{font-size:9px;color:var(--muted);margin-top:4px}
    .profile-private340{font-size:9px;color:var(--amber);margin-top:5px}
    @media(max-width:500px){.home-quick340{grid-template-columns:repeat(2,1fr)}.trash-grid340{grid-template-columns:1fr 1fr}.sound-grid340{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style340);

  const signed340=async(bucket,path,seconds=3600)=>{if(!path)return null;const {data,error}=await sb.storage.from(bucket).createSignedUrl(path,seconds);return error?null:data?.signedUrl||null};
  const esc340=v=>esc(String(v??''));
  const fmtAgo340=iso=>{if(!iso)return'—';const ms=Math.max(0,Date.now()-new Date(iso).getTime()),m=Math.floor(ms/60000);if(m<1)return'gerade eben';if(m<60)return`vor ${m} Min.`;const h=Math.floor(m/60);if(h<24)return`vor ${h} Std.`;const d=Math.floor(h/24);if(d<8)return`vor ${d} Tag${d===1?'':'en'}`;return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso))};
  const prefs340=()=>({...prefsDefaults340,...(state.userPrefs340||{})});
  const privacy340=u=>({...privacyDefaults340,...(u?._privacy||{})});
  const isStaff340=()=>isAdmin();

  async function ensurePrefs340(){
    if(!prodSession)return;
    const uid=prodSession.user.id;
    await sb.from('user_preferences').upsert({user_id:uid},{onConflict:'user_id'});
    const {data,error}=await sb.from('user_preferences').select('*').eq('user_id',uid).maybeSingle();
    if(!error)state.userPrefs340={...prefsDefaults340,...(data||{})};
  }

  async function refreshGallery340(){
    if(!prodSession)return;
    const {data:rows,error}=await sb.from('gallery_items').select('*').is('deleted_at',null).order('created_at',{ascending:false}).limit(250);
    if(error)return;
    const photos=[];
    for(const g of rows||[]){
      const url=await signed340('crew-media',g.storage_path,86400);
      if(url)photos.push({id:g.id,data:url,label:g.caption||'Crew Foto',kind:uiKindFromDb(g.category),createdAt:new Date(g.created_at).getTime(),eventId:g.event_id,_storagePath:g.storage_path,uploaderId:g.uploader_id,profileVisible:g.profile_visible!==false,galleryVisible:g.gallery_visible!==false,approved:g.approved!==false});
    }
    state.photos=photos;
  }

  async function load340Extras(){
    if(!prodSession)return;
    const uid=prodSession.user.id;
    const [prefsRes,placesRes,profilesRes,readsRes]=await Promise.all([
      sb.from('user_preferences').select('*').eq('user_id',uid).maybeSingle(),
      sb.from('crew_places').select('*').order('name',{ascending:true}),
      sb.from('profiles').select('id,privacy'),
      sb.from('app_notification_reads').select('notification_key,read_at').eq('user_id',uid)
    ]);
    if(!prefsRes.data)await ensurePrefs340();else state.userPrefs340={...prefsDefaults340,...prefsRes.data};
    state.crewPlaces340=placesRes.data||[];
    const pm=new Map((profilesRes.data||[]).map(x=>[x.id,x.privacy||privacyDefaults340]));(state.users||[]).forEach(u=>u._privacy=pm.get(u.id)||privacyDefaults340);
    state.notificationReads340=new Map((readsRes.data||[]).map(x=>[x.notification_key,x.read_at]));
    await refreshGallery340();
  }

  const loadServerState340Prev=loadServerState;
  loadServerState=async function(){await loadServerState340Prev();await load340Extras()};

  const soundFiles341={
    engine_start:'motor_b.mp3',
    v8:'v8_d.mp3',
    support_terminal_d:'support_terminal_d.mp3'
  };
  const legacySoundMap344={
    turbo:'engine_start',
    turbo_clean:'engine_start',
    turbo_aggressive:'engine_start',
    turbo_flutter:'engine_start',
    turbo_blowoff:'engine_start',
    turbo_dump_valve:'engine_start',
    turbo_spool:'engine_start',
    shift:'engine_start',
    backfire:'engine_start',
    horn:'engine_start',
    subtle:'engine_start',
    dispatch:'support_terminal_d',
    support_double:'support_terminal_d',
    support_bell:'support_terminal_d',
    support_dispatch_pro:'support_terminal_d',
    support_radio:'support_terminal_d',
    support_premium:'support_terminal_d'
  };
  const soundBuffers341=new Map();
  let audioContext341=null;
  let activeSound341=null;

  function normalizeSound343(name){
    if(name==='mute')return 'mute';
    return legacySoundMap344[name]||name;
  }
  function getAudioContext341(){
    if(!audioContext341){
      const A=window.AudioContext||window.webkitAudioContext;
      if(A)audioContext341=new A();
    }
    return audioContext341;
  }
  function soundUrl341(name){
    const key=normalizeSound343(name),file=soundFiles341[key]||soundFiles341.engine_start;
    return sb.storage.from('app-audio').getPublicUrl(`3.4.4/${file}`).data.publicUrl;
  }
  async function loadSound341(name){
    const key=normalizeSound343(name);
    if(key==='mute')return null;
    if(soundBuffers341.has(key))return soundBuffers341.get(key);
    const ctx=getAudioContext341(),url=soundUrl341(key);if(!ctx||!url)return null;
    const res=await fetch(url,{cache:'force-cache'});
    if(!res.ok)throw new Error(`Sound ${key} konnte nicht geladen werden`);
    const buf=await ctx.decodeAudioData(await res.arrayBuffer());
    if(!buf||!buf.duration)throw new Error(`Sound ${key} ist ungültig`);
    soundBuffers341.set(key,buf);
    return buf;
  }
  async function playSound340(name,force=false){
    const p=prefs340(),key=normalizeSound343(name);
    if(key==='mute'||(!force&&!p.sound_enabled))return;
    const ctx=getAudioContext341();if(!ctx)return;
    try{
      if(ctx.state!=='running')await ctx.resume();
      const buf=await loadSound341(key);if(!buf)return;
      try{activeSound341?.stop()}catch{}
      const src=ctx.createBufferSource(),gain=ctx.createGain();
      src.buffer=buf;
      gain.gain.value=key==='support_terminal_d'?.88:.92;
      src.connect(gain).connect(ctx.destination);
      activeSound341=src;
      src.onended=()=>{if(activeSound341===src)activeSound341=null};
      src.start(0);
    }catch(e){
      console.warn('[4W1F audio]',e);
      toast('Sound konnte nicht abgespielt werden');
    }
  }
  function playNotification340(kind='general'){
    const p=prefs340();
    if(kind==='support'){
      if(p.support_sound_enabled)playSound340('support_terminal_d',true);
    }else{
      playSound340(normalizeSound343(p.notification_sound||'engine_start'));
    }
  }
  const unlock340=()=>{
    const ctx=getAudioContext341();
    try{ctx?.resume()}catch{}
    ['engine_start','v8','support_terminal_d'].forEach(name=>loadSound341(name).catch(()=>{}));
  };
  window.addEventListener('pointerdown',unlock340,{once:true,passive:true});

  function openSoundSettings340(){
    const p=prefs340(),sounds=[
      ['engine_start','Motorstart','Motorstart B · ▶ Anhören'],
      ['v8','V8','V8 D · ▶ Anhören'],
      ['mute','Stumm','Kein normaler In-App-Ton']
    ];
    const normalSelected=sounds.some(x=>x[0]===normalizeSound343(p.notification_sound))
      ? normalizeSound343(p.notification_sound)
      : 'engine_start';

    openModal('Benachrichtigungssounds',`<div class="notice"><b>Sound-Auswahl:</b> Motorstart B und V8 D sind die freigegebenen Fahrzeug-Sounds. Der Turbo-Sound wurde vollständig entfernt. Für Support wird Terminal D verwendet. System-Pushs außerhalb der geöffneten App verwenden weiterhin den Ton des Handys.</div>
      <div class="switchrow"><span>In-App Benachrichtigungssounds</span><button class="switch ${p.sound_enabled?'on':''}" id="soundEnabled340"></button></div>
      <div class="section"><div class="sectionhead"><h2>Fahrzeug-Sound</h2></div><div class="sound-grid340">${sounds.map(s=>`<button class="card sound-card340 ${normalSelected===s[0]?'active':''}" data-sound340="${s[0]}"><b>${s[1]}</b><span>${s[2]}</span></button>`).join('')}</div></div>
      <div class="section"><div class="sectionhead"><h2>Support</h2></div><div class="card sound-card340 active"><b>Terminal D</b><span>Fester Support-Ton · ▶ Anhören</span><button class="btn outline sm" id="previewSupport340" style="margin-top:8px">Anhören</button></div><div class="switchrow"><span>Support-Sound aktiv</span><button class="switch ${p.support_sound_enabled?'on':''}" id="supportSoundEnabled340"></button></div></div>
      <button class="btn primary wide" id="saveSounds340" style="margin-top:12px">Speichern</button>`,()=>{
      let selected=normalSelected,enabled=p.sound_enabled,supportEnabled=p.support_sound_enabled;
      $$('[data-sound340]').forEach(b=>b.onclick=()=>{
        selected=b.dataset.sound340;
        $$('[data-sound340]').forEach(x=>x.classList.toggle('active',x===b));
        playSound340(selected,true);
      });
      $('#previewSupport340').onclick=()=>playSound340('support_terminal_d',true);
      $('#soundEnabled340').onclick=()=>{enabled=!enabled;$('#soundEnabled340').classList.toggle('on',enabled)};
      $('#supportSoundEnabled340').onclick=()=>{supportEnabled=!supportEnabled;$('#supportSoundEnabled340').classList.toggle('on',supportEnabled)};
      $('#saveSounds340').onclick=async()=>{
        await savePrefs340({
          notification_sound:selected,
          sound_enabled:enabled,
          support_sound:'support_terminal_d',
          support_sound_enabled:supportEnabled
        });
        closeModal();toast('Sound-Einstellungen gespeichert');
      };
    });
  }

  async function savePrefs340(patch){
    if(!prodSession)return;const row={...patch,user_id:prodSession.user.id};const {data,error}=await sb.from('user_preferences').upsert(row,{onConflict:'user_id'}).select('*').single();if(error)return toast(error.message);state.userPrefs340={...prefs340(),...data};
  }

  

  const subscribeRealtime340Prev=subscribeRealtime;
  subscribeRealtime=function(){
    subscribeRealtime340Prev();
    try{soundRealtime340?.unsubscribe()}catch{}
    soundRealtime340=sb.channel('4w1f-sounds-340')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'support_tickets'},payload=>{
        if(payload.new?.created_by!==prodSession?.user?.id&&isStaff340())playNotification340('support');
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'support_messages'},payload=>{
        if(payload.new?.sender_id!==prodSession?.user?.id)playNotification340('general');
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'announcements'},payload=>{
        if(payload.new?.created_by!==prodSession?.user?.id)playNotification340('general');
      }).subscribe();
  };

  const logout340Prev=logoutApp;
  logoutApp=async function(){try{soundRealtime340?.unsubscribe()}catch{}soundRealtime340=null;return logout340Prev()};
  const logoutAll340Prev=logoutEverywhere;
  logoutEverywhere=async function(){try{soundRealtime340?.unsubscribe()}catch{}soundRealtime340=null;return logoutAll340Prev()};

  const renderHome340Prev=renderHome;
  renderHome=function(){
    renderHome340Prev();
    const p=prefs340(),first=!p.first_home_seen_at,name=me()?.name||'Crew';
    const next=state.events?.[0],support=Number(state.supportUnread||0),live=(state.live?.markers||[]).length+(state.live?.share?1:0),since=p.last_gallery_seen_at?new Date(p.last_gallery_seen_at).getTime():0,newPhotos=(state.photos||[]).filter(x=>x.createdAt>since&&x.uploaderId!==me().id).length;
    const card=document.createElement('div');card.className='card home-greeting340';card.id='homeGreeting340';card.innerHTML=`<div class="eyebrow">${first?'Schön, dass du da bist':'4 Wheels 1 Family'}</div><h2>${first?'Herzlich willkommen':'Willkommen zurück'}, <span>${esc340(name)}</span>.</h2><div class="muted small">${first?'Mach es dir bequem – deine Crew-App ist bereit.':'Hier ist dein schneller Überblick.'}</div><div class="home-quick340"><button class="card clickable" id="homeSupport340"><b>${support}</b><span>SUPPORT NEU</span></button><button class="card clickable" id="homeLive340"><b>${live}</b><span>CREW LIVE</span></button><button class="card clickable" id="homePhotos340"><b>${newPhotos}</b><span>NEUE BILDER</span></button><button class="card clickable" id="homeEvent340"><b>${next?'1':'0'}</b><span>NÄCHSTES EVENT</span></button></div>`;
    $('#view')?.prepend(card);
    $('#homeSupport340').onclick=()=>window.__4w1fOpenSupportCenter340?.();
    $('#homeLive340').onclick=()=>{page='live';render()};
    $('#homePhotos340').onclick=()=>{page='gallery';render()};
    $('#homeEvent340').onclick=()=>{if(next)openEventDetail(next.id)};
    const now=new Date().toISOString(),patch={last_home_seen_at:now};if(first)patch.first_home_seen_at=now;savePrefs340(patch).catch(()=>{});
  };

  function normalizePhoto340(item){
    if(!item)return null;
    if(item.id)return (state.photos||[]).find(p=>p.id===item.id)||item;
    const src=item.src||item.data;
    if(src){const bySrc=(state.photos||[]).find(p=>p.data===src);if(bySrc)return bySrc}
    if(Number.isInteger(item.index))return state.photos?.[item.index]||item;
    return item;
  }
  function canDeletePhoto340(p){return !!p?.id&&(p.uploaderId===prodSession?.user?.id||isAdmin())}
  async function trashPhoto340(p){
    if(!canDeletePhoto340(p))return toast('Keine Berechtigung');
    const owner=state.users.find(u=>u.id===p.uploaderId)?.name||'Crew-Mitglied';
    if(!confirm(isAdmin()&&p.uploaderId!==me().id?`Bild von ${owner} in den Papierkorb verschieben?`:'Bild in den Papierkorb verschieben?'))return;
    const {error}=await sb.rpc('trash_gallery_item',{p_id:p.id});if(error)return toast(error.message);
    closeModal();await loadServerState();render();toast('Bild liegt jetzt im Papierkorb');
  }

  openPhotoViewer=function(item){
    const p=normalizePhoto340(item);if(!p)return;
    const src=p.data||p.src,label=p.label||'Crew Foto',owner=state.users.find(u=>u.id===p.uploaderId);
    openModal(label,`<div class="photo-viewer"><img src="${src}" alt="${esc340(label)}"><div class="photo-viewer-meta"><span class="label function">${p.kind==='events'?'EVENT':p.kind==='cars'?'FAHRZEUG':'CREW'}</span><b>${esc340(label)}</b>${owner?`<span class="muted tiny">von ${esc340(owner.name)}</span>`:''}</div></div>${canDeletePhoto340(p)?`<div class="photo-actions340"><button class="btn bad wide" id="trashPhoto340">Bild löschen</button></div><div class="notice" style="margin-top:8px">Das Bild wird zunächst 7 Tage im Papierkorb aufbewahrt.</div>`:''}`,()=>{$('#trashPhoto340')?.addEventListener('click',()=>trashPhoto340(p))});
  };

  async function openPhotoTrash340(){
    const [galleryRes,primaryRes]=await Promise.all([
      sb.from('gallery_items').select('*').not('deleted_at','is',null).order('deleted_at',{ascending:false}),
      sb.from('profile_media_trash').select('*').order('deleted_at',{ascending:false})
    ]);
    if(galleryRes.error||primaryRes.error)return toast(galleryRes.error?.message||primaryRes.error?.message);
    const items=[];
    for(const g of galleryRes.data||[]){const url=await signed340('crew-media',g.storage_path,3600);if(url)items.push({source:'gallery',id:g.id,owner_id:g.uploader_id,deleted_at:g.deleted_at,bucket:'crew-media',storage_path:g.storage_path,label:g.caption||'Crew Foto',url})}
    for(const p of primaryRes.data||[]){const url=await signed340(p.bucket,p.storage_path,3600);if(url)items.push({source:'primary',id:p.id,owner_id:p.owner_id,deleted_at:p.deleted_at,bucket:p.bucket,storage_path:p.storage_path,label:p.media_type==='avatar'?'Profilbild':'Fahrzeugbild',media_type:p.media_type,url})}
    items.sort((a,b)=>new Date(b.deleted_at)-new Date(a.deleted_at));
    openModal(isAdmin()?'Bilder-Papierkorb':'Mein Bilder-Papierkorb',`<div class="notice">Gelöschte Bilder – einschließlich Profil- und Fahrzeugbildern – werden nach <b>7 Tagen</b> automatisch endgültig entfernt. Bis dahin können sie wiederhergestellt werden.</div><div class="section trash-grid340">${items.map(g=>{const age=Math.max(0,Date.now()-new Date(g.deleted_at).getTime()),left=Math.max(0,7-Math.floor(age/86400000)),owner=state.users.find(u=>u.id===g.owner_id);return `<div class="card trash-item340"><img src="${g.url}" alt="${esc340(g.label)}"><div class="body"><b class="small">${esc340(g.label)}</b><div class="muted tiny">${owner?esc340(owner.name)+' · ':''}noch ca. ${left} Tag${left===1?'':'e'}</div><div class="actions"><button class="btn good sm" data-restore-source340="${g.source}" data-restore340="${g.id}">Wiederherstellen</button>${isAdmin()?`<button class="btn bad sm" data-purge-source340="${g.source}" data-purge340="${g.id}">Endgültig</button>`:''}</div></div></div>`}).join('')||'<div class="notice" style="grid-column:1/-1">Der Papierkorb ist leer.</div>'}</div>`,()=>{
      $$('[data-restore340]').forEach(b=>b.onclick=async()=>{
        const source=b.dataset.restoreSource340,id=b.dataset.restore340;
        const r=source==='primary'?await sb.rpc('restore_primary_media',{p_trash_id:id}):await sb.rpc('restore_gallery_item',{p_id:id});
        if(r.error)return toast(r.error.message);closeModal();await loadServerState();render();toast('Bild wiederhergestellt');
      });
      $$('[data-purge340]').forEach(b=>b.onclick=async()=>{
        const source=b.dataset.purgeSource340,id=b.dataset.purge340,g=items.find(x=>x.id===id&&x.source===source);if(!g||!confirm('Bild wirklich endgültig löschen? Das kann nicht rückgängig gemacht werden.'))return;
        const rm=await sb.storage.from(g.bucket).remove([g.storage_path]);if(rm.error)return toast(rm.error.message);
        const r=source==='primary'?await sb.rpc('delete_primary_media_permanently',{p_trash_id:id}):await sb.rpc('delete_gallery_row_permanently',{p_id:id});
        if(r.error)return toast(r.error.message);closeModal();await loadServerState();render();toast('Bild endgültig gelöscht');
      });
    });
  }

  const renderGallery340Prev=renderGallery;
  renderGallery=function(){
    renderGallery340Prev();
    const lead=$('#view .gallery-lead');if(lead&&!$('#photoTrash340')){const b=document.createElement('button');b.id='photoTrash340';b.className='btn outline sm';b.textContent='🗑 Papierkorb';lead.appendChild(b);b.onclick=openPhotoTrash340}
    savePrefs340({last_gallery_seen_at:new Date().toISOString()}).catch(()=>{});
  };

  function privacySwitch340(id,label,sub,checked){return `<label class="privacy-row340"><span><b class="small">${label}</b><br><span class="muted tiny">${sub}</span></span><input id="${id}" type="checkbox" ${checked?'checked':''}></label>`}
  openProfileEditor=function(){
    const u=me(),v=u._vehicle||{},p=privacy340(u);
    openModal('Profil & Privatsphäre',`<div class="field"><label>Name</label><input id="profName340" value="${esc340(u.name)}"></div><div class="field"><label>Instagram / Handle</label><input id="profIg340" value="${esc340(u.ig||'')}"></div><div class="field"><label>Über mich</label><textarea id="profBio340">${esc340(u.bio||'')}</textarea></div>
      <div class="section"><div class="sectionhead"><h2>Mein Fahrzeug</h2></div><div class="field2"><div class="field"><label>Marke</label><input id="vehMake340" value="${esc340(v.make||'')}"></div><div class="field"><label>Modell</label><input id="vehModel340" value="${esc340(v.model||'')}"></div></div><div class="field2"><div class="field"><label>Baujahr</label><input id="vehYear340" type="number" value="${v.year||''}"></div><div class="field"><label>Leistung (PS)</label><input id="vehPower340" type="number" value="${v.power_ps||''}"></div></div><div class="field"><label>Umbauten · Komma getrennt</label><input id="vehMods340" value="${esc340((v.mods||[]).join(', '))}"></div><div class="field"><label>Fahrzeugbeschreibung</label><textarea id="vehDesc340">${esc340(v.description||'')}</textarea></div></div>
      <div class="section"><div class="sectionhead"><h2>Privatsphäre</h2></div><div class="privacy-list340">${privacySwitch340('privacyIg340','Instagram anzeigen','Andere Crew-Mitglieder sehen deinen Handle.',p.instagram)}${privacySwitch340('privacyVehicle340','Fahrzeug anzeigen','Fahrzeugbereich im öffentlichen Crew-Profil.',p.vehicle)}${privacySwitch340('privacyPower340','Leistung anzeigen','PS-Zahl im Crew-Profil.',p.power)}${privacySwitch340('privacyMods340','Umbauten anzeigen','Modifikationen und Umbauten.',p.mods)}${privacySwitch340('privacyPhotos340','Profilbilder anzeigen','Dein persönliches Bilderraster.',p.photos)}</div></div>
      <button class="btn primary wide" id="saveProfile340" style="margin-top:12px">Profil speichern</button>`,()=>{
      $('#saveProfile340').onclick=async()=>{
        const privacy={instagram:$('#privacyIg340').checked,vehicle:$('#privacyVehicle340').checked,power:$('#privacyPower340').checked,mods:$('#privacyMods340').checked,photos:$('#privacyPhotos340').checked};
        const profile={display_name:$('#profName340').value.trim()||u.name,instagram:$('#profIg340').value.trim(),bio:$('#profBio340').value.trim(),privacy};
        const vehicle={user_id:prodSession.user.id,make:$('#vehMake340').value.trim(),model:$('#vehModel340').value.trim(),year:+$('#vehYear340').value||null,power_ps:+$('#vehPower340').value||null,mods:$('#vehMods340').value.split(',').map(x=>x.trim()).filter(Boolean),description:$('#vehDesc340').value.trim()};
        const [pr,vr]=await Promise.all([sb.from('profiles').update(profile).eq('id',prodSession.user.id),sb.from('vehicles').upsert(vehicle,{onConflict:'user_id'})]);if(pr.error||vr.error)return toast(pr.error?.message||vr.error?.message);closeModal();await loadServerState();renderProfile();toast('Profil & Privatsphäre gespeichert');
      };
    });
  };

  openMemberDetail=async function(id){
    const u=state.users.find(x=>x.id===id);if(!u)return;const v=u._vehicle||{},p=privacy340(u),photos=p.photos?(state.photos||[]).filter(x=>x.uploaderId===u.id&&x.profileVisible&&x.approved!==false):[];
    openModal(u.name,'<div class="notice">Profil wird geladen…</div>');
    const [avatarUrl,vehicleUrl]=await Promise.all([signed340('avatars',u._avatarPath),p.vehicle?signed340('crew-media',v.photo_path):Promise.resolve(null)]);
    openModal(u.name,`<div class="member-social"><div class="member-social-head"><div class="member-social-avatar">${avatarUrl?`<img src="${avatarUrl}" alt="">`:(u.emoji||'🚗')}</div><div class="member-social-meta"><div class="eyebrow">${roleLabel(u.role)}</div><h3>${esc340(u.name)}</h3>${p.instagram&&u.ig?`<div class="muted small">${esc340(u.ig)}</div>`:''}<div class="member-tags" style="margin-top:7px">${(u.labels||[]).map(l=>`<span class="label function">${esc340(l)}</span>`).join('')}</div></div></div>
      <div class="member-social-stats"><div><b>${p.photos?photos.length:'—'}</b><span>PROFILFOTOS</span></div><div><b>${p.power&&p.vehicle?(v.power_ps||'—'):'—'}</b><span>PS</span></div><div><b>${formatJoined(u.joinedAt)}</b><span>DABEI SEIT</span></div></div>
      <div class="card pad"><div class="eyebrow">Über mich</div><p class="small" style="line-height:1.6;margin-bottom:0">${esc340(u.bio||'Noch keine Beschreibung hinterlegt.')}</p></div>
      ${p.vehicle?`<div class="card member-vehicle"><div class="member-vehicle-photo">${vehicleUrl?`<img src="${vehicleUrl}" alt="">`:'Noch kein Fahrzeugbild'}</div><div class="member-vehicle-body"><div class="eyebrow">Fahrzeug</div><h3 style="margin:5px 0">${esc340([v.make,v.model].filter(Boolean).join(' ')||u.car||'Noch kein Fahrzeug')}</h3><div class="muted small">${v.year?`Baujahr ${v.year}`:''}${p.power&&v.power_ps?` · ${v.power_ps} PS`:''}</div>${v.description?`<p class="small" style="line-height:1.55">${esc340(v.description)}</p>`:''}${p.mods&&(v.mods||[]).length?`<div class="chips">${v.mods.map(m=>`<span class="chip active">${esc340(m)}</span>`).join('')}</div>`:''}</div></div>`:'<div class="notice">Dieses Mitglied blendet Fahrzeugdetails im Crew-Profil aus.</div>'}
      ${p.photos?`<div><div class="sectionhead"><h2>Profilbilder</h2></div><div class="member-photo-grid">${photos.map((x,i)=>`<button data-profile340="${i}"><img src="${x.data}" alt="${esc340(x.label||'Foto')}"></button>`).join('')||'<div class="notice" style="grid-column:1/-1">Noch keine Profilbilder.</div>'}</div></div>`:'<div class="notice">Profilbilder sind für andere Crew-Mitglieder ausgeblendet.</div>'}
      ${u.id===me().id?'<button class="btn primary wide" id="editOwn340">Profil bearbeiten</button>':''}</div>`,()=>{$$('[data-profile340]').forEach(b=>b.onclick=()=>openPhotoViewer(photos[+b.dataset.profile340]));$('#editOwn340')?.addEventListener('click',()=>{closeModal();openProfileEditor()})});
  };

  const renderProfile340Prev=renderProfile;
  renderProfile=function(){
    renderProfile340Prev();
    setTimeout(()=>{const grid=$('#view .admin-grid');if(grid&&!$('#profileSounds340')){const s=document.createElement('button');s.className='card admin-tool clickable';s.id='profileSounds340';s.innerHTML=`${I('bell')}<div><b>Sounds</b><br><span>Motor, Turbo & Support-Ton</span></div>`;grid.appendChild(s);s.onclick=openSoundSettings340}
      if(grid&&!$('#profileTrash340')){const t=document.createElement('button');t.className='card admin-tool clickable';t.id='profileTrash340';t.innerHTML=`${I('gallery')}<div><b>Bilder-Papierkorb</b><br><span>Gelöschte Bilder wiederherstellen</span></div>`;grid.appendChild(t);t.onclick=openPhotoTrash340}},40);
  };

  const supportStatus340=v=>({open:'Offen',in_progress:'In Bearbeitung',waiting_user:'Warten auf Nutzer',resolved:'Erledigt',closed:'Ticket geschlossen'})[v]||v;
  const supportPriority340=v=>({normal:'Normal',important:'Wichtig',urgent:'Dringend'})[v]||v;
  async function refreshSupportUnread340(){
    const {data:tickets}=await sb.from('support_tickets').select('id,updated_at');
    const {data:reads}=await sb.from('support_ticket_reads').select('ticket_id,last_read_at').eq('user_id',prodSession.user.id);
    const rm=new Map((reads||[]).map(r=>[r.ticket_id,new Date(r.last_read_at).getTime()]));
    state.supportUnread=(tickets||[]).filter(t=>new Date(t.updated_at).getTime()>(rm.get(t.id)||0)).length;
    return state.supportUnread;
  }
  async function markTicketRead340(ticketId){await sb.from('support_ticket_reads').upsert({ticket_id:ticketId,user_id:prodSession.user.id,last_read_at:new Date().toISOString()},{onConflict:'ticket_id,user_id'});await refreshSupportUnread340();updateBadge()}

  async function sendSupportReply340(t,body,file,waitAfter=false){
    if(!body&&!file)return toast('Nachricht oder Bild fehlt');
    let attachment_path=null;
    try{
      if(waitAfter&&isStaff340()&&t.status!=='waiting_user'){const st=await sb.rpc('set_support_ticket_status',{p_ticket_id:t.id,p_status:'waiting_user'});if(st.error)throw st.error}
      if(file){const safe=await sanitizeImageFile(file);attachment_path=`${t.id}/${prodSession.user.id}/${uuid()}.webp`;await checked(sb.storage.from('support-media').upload(attachment_path,safe,{contentType:'image/webp'}),'Anhang')}
      const {error}=await sb.from('support_messages').insert({ticket_id:t.id,sender_id:prodSession.user.id,body,attachment_path});if(error)throw error;
      closeModal();await window.__4w1fOpenSupportTicket340(t.id);
    }catch(e){productionError(e,'Support');toast('Nachricht konnte nicht gesendet werden')}
  }

  window.__4w1fOpenSupportTicket340=async function(ticketId){
    const {data:t,error}=await sb.from('support_tickets').select('*').eq('id',ticketId).single();if(error||!t)return toast(error?.message||'Ticket nicht gefunden');
    await markTicketRead340(ticketId);
    const [msgRes,noteRes,eventRes]=await Promise.all([
      sb.from('support_messages').select('*').eq('ticket_id',ticketId).order('created_at',{ascending:true}),
      isStaff340()?sb.from('support_internal_notes').select('*').eq('ticket_id',ticketId).order('created_at',{ascending:true}):Promise.resolve({data:[]}),
      sb.from('support_ticket_events').select('*').eq('ticket_id',ticketId).order('created_at',{ascending:true})
    ]);
    const msgs=msgRes.data||[],notes=noteRes.data||[],events=eventRes.data||[],assignee=state.users.find(u=>u.id===t.assigned_to),creator=state.users.find(u=>u.id===t.created_by);
    const senderIds=[...new Set([...msgs.map(m=>m.sender_id),...notes.map(n=>n.author_id),...events.map(e=>e.actor_id)].filter(Boolean))],senderMap=new Map(state.users.filter(u=>senderIds.includes(u.id)).map(u=>[u.id,u]));
    const attachments=new Map();for(const m of msgs)if(m.attachment_path)attachments.set(m.id,await signed340('support-media',m.attachment_path,3600));
    const timeline=[...msgs.map(x=>({...x,_type:'message'})),...events.map(x=>({...x,_type:'event'}))].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    const timelineHtml=timeline.map(x=>{
      if(x._type==='event'){const actor=senderMap.get(x.actor_id),txt=x.event_type==='claimed'?`${actor?.name||'Support'} hat das Ticket übernommen.`:x.event_type==='closed'?`${actor?.name||'Support'} hat das Ticket geschlossen.`:`Status: ${supportStatus340(x.old_status)} → ${supportStatus340(x.new_status)}`;return `<div class="support-event340">${esc340(txt)} · ${fmtAgo340(x.created_at)}</div>`}
      const sender=senderMap.get(x.sender_id);return `<div class="ticket-msg ${x.sender_id===prodSession.user.id?'me':''}"><b>${esc340(sender?.name||'Support')}</b>${x.body?`<div class="small" style="margin-top:4px;white-space:pre-wrap">${esc340(x.body)}</div>`:''}${attachments.get(x.id)?`<a class="ticket-attachment" href="${attachments.get(x.id)}" target="_blank" rel="noopener"><img src="${attachments.get(x.id)}" alt="Anhang"></a>`:''}<span class="tiny muted">${fmtAgo340(x.created_at)}</span></div>`}).join('');
    const staff=isStaff340()&&((t.channel==='owner'&&isOwner())||t.channel==='admin');
    const staffControls=staff&&t.status!=='closed'?`<div class="support-owner340"><div><b>${assignee?`Bearbeitet von ${esc340(assignee.name)}`:'Noch nicht übernommen'}</b><div class="muted tiny">${supportStatus340(t.status)}</div></div><button class="btn primary sm" id="claimTicket340">${t.assigned_to===me().id?'In Bearbeitung':'Übernehmen'}</button></div><div class="actions"><button class="btn outline sm" data-ticket-status340="open">Offen</button><button class="btn outline sm" data-ticket-status340="in_progress">In Bearbeitung</button><button class="btn outline sm" data-ticket-status340="waiting_user">Warten auf Nutzer</button><button class="btn bad sm" id="closeTicket340">Ticket schließen</button></div>`:t.status!=='closed'?'<div class="actions"><button class="btn bad sm" id="closeOwnTicket340">Ticket schließen</button></div>':'';
    const notesHtml=staff?`<div class="section"><div class="sectionhead"><h2>Interne Admin-Notizen</h2></div><div class="list">${notes.map(n=>{const a=senderMap.get(n.author_id);return `<div class="card pad internal-note340"><b>${esc340(a?.name||'Admin')}</b><div class="small" style="white-space:pre-wrap;margin-top:4px">${esc340(n.body)}</div><div class="muted tiny">${fmtAgo340(n.created_at)} · nur Support-Team</div></div>`}).join('')||'<div class="notice">Noch keine internen Notizen.</div>'}</div>${t.status!=='closed'?'<div class="field"><label>Interne Notiz</label><textarea id="supportNote340" placeholder="Nur für Admins/Owner sichtbar"></textarea></div><button class="btn warn wide" id="addSupportNote340">Interne Notiz speichern</button>':''}</div>`:'';
    openModal(`Ticket #${t.ticket_no}`,`<div class="card pad"><div class="eyebrow">${t.channel==='owner'?'Owner Support':'Admin Support'} · ${supportPriority340(t.priority)}</div><h3 style="margin:5px 0">${esc340(t.subject)}</h3><div class="muted tiny">${supportStatus340(t.status)} · von ${esc340(creator?.name||'Mitglied')} · ${fmtAgo340(t.created_at)}</div></div>${staffControls}<div class="section ticket-chat">${timelineHtml||'<div class="notice">Noch keine Nachrichten.</div>'}</div>${t.status!=='closed'?`<div class="section"><div class="field"><label>Antwort</label><textarea id="ticketReply340" placeholder="Nachricht schreiben …"></textarea></div><label class="btn outline wide">Bild anhängen<input hidden type="file" accept="image/jpeg,image/png,image/webp" id="ticketAttachment340"></label><button class="btn primary wide" id="sendTicketReply340" style="margin-top:8px">Antwort senden</button>${staff&&t.status==='in_progress'?'<button class="btn outline wide" id="sendWaitReply340" style="margin-top:8px">Antwort senden · danach auf Nutzer warten</button>':''}</div>`:'<div class="notice" style="margin-top:10px">Dieses Ticket ist geschlossen. Zum erneuten Thema bitte ein neues Ticket erstellen.</div>'}${notesHtml}`,()=>{
      $('#claimTicket340')?.addEventListener('click',async()=>{const {error}=await sb.rpc('claim_support_ticket',{p_ticket_id:t.id});if(error)return toast(error.message);closeModal();await window.__4w1fOpenSupportTicket340(t.id);toast('Ticket übernommen · In Bearbeitung')});
      $$('[data-ticket-status340]').forEach(b=>b.onclick=async()=>{const {error}=await sb.rpc('set_support_ticket_status',{p_ticket_id:t.id,p_status:b.dataset.ticketStatus340});if(error)return toast(error.message);closeModal();await window.__4w1fOpenSupportTicket340(t.id)});
      $('#closeTicket340')?.addEventListener('click',async()=>{if(!confirm('Ticket wirklich schließen? Nur diese Aktion setzt den Status auf „Ticket geschlossen“.'))return;const {error}=await sb.rpc('close_support_ticket',{p_ticket_id:t.id});if(error)return toast(error.message);closeModal();await window.__4w1fOpenSupportTicket340(t.id)});
      $('#closeOwnTicket340')?.addEventListener('click',async()=>{if(!confirm('Dein Ticket wirklich schließen?'))return;const {error}=await sb.rpc('close_support_ticket',{p_ticket_id:t.id});if(error)return toast(error.message);closeModal();await window.__4w1fOpenSupportTicket340(t.id)});
      $('#sendTicketReply340')?.addEventListener('click',()=>sendSupportReply340(t,$('#ticketReply340').value.trim(),$('#ticketAttachment340')?.files?.[0],false));
      $('#sendWaitReply340')?.addEventListener('click',()=>sendSupportReply340(t,$('#ticketReply340').value.trim(),$('#ticketAttachment340')?.files?.[0],true));
      $('#addSupportNote340')?.addEventListener('click',async()=>{const body=$('#supportNote340').value.trim();if(!body)return toast('Notiz ist leer');const {error}=await sb.from('support_internal_notes').insert({ticket_id:t.id,author_id:prodSession.user.id,body});if(error)return toast(error.message);closeModal();await window.__4w1fOpenSupportTicket340(t.id);toast('Interne Notiz gespeichert')});
    });
  };

  window.__4w1fCreateSupportTicket340=async function(){
    openModal('Support-Ticket erstellen',`<div class="field"><label>Bereich</label><select id="supportChannel340"><option value="admin">Admin Support · für alle Admins sichtbar</option><option value="owner">Owner Support · nur Nutzer + Owner</option></select></div><div class="field"><label>Betreff</label><input id="supportSubject340" placeholder="Worum geht es?"></div><div class="field2"><div class="field"><label>Kategorie</label><select id="supportCategory340"><option>App / Bug</option><option>Account</option><option>Crew / Organisation</option><option>Sonstiges</option></select></div><div class="field"><label>Priorität</label><select id="supportPriority340"><option value="normal">Normal</option><option value="important">Wichtig</option><option value="urgent">Dringend</option></select></div></div><div class="field"><label>Nachricht</label><textarea id="supportBody340" placeholder="Beschreibe dein Anliegen möglichst genau."></textarea></div><label class="btn outline wide">Screenshot / Bild anhängen<input hidden type="file" accept="image/jpeg,image/png,image/webp" id="supportAttachment340"></label><button class="btn primary wide" id="createSupportTicket340" style="margin-top:8px">Ticket einreichen</button>`,()=>{
      $('#createSupportTicket340').onclick=async()=>{const subject=$('#supportSubject340').value.trim(),body=$('#supportBody340').value.trim(),file=$('#supportAttachment340').files?.[0];if(!subject||!body)return toast('Betreff und Nachricht fehlen');const btn=$('#createSupportTicket340');btn.disabled=true;btn.textContent='Ticket wird eingereicht…';try{
        const {data:t,error}=await sb.from('support_tickets').insert({created_by:prodSession.user.id,channel:$('#supportChannel340').value,subject,category:$('#supportCategory340').value,priority:$('#supportPriority340').value,status:'open'}).select('*').single();if(error)throw error;
        let attachment_path=null;if(file){try{const safe=await sanitizeImageFile(file);attachment_path=`${t.id}/${prodSession.user.id}/${uuid()}.webp`;await checked(sb.storage.from('support-media').upload(attachment_path,safe,{contentType:'image/webp'}),'Anhang')}catch(e){productionError(e,'Support-Anhang')}}
        const m=await sb.from('support_messages').insert({ticket_id:t.id,sender_id:prodSession.user.id,body,attachment_path});if(m.error)throw m.error;
        playSound340('subtle',true);closeModal();openModal('Ticket eingereicht',`<div class="support-confirm340"><div class="check">✓</div><div class="eyebrow">Erfolgreich eingereicht</div><h3>Ticket #${t.ticket_no}</h3><p class="muted small">Dein Support-Ticket wurde erfolgreich übermittelt. Der aktuelle Status ist <b>Offen</b>.</p></div><div class="actions"><button class="btn primary" id="openCreatedTicket340">Ticket öffnen</button><button class="btn outline" id="backSupport340">Zum Support</button></div>`,()=>{$('#openCreatedTicket340').onclick=()=>{closeModal();window.__4w1fOpenSupportTicket340(t.id)};$('#backSupport340').onclick=()=>{closeModal();window.__4w1fOpenSupportCenter340()}});
      }catch(e){productionError(e,'Support');toast('Ticket konnte nicht eingereicht werden');btn.disabled=false;btn.textContent='Ticket einreichen'}};
    });
  };

  window.__4w1fOpenSupportCenter340=async function(){
    const {data,error}=await sb.from('support_tickets').select('*').order('updated_at',{ascending:false});if(error)return toast(error.message);
    const {data:reads}=await sb.from('support_ticket_reads').select('ticket_id,last_read_at').eq('user_id',prodSession.user.id),rm=new Map((reads||[]).map(r=>[r.ticket_id,new Date(r.last_read_at).getTime()]));
    const tickets=data||[],mine=tickets.filter(t=>t.created_by===prodSession.user.id),staff=isStaff340()?tickets:[];
    const renderRows=list=>list.map(t=>{const unread=new Date(t.updated_at).getTime()>(rm.get(t.id)||0),assignee=state.users.find(u=>u.id===t.assigned_to);return `<button class="card ticket-row clickable ${unread?'unread':''}" data-support340="${t.id}"><div class="ticket-top"><b>${unread?'● ':''}#${t.ticket_no} · ${esc340(t.subject)}</b><span class="ticket-status">${supportStatus340(t.status)}</span></div><div class="muted tiny">${t.channel==='owner'?'Owner':'Admin'} Support · ${supportPriority340(t.priority)}${assignee?` · ${esc340(assignee.name)}`:''} · ${fmtAgo340(t.updated_at)}</div></button>`}).join('')||'<div class="notice">Keine Tickets in diesem Bereich.</div>';
    openModal('4W1F Support',`<button class="btn primary wide" id="supportNew340">+ Neues Ticket</button>${isStaff340()?`<div class="support-tabs" style="margin-top:10px"><button class="btn primary sm" data-support-tab340="staff">Support Inbox</button><button class="btn outline sm" data-support-tab340="mine">Meine Tickets</button></div><div class="list" id="supportList340">${renderRows(staff)}</div>`:`<div class="section"><div class="sectionhead"><h2>Meine Tickets</h2></div><div class="list">${renderRows(mine)}</div></div>`}`,()=>{
      $('#supportNew340').onclick=()=>{closeModal();window.__4w1fCreateSupportTicket340()};
      const bind=()=>$$('[data-support340]').forEach(b=>b.onclick=()=>{closeModal();window.__4w1fOpenSupportTicket340(b.dataset.support340)});bind();
      $$('[data-support-tab340]').forEach(b=>b.onclick=()=>{$$('[data-support-tab340]').forEach(x=>{x.classList.toggle('primary',x===b);x.classList.toggle('outline',x!==b)});$('#supportList340').innerHTML=renderRows(b.dataset.supportTab340==='mine'?mine:staff);bind()});
    });
  };

  async function markGenericRead340(key){if(!key)return;await sb.from('app_notification_reads').upsert({user_id:prodSession.user.id,notification_key:key,read_at:new Date().toISOString()},{onConflict:'user_id,notification_key'});state.notificationReads340?.set(key,new Date().toISOString())}

  async function showReleaseNotes340(force=false){
    const {data:rel,error}=await sb.from('update_releases').select('*').eq('version',RELEASE_VERSION_340).eq('active',true).maybeSingle();if(error||!rel)return;
    if(!force){const {data:seen}=await sb.from('update_receipts').select('version').eq('version',RELEASE_VERSION_340).eq('user_id',prodSession.user.id).maybeSingle();if(seen)return}
    const notes=(Array.isArray(rel.notes)?rel.notes:[]).filter(n=>!Array.isArray(n.roles)||n.roles.includes(me().role));
    openModal(`Neu in ${rel.version}`,`<div class="card pad"><div class="eyebrow">4W1F Update</div><h3 style="margin:6px 0">${esc340(rel.title||'Was ist neu?')}</h3><div class="muted small">Kurz erklärt – das hat sich für dich geändert.</div></div><div class="section">${notes.map(n=>`<div class="release-note"><b>${esc340(n.title||'Neu')}</b><span>${esc340(n.body||'')}</span></div>`).join('')||'<div class="notice">Für deine Rolle gibt es keine sichtbaren Änderungen.</div>'}</div><button class="btn primary wide" id="releaseDone340" style="margin-top:12px">Verstanden · App öffnen</button>`,()=>{$('#releaseDone340').onclick=async()=>{await sb.from('update_receipts').upsert({version:RELEASE_VERSION_340,user_id:prodSession.user.id,seen_at:new Date().toISOString()},{onConflict:'version,user_id'});await markGenericRead340(`release:${RELEASE_VERSION_340}`);closeModal()}});
  }

  showNotifications=async function(){
    openModal('Benachrichtigungen','<div class="notice">Benachrichtigungen werden geladen…</div>');
    const uid=prodSession.user.id;
    const [ticketsRes,readsRes,releaseSeenRes]=await Promise.all([
      sb.from('support_tickets').select('*').order('updated_at',{ascending:false}),
      sb.from('support_ticket_reads').select('ticket_id,last_read_at').eq('user_id',uid),
      sb.from('update_receipts').select('version').eq('version',RELEASE_VERSION_340).eq('user_id',uid).maybeSingle()
    ]);
    const ticketReads=new Map((readsRes.data||[]).map(x=>[x.ticket_id,new Date(x.last_read_at).getTime()])),generic=state.notificationReads340||new Map();
    const anns=(state.announcements||[]).filter(a=>!(a.hiddenBy||[]).includes(uid)).map(a=>({type:'announcement',key:`announcement:${a.id}`,id:a.id,title:a.title,sub:a.body||'',time:a.created||'',unread:!(a.readBy||[]).includes(uid)}));
    const supports=(ticketsRes.data||[]).map(t=>({type:'support',key:`support:${t.id}`,id:t.id,title:`Ticket #${t.ticket_no} · ${t.subject}`,sub:`${supportStatus340(t.status)} · ${t.channel==='owner'?'Owner':'Admin'} Support`,time:fmtAgo340(t.updated_at),unread:new Date(t.updated_at).getTime()>(ticketReads.get(t.id)||0)}));
    const events=(state.events||[]).filter(e=>e.past!==true).slice(0,20).map(e=>({type:'event',key:`event:${e.id}`,id:e.id,title:e.name,sub:`${e.date||'Termin folgt'} · ${e.place||'Treffpunkt folgt'}`,time:e.time?e.time+' Uhr':'',unread:!generic.has(`event:${e.id}`)}));
    const system=[{type:'system',key:`release:${RELEASE_VERSION_340}`,id:RELEASE_VERSION_340,title:`Update ${RELEASE_VERSION_340}`,sub:'Sieh dir kurz an, was sich in der App geändert hat.',time:'System',unread:!releaseSeenRes.data}];
    const all=[...anns,...supports,...events,...system];
    const label={all:'Alle',announcement:'Ankündigungen',support:'Support',event:'Events',system:'System'};
    const draw=type=>{
      const rows=(type==='all'?all:all.filter(x=>x.type===type));
      $('#notifList340').innerHTML=rows.map(x=>`<button class="card ticket-row clickable notif-item340 ${x.unread?'unread':''}" data-notif340="${x.type}|${x.id}"><div class="ticket-top"><b>${x.unread?'<span class="notif-dot340">●</span> ':''}${esc340(x.title)}</b><span class="label function">${label[x.type]}</span></div><div class="muted tiny">${esc340(x.sub)}${x.time?` · ${esc340(x.time)}`:''}</div></button>`).join('')||'<div class="notice">Hier ist gerade nichts Neues.</div>';
      $$('[data-notif340]').forEach(b=>b.onclick=async()=>{const [kind,id]=b.dataset.notif340.split('|');if(kind==='announcement'){const a=state.announcements.find(x=>x.id===id);a.readBy??=[];if(!a.readBy.includes(uid))a.readBy.push(uid);save();closeModal();openAnnouncementDetail(id)}else if(kind==='support'){closeModal();window.__4w1fOpenSupportTicket340(id)}else if(kind==='event'){await markGenericRead340(`event:${id}`);closeModal();openEventDetail(id)}else{await markGenericRead340(`release:${RELEASE_VERSION_340}`);closeModal();showReleaseNotes340(true)}})
    };
    openModal('Benachrichtigungen',`<div class="notif-tabs340">${['all','announcement','support','event','system'].map((x,i)=>`<button class="btn ${i===0?'primary':'outline'} sm" data-ntab340="${x}">${label[x]}</button>`).join('')}</div><div class="list" id="notifList340"></div><div class="section actions"><button class="btn outline" id="markAllNotif340">Alles gelesen</button><button class="btn outline" id="notifSounds340">🔊 Sounds</button></div>`,()=>{
      draw('all');$$('[data-ntab340]').forEach(b=>b.onclick=()=>{$$('[data-ntab340]').forEach(x=>{x.classList.toggle('primary',x===b);x.classList.toggle('outline',x!==b)});draw(b.dataset.ntab340)});
      $('#notifSounds340').onclick=()=>{closeModal();openSoundSettings340()};
      $('#markAllNotif340').onclick=async()=>{
        for(const a of state.announcements||[]){a.readBy??=[];if(!a.readBy.includes(uid))a.readBy.push(uid)}save();
        const now=new Date().toISOString(),tickets=ticketsRes.data||[];if(tickets.length)await sb.from('support_ticket_reads').upsert(tickets.map(t=>({ticket_id:t.id,user_id:uid,last_read_at:now})),{onConflict:'ticket_id,user_id'});
        const genericRows=events.map(e=>({user_id:uid,notification_key:e.key,read_at:now}));if(genericRows.length)await sb.from('app_notification_reads').upsert(genericRows,{onConflict:'user_id,notification_key'});
        await sb.from('update_receipts').upsert({version:RELEASE_VERSION_340,user_id:uid,seen_at:now},{onConflict:'version,user_id'});
        closeModal();await loadServerState();updateBadge();toast('Alles als gelesen markiert');
      };
    });
  };

  function injectCrewPlaceChips340(inputId,mapElementId){
    const input=$('#'+inputId),mapEl=$('#'+mapElementId),places=state.crewPlaces340||[];if(!input||!mapEl||!places.length||document.getElementById(inputId+'CrewPlaces340'))return;
    const wrap=document.createElement('div');wrap.id=inputId+'CrewPlaces340';wrap.innerHTML=`<div class="muted tiny" style="margin:7px 0 5px">Crew-Orte</div><div class="crew-place-chips340">${places.map(p=>`<button class="chip" type="button" data-place340="${p.id}">${esc340(p.icon||'📍')} ${esc340(p.name)}</button>`).join('')}</div>`;mapEl.insertAdjacentElement('beforebegin',wrap);
    wrap.querySelectorAll('[data-place340]').forEach(b=>b.onclick=()=>{const p=places.find(x=>x.id===b.dataset.place340);if(!p)return;input.value=p.address?`${p.name}, ${p.address}`:p.name;input.dispatchEvent(new Event('input',{bubbles:true}));try{if(modalMap&&window.L){modalMap.setView([p.latitude,p.longitude],16);modalMap.fire('click',{latlng:L.latLng(p.latitude,p.longitude)})}}catch{}});
  }

  const eventEditor340Prev=openEventEditor;
  openEventEditor=function(){eventEditor340Prev();setTimeout(()=>injectCrewPlaceChips340('eventPlace','eventCreateMap'),40)};
  const annEditor340Prev=openAnnouncementEditor;
  openAnnouncementEditor=function(){annEditor340Prev();setTimeout(()=>injectCrewPlaceChips340('annPlace','annMap'),40)};

  async function openCrewPlaceEditor340(place=null){
    let pin=place?{lat:Number(place.latitude),lng:Number(place.longitude)}:{lat:null,lng:null};
    openModal(place?'Crew-Ort bearbeiten':'Crew-Ort hinzufügen',`<div class="field"><label>Name</label><input id="crewPlaceName340" value="${esc340(place?.name||'')}" placeholder="z. B. Hockenheimring"></div><div class="field"><label>Adresse / Suche</label><div class="field2"><input id="crewPlaceAddress340" value="${esc340(place?.address||'')}" placeholder="Ort oder Adresse"><button class="btn outline" id="searchCrewPlace340">Suchen</button></div></div><div class="field"><label>Icon</label><input id="crewPlaceIcon340" value="${esc340(place?.icon||'📍')}" maxlength="4"></div><div id="crewPlaceMap340" class="map" style="height:260px"></div><div class="notice" id="crewPlaceHint340">Suche einen Ort oder tippe auf die Karte. Der Pin kann verschoben werden.</div><button class="btn primary wide" id="saveCrewPlace340" style="margin-top:10px">Crew-Ort speichern</button>`,()=>{
      const center=pin.lat?[pin.lat,pin.lng]:[49.32,8.55];modalMap=L.map('crewPlaceMap340').setView(center,pin.lat?15:11);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(modalMap);let marker=null;
      const setPin=(lat,lng)=>{pin={lat,lng};if(marker)marker.setLatLng([lat,lng]);else{marker=L.marker([lat,lng],{draggable:true}).addTo(modalMap);marker.on('dragend',e=>{const x=e.target.getLatLng();pin={lat:x.lat,lng:x.lng}})}modalMap.setView([lat,lng],15)};
      if(pin.lat)setPin(pin.lat,pin.lng);modalMap.on('click',e=>setPin(e.latlng.lat,e.latlng.lng));
      $('#searchCrewPlace340').onclick=async()=>{const q=$('#crewPlaceAddress340').value.trim()||$('#crewPlaceName340').value.trim();if(!q)return toast('Ort fehlt');$('#crewPlaceHint340').textContent='Ort wird gesucht…';try{const g=await geocodeAddress(q);setPin(g.lat,g.lng);$('#crewPlaceHint340').textContent='Gefunden · Pin bei Bedarf exakt verschieben.'}catch{$('#crewPlaceHint340').textContent='Ort nicht gefunden · bitte Pin manuell setzen.'}};
      $('#saveCrewPlace340').onclick=async()=>{const name=$('#crewPlaceName340').value.trim();if(!name||pin.lat==null)return toast('Name und Karten-Pin fehlen');const row={name,address:$('#crewPlaceAddress340').value.trim(),latitude:pin.lat,longitude:pin.lng,icon:$('#crewPlaceIcon340').value.trim()||'📍',created_by:place?.created_by||prodSession.user.id};const q=place?sb.from('crew_places').update(row).eq('id',place.id):sb.from('crew_places').insert(row);const {error}=await q;if(error)return toast(error.message);closeModal();await loadServerState();openCrewPlaces340();toast('Crew-Ort gespeichert')};
    });
  }
  async function openCrewPlaces340(){
    const {data,error}=await sb.from('crew_places').select('*').order('name');if(error)return toast(error.message);const places=data||[];
    openModal('Crew-Orte',`<div class="notice">Gespeicherte Crew-Orte erscheinen direkt beim Erstellen von Treffen und Ankündigungen.</div>${isAdmin()?'<button class="btn primary wide" id="newCrewPlace340" style="margin-top:10px">+ Crew-Ort hinzufügen</button>':''}<div class="section list">${places.map(p=>`<div class="card pad place-row340"><div><b>${esc340(p.icon||'📍')} ${esc340(p.name)}</b><div class="muted tiny">${esc340(p.address||`${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}`)}</div></div>${isAdmin()?`<div class="actions"><button class="btn outline sm" data-edit-place340="${p.id}">Bearbeiten</button><button class="btn bad sm" data-del-place340="${p.id}">Löschen</button></div>`:''}</div>`).join('')||'<div class="notice">Noch keine Crew-Orte gespeichert.</div>'}</div>`,()=>{
      $('#newCrewPlace340')?.addEventListener('click',()=>{closeModal();openCrewPlaceEditor340()});
      $$('[data-edit-place340]').forEach(b=>b.onclick=()=>{const p=places.find(x=>x.id===b.dataset.editPlace340);closeModal();openCrewPlaceEditor340(p)});
      $$('[data-del-place340]').forEach(b=>b.onclick=async()=>{const p=places.find(x=>x.id===b.dataset.delPlace340);if(!p||!confirm(`${p.name} wirklich aus den Crew-Orten löschen?`))return;const {error}=await sb.from('crew_places').delete().eq('id',p.id);if(error)return toast(error.message);closeModal();await loadServerState();openCrewPlaces340()});
    });
  }

  async function openAudit340(){
    const {data,error}=await sb.from('audit_log').select('*').order('created_at',{ascending:false}).limit(200);if(error)return toast(error.message);const rows=data||[];
    const names=new Map((state.users||[]).map(u=>[u.id,u.name])),labels={invite_claimed:'Einladung angenommen',invite_created:'Einladung erstellt',gallery_trash:'Bild gelöscht',gallery_restore:'Bild wiederhergestellt',gallery_delete_permanent:'Bild endgültig gelöscht',gallery_auto_purge:'Bild automatisch entfernt',support_claim:'Support-Ticket übernommen',support_status:'Ticket-Status geändert',support_close:'Ticket geschlossen',crew_place_create:'Crew-Ort erstellt',crew_place_update:'Crew-Ort geändert',crew_place_delete:'Crew-Ort gelöscht',profile_admin_change:'Rolle / Labels geändert',event_create:'Treffen erstellt',event_delete:'Treffen gelöscht',announcement_create:'Ankündigung erstellt',announcement_delete:'Ankündigung gelöscht'};
    openModal('Admin-Aktivitätsverlauf',`<div class="notice">Serverseitiger Verlauf wichtiger Verwaltungsaktionen. Die Einträge dienen der Nachvollziehbarkeit und können nicht über diese Ansicht verändert werden.</div><div class="section list">${rows.map(a=>`<div class="card audit-row340"><b>${esc340(labels[a.action]||a.action)}</b><div class="small">${esc340(names.get(a.actor_id)|| (a.actor_id?'Unbekannter Admin':'System'))}</div><div class="meta">${fmtAgo340(a.created_at)} · ${esc340(a.entity_type||'System')}${a.entity_id?` · ${esc340(a.entity_id)}`:''}</div></div>`).join('')||'<div class="notice">Noch keine Aktivitäten protokolliert.</div>'}</div>`);
  }

  const renderAdmin340Prev=renderAdmin;
  renderAdmin=function(){
    renderAdmin340Prev();
    setTimeout(()=>{const system=$('#securityAdmin')?.closest('.admin-grid'),meet=$('#eventAdmin')?.closest('.admin-grid');if(meet&&!$('#crewPlacesAdmin340')){const b=document.createElement('button');b.className='card admin-tool clickable';b.id='crewPlacesAdmin340';b.innerHTML=`${I('pin')}<div><b>Crew-Orte</b><br><span>Favoriten für Treffen & Karten</span></div>`;meet.appendChild(b);b.onclick=openCrewPlaces340}if(system&&!$('#auditAdmin340')){const b=document.createElement('button');b.className='card admin-tool clickable';b.id='auditAdmin340';b.innerHTML=`${I('shield')}<div><b>Aktivitätsverlauf</b><br><span>Admin-Aktionen nachvollziehen</span></div>`;system.appendChild(b);b.onclick=openAudit340}},40);
  };

  const renderProfilePlaces340Prev=renderProfile;
  renderProfile=function(){renderProfilePlaces340Prev();setTimeout(()=>{const grid=$('#view .admin-grid');if(grid&&!$('#profilePlaces340')){const b=document.createElement('button');b.className='card admin-tool clickable';b.id='profilePlaces340';b.innerHTML=`${I('pin')}<div><b>Crew-Orte</b><br><span>Gespeicherte Treffpunkte</span></div>`;grid.appendChild(b);b.onclick=openCrewPlaces340}},60)};

  const bootstrap340Prev=bootstrapAuthenticated;
  bootstrapAuthenticated=async function(){await bootstrap340Prev();if(!prodSession||!serverLoaded)return;let tries=0;const attempt=async()=>{if(tries++>5)return;const modal=$('#modal');if(modal?.classList.contains('show'))return setTimeout(attempt,1200);await showReleaseNotes340(false)};setTimeout(attempt,1100)};

  async function openImageManager340(allCrew=false){
    let q=sb.from('gallery_items').select('*').is('deleted_at',null).order('created_at',{ascending:false});
    if(!allCrew)q=q.eq('uploader_id',prodSession.user.id);
    const {data,error}=await q;if(error)return toast(error.message);const rows=data||[],items=[];
    for(const g of rows){const url=await signed340('crew-media',g.storage_path,3600);if(url)items.push({...g,url})}
    const targetUsers=allCrew?(state.users||[]):(state.users||[]).filter(u=>u.id===prodSession.user.id),primary=[];
    for(const u of targetUsers){
      if(u._avatarPath){const url=await signed340('avatars',u._avatarPath,3600);if(url)primary.push({owner_id:u.id,media_type:'avatar',label:'Profilbild',url})}
      const vp=u._vehicle?.photo_path;if(vp){const url=await signed340('crew-media',vp,3600);if(url)primary.push({owner_id:u.id,media_type:'vehicle',label:'Fahrzeugbild',url})}
    }
    const primaryHtml=primary.map(p=>{const owner=state.users.find(u=>u.id===p.owner_id);return `<div class="card trash-item340"><img src="${p.url}" alt="${esc340(p.label)}"><div class="body"><b class="small">${esc340(p.label)}</b><div class="muted tiny">${allCrew&&owner?esc340(owner.name)+' · ':''}Hauptbild</div><div class="actions"><button class="btn bad sm" data-primary-trash340="${p.owner_id}|${p.media_type}">Löschen</button></div></div></div>`}).join('');
    const galleryHtml=items.map(g=>{const owner=state.users.find(u=>u.id===g.uploader_id),vis=[g.profile_visible?'Profil':'',g.gallery_visible?'Galerie':''].filter(Boolean).join(' + ')||'Privat';return `<div class="card trash-item340"><img src="${g.url}" alt="${esc340(g.caption||'Bild')}"><div class="body"><b class="small">${esc340(g.caption||'Crew Foto')}</b><div class="muted tiny">${allCrew&&owner?esc340(owner.name)+' · ':''}${esc340(vis)}</div><div class="actions"><button class="btn bad sm" data-manage-trash340="${g.id}">Löschen</button></div></div></div>`}).join('');
    openModal(allCrew?'Crew-Bilder verwalten':'Meine Bilder',`<div class="notice">${allCrew?'Als Admin kannst du jedes Profil-, Fahrzeug- und Crew-Bild verwalten und in den Papierkorb legen.':'Hier kannst du Profilbild, Fahrzeugbild sowie sichtbare und private Uploads verwalten.'}</div>${primary.length?`<div class="section"><div class="sectionhead"><h2>Profil & Fahrzeug</h2></div><div class="trash-grid340">${primaryHtml}</div></div>`:''}<div class="section"><div class="sectionhead"><h2>Uploads</h2></div><div class="trash-grid340">${galleryHtml||'<div class="notice" style="grid-column:1/-1">Keine Uploads vorhanden.</div>'}</div></div><button class="btn outline wide" id="openTrashFromManager340" style="margin-top:10px">Papierkorb öffnen</button>`,()=>{
      $$('[data-primary-trash340]').forEach(b=>b.onclick=async()=>{const [ownerId,type]=b.dataset.primaryTrash340.split('|');const owner=state.users.find(u=>u.id===ownerId);if(!confirm(`${type==='avatar'?'Profilbild':'Fahrzeugbild'}${allCrew&&owner?' von '+owner.name:''} in den Papierkorb verschieben?`))return;const {error}=await sb.rpc('trash_primary_media',{p_owner_id:ownerId,p_media_type:type});if(error)return toast(error.message);closeModal();await loadServerState();openImageManager340(allCrew);toast('Bild in den Papierkorb verschoben')});
      $$('[data-manage-trash340]').forEach(b=>b.onclick=async()=>{const g=items.find(x=>x.id===b.dataset.manageTrash340);if(!g)return;if(!confirm('Bild in den Papierkorb verschieben?'))return;const {error}=await sb.rpc('trash_gallery_item',{p_id:g.id});if(error)return toast(error.message);closeModal();await loadServerState();openImageManager340(allCrew);toast('Bild in den Papierkorb verschoben')});
      $('#openTrashFromManager340').onclick=()=>{closeModal();openPhotoTrash340()};
    });
  }

  const renderProfileImages340Prev=renderProfile;
  renderProfile=function(){renderProfileImages340Prev();setTimeout(()=>{const grid=$('#view .admin-grid');if(grid&&!$('#profileImages340')){const b=document.createElement('button');b.className='card admin-tool clickable';b.id='profileImages340';b.innerHTML=`${I('gallery')}<div><b>Meine Bilder</b><br><span>Sichtbare & private Uploads verwalten</span></div>`;grid.appendChild(b);b.onclick=()=>openImageManager340(false)}},80)};

  const renderAdminImages340Prev=renderAdmin;
  renderAdmin=function(){renderAdminImages340Prev();setTimeout(()=>{const g=$('#galleryAdmin');if(g){g.querySelector('span')?.replaceChildren(document.createTextNode('Alle Uploads & Papierkorb'));g.onclick=()=>openImageManager340(true)}},80)};

})();

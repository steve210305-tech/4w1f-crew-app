/* 4W1F 3.4.0 feature pack — loaded after update-3.3.js */
(function(){
  'use strict';
  const RELEASE_VERSION_340='3.4.0';
  const RELEASE_BUILD_340='2026-09-25.1';
  let soundRealtime340=null,audioCtx340=null;
  const prefsDefaults340={notification_sound:'engine_start',support_sound:'dispatch',sound_enabled:true,support_sound_enabled:true,first_home_seen_at:null,last_home_seen_at:null,last_gallery_seen_at:null};
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

  function audioContext340(){if(!audioCtx340){const A=window.AudioContext||window.webkitAudioContext;if(A)audioCtx340=new A()}return audioCtx340}
  function tone340(ctx,type,start,duration,f1,f2,volume=.08){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f1,start);if(f2)o.frequency.exponentialRampToValueAtTime(Math.max(1,f2),start+duration);g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(volume,start+.015);g.gain.exponentialRampToValueAtTime(.0001,start+duration);o.connect(g).connect(ctx.destination);o.start(start);o.stop(start+duration+.02)
  }
  function playSound340(name,force=false){
    const p=prefs340();if(!force&&!p.sound_enabled)return;const ctx=audioContext340();if(!ctx)return;try{ctx.resume()}catch{}const t=ctx.currentTime+.015;
    if(name==='mute')return;
    if(name==='dispatch'){tone340(ctx,'sine',t,.11,660,660,.08);tone340(ctx,'sine',t+.15,.11,880,880,.08);tone340(ctx,'sine',t+.30,.16,740,740,.09);return}
    if(name==='subtle'){tone340(ctx,'sine',t,.18,760,1080,.06);return}
    if(name==='horn'){tone340(ctx,'square',t,.34,390,390,.045);tone340(ctx,'square',t,.34,490,490,.035);return}
    if(name==='turbo'){tone340(ctx,'sine',t,.28,260,1500,.045);tone340(ctx,'triangle',t+.22,.17,1600,520,.035);return}
    if(name==='shift'){tone340(ctx,'sawtooth',t,.08,120,75,.07);tone340(ctx,'sine',t+.09,.11,980,440,.04);return}
    if(name==='v8'){for(let i=0;i<7;i++)tone340(ctx,'sawtooth',t+i*.055,.09,68+(i%2)*7,62,.035);return}
    tone340(ctx,'sawtooth',t,.42,48,128,.055);tone340(ctx,'triangle',t+.18,.32,96,165,.035)
  }
  function playNotification340(kind='general'){
    const p=prefs340();
    if(kind==='support'){if(p.support_sound_enabled)playSound340(p.support_sound||'dispatch',true)}
    else playSound340(p.notification_sound||'engine_start');
  }
  const unlock340=()=>{const c=audioContext340();try{c?.resume()}catch{}};
  window.addEventListener('pointerdown',unlock340,{once:true,passive:true});

  async function savePrefs340(patch){
    if(!prodSession)return;const row={...patch,user_id:prodSession.user.id};const {data,error}=await sb.from('user_preferences').upsert(row,{onConflict:'user_id'}).select('*').single();if(error)return toast(error.message);state.userPrefs340={...prefs340(),...data};
  }

  function openSoundSettings340(){
    const p=prefs340(),sounds=[
      ['engine_start','Motorstart','Kurzer Motor-Hochlauf'],
      ['v8','V8 Puls','Tiefer, kerniger Puls'],
      ['turbo','Turbo','Spool + Blow-Off'],
      ['shift','Schaltkick','Kurzer Gangwechsel'],
      ['horn','Hupe','Zweiklang-Hupe'],
      ['subtle','Dezent','Kurzer neutraler Ton'],
      ['mute','Stumm','Kein normaler In-App-Ton']
    ];
    openModal('Benachrichtigungssounds',`<div class="notice">Diese Auswahl gilt für Sounds <b>innerhalb der geöffneten 4W1F-App</b>. Der Ton von System-Pushs außerhalb der App wird vom Handy/Betriebssystem gesteuert.</div>
      <div class="switchrow"><span>In-App Benachrichtigungssounds</span><button class="switch ${p.sound_enabled?'on':''}" id="soundEnabled340"></button></div>
      <div class="section"><div class="sectionhead"><h2>Normaler Sound</h2></div><div class="sound-grid340">${sounds.map(s=>`<button class="card sound-card340 ${p.notification_sound===s[0]?'active':''}" data-sound340="${s[0]}"><b>${s[1]}</b><span>${s[2]}</span></button>`).join('')}</div></div>
      <div class="section"><div class="sectionhead"><h2>Support</h2></div><div class="card pad"><b>4W1F Support Dispatch</b><div class="muted small">Eigener Ton, sobald ein neues Support-Ticket für dich als Admin/Owner eingeht.</div><div class="actions"><button class="btn outline sm" id="previewSupport340">Anhören</button><button class="switch ${p.support_sound_enabled?'on':''}" id="supportSoundEnabled340"></button></div></div></div>
      <button class="btn primary wide" id="saveSounds340" style="margin-top:12px">Speichern</button>`,()=>{
      let selected=p.notification_sound,enabled=p.sound_enabled,supportEnabled=p.support_sound_enabled;
      $$('[data-sound340]').forEach(b=>b.onclick=()=>{selected=b.dataset.sound340;$$('[data-sound340]').forEach(x=>x.classList.toggle('active',x===b));playSound340(selected,true)});
      $('#soundEnabled340').onclick=()=>{enabled=!enabled;$('#soundEnabled340').classList.toggle('on',enabled)};
      $('#supportSoundEnabled340').onclick=()=>{supportEnabled=!supportEnabled;$('#supportSoundEnabled340').classList.toggle('on',supportEnabled)};
      $('#previewSupport340').onclick=()=>playSound340('dispatch',true);
      $('#saveSounds340').onclick=async()=>{await savePrefs340({notification_sound:selected,sound_enabled:enabled,support_sound:'dispatch',support_sound_enabled:supportEnabled});closeModal();toast('Sound-Einstellungen gespeichert')};
    });
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
    if(Number.isInteger(item.index))return state.photos?.[item.index]||item;
    const src=item.src||item.data;return (state.photos||[]).find(p=>p.data===src)||item;
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
    const {data:rows,error}=await sb.from('gallery_items').select('*').not('deleted_at','is',null).order('deleted_at',{ascending:false});if(error)return toast(error.message);
    const items=[];
    for(const g of rows||[]){const url=await signed340('crew-media',g.storage_path,3600);if(url)items.push({...g,url})}
    openModal(isAdmin()?'Bilder-Papierkorb':'Mein Bilder-Papierkorb',`<div class="notice">Gelöschte Bilder werden nach <b>7 Tagen</b> automatisch endgültig entfernt. Bis dahin können sie wiederhergestellt werden.</div><div class="section trash-grid340">${items.map(g=>{const age=Math.max(0,Date.now()-new Date(g.deleted_at).getTime()),left=Math.max(0,7-Math.floor(age/86400000)),owner=state.users.find(u=>u.id===g.uploader_id);return `<div class="card trash-item340"><img src="${g.url}" alt="${esc340(g.caption||'Gelöschtes Bild')}"><div class="body"><b class="small">${esc340(g.caption||'Crew Foto')}</b><div class="muted tiny">${owner?esc340(owner.name)+' · ':''}noch ca. ${left} Tag${left===1?'':'e'}</div><div class="actions"><button class="btn good sm" data-restore340="${g.id}">Wiederherstellen</button>${isAdmin()?`<button class="btn bad sm" data-purge340="${g.id}">Endgültig</button>`:''}</div></div></div>`}).join('')||'<div class="notice" style="grid-column:1/-1">Der Papierkorb ist leer.</div>'}</div>`,()=>{
      $$('[data-restore340]').forEach(b=>b.onclick=async()=>{const {error}=await sb.rpc('restore_gallery_item',{p_id:b.dataset.restore340});if(error)return toast(error.message);closeModal();await loadServerState();renderGallery();toast('Bild wiederhergestellt')});
      $$('[data-purge340]').forEach(b=>b.onclick=async()=>{const g=items.find(x=>x.id===b.dataset.purge340);if(!g||!confirm('Bild wirklich endgültig löschen? Das kann nicht rückgängig gemacht werden.'))return;const rm=await sb.storage.from('crew-media').remove([g.storage_path]);if(rm.error)return toast(rm.error.message);const {error}=await sb.rpc('delete_gallery_row_permanently',{p_id:g.id});if(error)return toast(error.message);closeModal();await loadServerState();renderGallery();toast('Bild endgültig gelöscht')});
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
  async function markTicketRead340(ticketId){await sb.from('support_ticket_reads').upsert({ticket_id:ticketId,user_id:prodSession.user.id,last_read_at:new Date().toISOString()},{onConflict:'ticket_id,user_id'});if(typeof refreshSupportUnread==='function'){try{await refreshSupportUnread()}catch{}}updateBadge()}

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

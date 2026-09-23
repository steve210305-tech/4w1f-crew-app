/* 4W1F 3.3.0 prepared feature pack — loaded after production.js */
(function(){
  'use strict';
  const RELEASE_VERSION='3.3.0';
  const RELEASE_BUILD='2026-09-23.1';
  let liveRefreshTimer=null,liveMarkerLayer=null;
  let openSupportCenter;

  const style=document.createElement('style');
  style.textContent=`
  .member-social{display:grid;gap:13px}.member-social-head{display:grid;grid-template-columns:92px 1fr;gap:14px;align-items:center}.member-social-avatar{width:92px;height:92px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:#111018;border:2px solid rgba(164,69,255,.55);font-size:34px}.member-social-avatar img{width:100%;height:100%;object-fit:cover}.member-social-meta h3{margin:0 0 4px;font-size:24px}.member-social-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.member-social-stats div{padding:10px;border:1px solid var(--line);border-radius:11px;text-align:center;background:#0b0b10}.member-social-stats b{display:block;font-size:17px}.member-social-stats span{font-size:9px;color:var(--muted)}.member-photo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.member-photo-grid button{border:0;padding:0;aspect-ratio:1;background:#111;overflow:hidden;border-radius:7px}.member-photo-grid img{width:100%;height:100%;object-fit:cover;display:block}.member-vehicle{overflow:hidden}.member-vehicle-photo{height:180px;background:#09090d;display:grid;place-items:center;color:var(--muted)}.member-vehicle-photo img{width:100%;height:100%;object-fit:cover}.member-vehicle-body{padding:13px}.ticket-row{padding:13px;text-align:left;width:100%}.ticket-top{display:flex;justify-content:space-between;gap:10px}.ticket-status{font-size:9px;font-weight:900;letter-spacing:1px;text-transform:uppercase}.ticket-chat{display:grid;gap:9px}.ticket-msg{max-width:88%;padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:#101016}.ticket-msg.me{justify-self:end;border-color:rgba(155,52,255,.55);background:rgba(122,41,255,.12)}.ticket-msg .tiny{display:block;margin-top:5px}.ticket-attachment{display:block;margin-top:8px;max-width:220px;border-radius:10px;overflow:hidden}.ticket-attachment img{width:100%;display:block}.support-tabs{display:flex;gap:7px;margin-bottom:10px}.support-tabs .btn{flex:1}.project-manage-row{display:grid;grid-template-columns:1fr auto;gap:9px;align-items:start}.project-manage-actions{display:flex;gap:6px;flex-wrap:wrap}.live-member-strip{display:flex;gap:8px;overflow:auto;padding:3px 0 8px}.live-person{min-width:150px;padding:10px;text-align:left}.live-person .avatar-mini{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#17131f;border:1px solid rgba(155,52,255,.45);overflow:hidden}.live-person .avatar-mini img{width:100%;height:100%;object-fit:cover}.live-person-line{display:flex;align-items:center;gap:8px}.life-pin{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#15121b;border:3px solid #9b34ff;box-shadow:0 0 0 3px rgba(155,52,255,.18),0 4px 18px rgba(0,0,0,.55);font-weight:900;color:white;overflow:hidden}.life-pin.me{border-color:#32da83}.life-pin img{width:100%;height:100%;object-fit:cover}.release-note{padding:12px;border-left:2px solid var(--purple);background:rgba(155,52,255,.06);border-radius:0 10px 10px 0;margin-top:8px}.release-note b{display:block;margin-bottom:4px}.release-note span{font-size:11px;color:var(--muted);line-height:1.45}.media-choice{display:grid;gap:8px}.media-choice label{display:flex;align-items:center;gap:10px;padding:11px;border:1px solid var(--line);border-radius:11px;background:#0c0c11}.media-choice input{width:18px;height:18px;accent-color:#9b34ff}.social-media-picker{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.social-media-picker label{aspect-ratio:1;position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--line)}.social-media-picker img{width:100%;height:100%;object-fit:cover}.social-media-picker input{position:absolute;right:5px;top:5px;width:20px;height:20px;accent-color:#9b34ff}
  @media(max-width:420px){.member-social-head{grid-template-columns:76px 1fr}.member-social-avatar{width:76px;height:76px}.member-social-stats b{font-size:15px}}
  `;
  document.head.appendChild(style);

  const signedUrl=async(bucket,path,seconds=3600)=>{if(!path)return null;const {data,error}=await sb.storage.from(bucket).createSignedUrl(path,seconds);return error?null:data?.signedUrl||null};
  const fmtAgo=iso=>{if(!iso)return'—';const ms=Math.max(0,Date.now()-new Date(iso).getTime()),m=Math.round(ms/60000);if(m<1)return'gerade eben';if(m<60)return`vor ${m} Min.`;const h=Math.round(m/60);if(h<24)return`vor ${h} Std.`;return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso))};
  const supportStatusLabel=v=>({open:'Offen',in_progress:'In Bearbeitung',waiting_user:'Warten auf Nutzer',resolved:'Erledigt',closed:'Geschlossen'})[v]||v;
  const supportPriorityLabel=v=>({normal:'Normal',important:'Wichtig',urgent:'Dringend'})[v]||v;

  async function enrichMediaState(){
    if(!prodSession)return;
    const {data:rows,error}=await sb.from('gallery_items').select('*').order('created_at',{ascending:false}).limit(200);
    if(error)return;
    const photos=[];
    for(const g of rows||[]){
      const url=await signedUrl('crew-media',g.storage_path,86400);
      if(url)photos.push({id:g.id,data:url,label:g.caption||'Crew Foto',kind:uiKindFromDb(g.category),createdAt:new Date(g.created_at).getTime(),eventId:g.event_id,_storagePath:g.storage_path,uploaderId:g.uploader_id,profileVisible:g.profile_visible!==false,galleryVisible:g.gallery_visible!==false,approved:g.approved!==false});
    }
    state.photos=photos;
  }

  async function refreshSupportUnread(){
    if(!prodSession)return 0;
    const {data:tickets}=await sb.from('support_tickets').select('id,updated_at,created_by,channel,status').order('updated_at',{ascending:false});
    const {data:reads}=await sb.from('support_ticket_reads').select('ticket_id,last_read_at').eq('user_id',prodSession.user.id);
    const readMap=new Map((reads||[]).map(r=>[r.ticket_id,new Date(r.last_read_at).getTime()]));
    const n=(tickets||[]).filter(t=>new Date(t.updated_at).getTime()>(readMap.get(t.id)||0)).length;
    state.supportUnread=n;return n;
  }

  const previousLoadServerState=loadServerState;
  loadServerState=async function(){
    await previousLoadServerState();
    await Promise.allSettled([enrichMediaState(),refreshSupportUnread()]);
  };

  const previousSubscribeRealtime=subscribeRealtime;
  subscribeRealtime=function(){
    previousSubscribeRealtime();
    try{
      ['support_tickets','support_messages','support_ticket_reads','social_drafts','update_releases'].forEach(t=>realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:t},()=>scheduleRealtimeRefresh()));
    }catch{}
  };

  const previousUpdateBadge=updateBadge;
  updateBadge=function(){
    previousUpdateBadge();
    const a=unreadAnnouncements().length,s=Number(state.supportUnread||0),n=a+s,b=$('#notifBadge');
    if(!b)return;b.textContent=n;b.classList.toggle('hidden',n===0);$('#notifBtn')?.classList.toggle('has-unread',n>0);
  };

  // 1) Flexible media visibility and profile/gallery publishing.
  handlePhotos=async function(files){
    const arr=[...files].slice(0,12).filter(f=>/^image\/(jpeg|png|webp)$/i.test(f.type)&&f.size<=12*1024*1024);
    if(!arr.length)return toast('JPEG, PNG oder WebP bis 12 MB');
    const events=state.events.slice(0,25);
    openModal('Bilder hinzufügen',`
      <div class="field"><label>Bereich</label><select id="uploadKind"><option value="crew">Crew</option><option value="vehicle">Fahrzeug</option><option value="event">Event</option></select></div>
      <div class="field"><label>Event (nur bei Event-Fotos)</label><select id="uploadEvent"><option value="">Kein Event</option>${events.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Beschreibung</label><input id="uploadCaption" placeholder="z. B. Night Drive Mannheim"></div>
      <div class="media-choice">
        <label><input type="checkbox" id="profileVisible" checked><span><b>Im Profil sichtbar</b><br><span class="muted tiny">Erscheint im persönlichen Bilderraster.</span></span></label>
        <label><input type="checkbox" id="galleryVisible" checked><span><b>Zur Crew-Galerie hinzufügen</b><br><span class="muted tiny">Kann unabhängig vom Profil ausgeschaltet werden.</span></span></label>
      </div>
      <div class="notice">Sind beide Optionen aus, bleibt das Bild nur für dich gespeichert. Bilder werden vor dem Upload neu als WebP codiert.</div>
      <button class="btn primary wide" id="startUpload">${arr.length} Bild${arr.length===1?'':'er'} speichern</button>`,()=>{
      $('#startUpload').onclick=async()=>{
        const kind=$('#uploadKind').value,eventId=$('#uploadEvent').value||null;
        if(kind==='event'&&!eventId)return toast('Bitte ein Event auswählen');
        const profileVisible=$('#profileVisible').checked,galleryVisible=$('#galleryVisible').checked,caption=$('#uploadCaption').value.trim();
        const btn=$('#startUpload');btn.disabled=true;btn.textContent='Bilder werden verarbeitet…';let ok=0;
        for(const f of arr){try{const safe=await sanitizeImageFile(f);const path=`${prodSession.user.id}/profile/${uuid()}.webp`;await checked(sb.storage.from('crew-media').upload(path,safe,{contentType:'image/webp',upsert:false}),'Upload');await checked(sb.from('gallery_items').insert({uploader_id:prodSession.user.id,event_id:eventId,category:kind,storage_path:path,caption:caption||f.name.replace(/\.[^.]+$/,''),approved:true,sanitized:true,profile_visible:profileVisible,gallery_visible:galleryVisible}),'Bild');ok++}catch(e){productionError(e,'Bild')}}
        closeModal();await loadServerState();render();toast(`${ok}/${arr.length} Bilder gespeichert`);
      };
    });
  };

  async function uploadPrimaryMedia(kind,file){
    if(!file||!/^image\/(jpeg|png|webp)$/i.test(file.type)||file.size>12*1024*1024)return toast('JPEG, PNG oder WebP bis 12 MB');
    openModal(kind==='avatar'?'Profilbild speichern':'Fahrzeugbild speichern',`
      <div class="media-choice"><label><input type="checkbox" id="primaryGallery"><span><b>Zusätzlich in Crew-Galerie veröffentlichen</b><br><span class="muted tiny">Das Hauptbild selbst bleibt natürlich im Profil sichtbar.</span></span></label></div>
      <button class="btn primary wide" id="primarySave">Bild speichern</button>`,()=>{
      $('#primarySave').onclick=async()=>{const addGallery=$('#primaryGallery').checked;try{const safe=await sanitizeImageFile(file),uid=prodSession.user.id;if(kind==='avatar'){const path=`${uid}/avatar.webp`;await checked(sb.storage.from('avatars').upload(path,safe,{contentType:'image/webp',upsert:true}),'Profilbild');await checked(sb.from('profiles').update({avatar_path:path}).eq('id',uid),'Profilbild');if(addGallery){const gp=`${uid}/profile/${uuid()}.webp`;await checked(sb.storage.from('crew-media').upload(gp,safe,{contentType:'image/webp'}),'Galerie');await checked(sb.from('gallery_items').insert({uploader_id:uid,category:'crew',storage_path:gp,caption:'Profilbild',approved:true,sanitized:true,profile_visible:true,gallery_visible:true}),'Galerie')}}else{const path=`${uid}/vehicle-profile.webp`;await checked(sb.storage.from('crew-media').upload(path,safe,{contentType:'image/webp',upsert:true}),'Fahrzeugbild');await checked(sb.from('vehicles').upsert({user_id:uid,photo_path:path},{onConflict:'user_id'}),'Fahrzeugbild');if(addGallery){const gp=`${uid}/profile/${uuid()}.webp`;await checked(sb.storage.from('crew-media').upload(gp,safe,{contentType:'image/webp'}),'Galerie');await checked(sb.from('gallery_items').insert({uploader_id:uid,category:'vehicle',storage_path:gp,caption:'Fahrzeug',approved:true,sanitized:true,profile_visible:true,gallery_visible:true}),'Galerie')}}closeModal();await loadServerState();renderProfile();toast('Bild gespeichert')}catch(e){productionError(e,'Bild');toast('Bild konnte nicht gespeichert werden')}};
    });
  }

  function wirePrimaryMediaOptions(){
    setTimeout(()=>{
      const a=$('#avatarFile'),v=$('#vehicleFile');
      if(a){a.onchange=e=>{const f=e.target.files?.[0];if(f)uploadPrimaryMedia('avatar',f);e.target.value=''}}
      if(v){v.onchange=e=>{const f=e.target.files?.[0];if(f)uploadPrimaryMedia('vehicle',f);e.target.value=''}}
    },50);
  }
  const previousRenderProfile=renderProfile;
  renderProfile=function(){previousRenderProfile();wirePrimaryMediaOptions();setTimeout(()=>{const grid=$('#view .admin-grid');if(grid&&!$('#profileSupport')){const b=document.createElement('button');b.className='card admin-tool clickable';b.id='profileSupport';b.innerHTML=`${I('bell')}<div><b>Support</b><br><span>Tickets & direkte Hilfe</span></div>`;grid.appendChild(b);b.onclick=openSupportCenter}},0)};

  // 2) Instagram-style member profile.
  async function openMemberSocialProfile(id){
    const u=state.users.find(x=>x.id===id);if(!u)return;
    openModal(u.name,'<div class="notice">Profil wird geladen…</div>');
    const v=u._vehicle||{};
    const photos=(state.photos||[]).filter(p=>p.uploaderId===u.id&&p.profileVisible&&p.approved!==false);
    const [avatarUrl,vehicleUrl]=await Promise.all([signedUrl('avatars',u._avatarPath),signedUrl('crew-media',v.photo_path)]);
    const photoGrid=photos.map((p,i)=>`<button type="button" data-profile-photo="${i}" aria-label="${esc(p.label||'Foto öffnen')}"><img src="${p.data}" alt="${esc(p.label||'Crew Foto')}"></button>`).join('');
    openModal(u.name,`<div class="member-social">
      <div class="member-social-head"><div class="member-social-avatar">${avatarUrl?`<img src="${avatarUrl}" alt="Profilbild von ${esc(u.name)}">`:(u.emoji||'🚗')}</div><div class="member-social-meta"><div class="eyebrow">${roleLabel(u.role)}</div><h3>${esc(u.name)}</h3><div class="muted small">${esc(u.ig||'Kein Instagram-Handle')}</div><div class="member-tags" style="margin-top:7px">${(u.labels||[]).map(l=>`<span class="label function">${esc(l)}</span>`).join('')}</div></div></div>
      <div class="member-social-stats"><div><b>${photos.length}</b><span>PROFILFOTOS</span></div><div><b>${v.power_ps||'—'}</b><span>PS</span></div><div><b>${formatJoined(u.joinedAt)}</b><span>DABEI SEIT</span></div></div>
      <div class="card pad"><div class="eyebrow">Über mich</div><p class="small" style="line-height:1.6;margin-bottom:0">${esc(u.bio||'Noch keine Beschreibung hinterlegt.')}</p></div>
      <div class="card member-vehicle"><div class="member-vehicle-photo">${vehicleUrl?`<img src="${vehicleUrl}" alt="Fahrzeug von ${esc(u.name)}">`:'Noch kein Fahrzeugbild'}</div><div class="member-vehicle-body"><div class="eyebrow">Fahrzeug</div><h3 style="margin:5px 0">${esc([v.make,v.model].filter(Boolean).join(' ')||u.car||'Noch kein Fahrzeug')}</h3><div class="muted small">${v.year?`Baujahr ${v.year}`:''}${v.power_ps?` · ${v.power_ps} PS`:''}</div>${v.description?`<p class="small" style="line-height:1.55">${esc(v.description)}</p>`:''}${(v.mods||[]).length?`<div class="chips">${v.mods.map(m=>`<span class="chip active">${esc(m)}</span>`).join('')}</div>`:''}</div></div>
      <div><div class="sectionhead"><h2>Profilbilder</h2></div><div class="member-photo-grid">${photoGrid||'<div class="notice" style="grid-column:1/-1">Noch keine Bilder für das Profil freigegeben.</div>'}</div></div>
      ${u.id===me().id?'<button class="btn primary wide" id="socialEditOwn">Profil bearbeiten</button>':''}
    </div>`,()=>{
      $$('[data-profile-photo]').forEach(b=>b.onclick=()=>openPhotoViewer({src:photos[Number(b.dataset.profilePhoto)]?.data,label:photos[Number(b.dataset.profilePhoto)]?.label||'Profilfoto',kind:photos[Number(b.dataset.profilePhoto)]?.kind||'crew'}));
      $('#socialEditOwn')?.addEventListener('click',()=>{closeModal();openProfileEditor()});
    });
  }
  openMemberDetail=function(id){openMemberSocialProfile(id)};

  // Gallery only shows items explicitly published to it.
  const baseRenderGallery=renderGallery;
  renderGallery=function(){
    const all=state.photos||[];state.photos=all.filter(p=>p.galleryVisible!==false&&p.approved!==false);try{baseRenderGallery()}finally{state.photos=all}
  };

  // 3) Owner role + label control.
  openMemberAdmin=async function(id){
    const u=state.users.find(x=>x.id===id);if(!u)return;
    if(u.role==='owner')return openModal(u.name,'<div class="notice">🔒 Der Owner-Account ist gegen Herabstufung und Löschung geschützt.</div>');
    let labels=[...(u.labels||[])];
    openModal(u.name,`<div class="field"><label>Rolle</label><select id="roleSel" ${isOwner()?'':'disabled'}><option value="member" ${u.role==='member'?'selected':''}>Mitglied</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select></div><div class="field"><label>Funktions-Labels</label><div class="chips" id="labelChoices">${(state.customLabels||[]).map(l=>`<button class="chip ${labels.includes(l)?'active':''}" type="button" data-label="${esc(l)}">${esc(l)}</button>`).join('')}</div></div>${isOwner()?'<button class="btn primary wide" id="saveMemberRole">Rolle & Labels speichern</button>':'<div class="notice">Nur der Owner darf Rollen und Funktions-Labels verändern.</div>'}`,()=>{
      if(!isOwner())return;
      $$('[data-label]').forEach(b=>b.onclick=()=>{const l=b.dataset.label;labels=labels.includes(l)?labels.filter(x=>x!==l):[...labels,l];b.classList.toggle('active')});
      $('#saveMemberRole').onclick=async()=>{if(!await requireSensitiveAuth('Rollen- oder Rechteänderungen'))return;const role=$('#roleSel').value;if(role!==u.role&&!confirm(`${u.name} wirklich auf ${roleLabel(role)} setzen?`))return;const {error}=await sb.from('profiles').update({role,labels}).eq('id',u.id);if(error)return toast(error.message);closeModal();await loadServerState();openOwnerControl();toast('Rolle & Labels gespeichert')};
    });
  };

  openOwnerControl=function(){
    const rows=state.users.map(u=>`<div class="card pad"><div class="project-manage-row"><div><b>${esc(u.name)}</b><div class="muted tiny">${roleLabel(u.role)}${(u.labels||[]).length?' · '+u.labels.map(esc).join(' · '):''}</div></div>${u.role==='owner'?'<span class="label owner">OWNER</span>':`<button class="btn outline sm" data-owner-user="${u.id}">Verwalten</button>`}</div></div>`).join('');
    openModal('Owner Control',`<div class="notice">Rollen und Funktions-Labels werden serverseitig gespeichert. Dein Owner-Account bleibt geschützt.</div><div class="section"><div class="sectionhead"><h2>Mitglieder & Rollen</h2></div><div class="list">${rows}</div></div><div class="field"><label>Neues Funktions-Label</label><input id="newLabel" placeholder="z. B. Tourleitung"></div><button class="btn primary wide" id="addLabel">Label hinzufügen</button>`,()=>{
      $$('[data-owner-user]').forEach(b=>b.onclick=()=>{closeModal();openMemberAdmin(b.dataset.ownerUser)});
      $('#addLabel').onclick=async()=>{const v=$('#newLabel').value.trim();if(!v||state.customLabels.includes(v))return toast('Label existiert bereits oder ist leer');state.customLabels.push(v);const {error}=await sb.from('crew_settings').update({custom_labels:state.customLabels}).eq('id',1);if(error)return toast(error.message);closeModal();await loadServerState();openOwnerControl()};
    });
  };

  // 4) Social drafts, prepared for later Meta API connection.
  async function saveSocialDraft(id=null){
    const caption=$('#socialCaption')?.value.trim()||'',hash=($('#socialHashtags')?.value||'').split(/\s+/).map(x=>x.trim()).filter(Boolean).map(x=>x.startsWith('#')?x:'#'+x),mediaIds=$$('#socialMediaPicker input:checked').map(x=>x.value);
    const row={created_by:prodSession.user.id,caption,hashtags:hash,media_ids:mediaIds,status:'draft'};
    const q=id?sb.from('social_drafts').update(row).eq('id',id):sb.from('social_drafts').insert(row);const {error}=await q;if(error)return toast(error.message);toast('Instagram-Entwurf gespeichert');closeModal();openSocialStudio();
  }
  async function openSocialDraftEditor(draft=null){
    const visible=(state.photos||[]).filter(p=>p.galleryVisible!==false&&p.approved!==false).slice(0,18),selected=new Set(draft?.media_ids||[]);
    openModal(draft?'Entwurf bearbeiten':'Instagram vorbereiten',`<div class="field"><label>Caption</label><textarea id="socialCaption">${esc(draft?.caption||'')}</textarea></div><div class="field"><label>Hashtags</label><input id="socialHashtags" value="${esc((draft?.hashtags||['#4Wheels1Family']).join(' '))}" placeholder="#4Wheels1Family #NightDrive"></div><div class="field"><label>Medien auswählen</label><div class="social-media-picker" id="socialMediaPicker">${visible.map(p=>`<label><img src="${p.data}" alt="${esc(p.label||'Foto')}"><input type="checkbox" value="${p.id}" ${selected.has(p.id)?'checked':''}></label>`).join('')||'<div class="notice" style="grid-column:1/-1">Noch keine Galerie-Bilder verfügbar.</div>'}</div></div><div class="actions"><button class="btn primary" id="saveSocialDraft">Entwurf speichern</button><button class="btn outline" id="prepareSocial">Für Instagram vorbereiten</button></div><button class="btn outline wide" disabled title="Meta-Verbindung noch nicht eingerichtet">Direkt posten · Meta nicht verbunden</button><div class="notice">Der Entwurf ist bereits so strukturiert, dass später die offizielle Meta/Instagram-Schnittstelle angebunden werden kann. Bis dahin wird kein Fake-Posting ausgelöst.</div>`,()=>{
      $('#saveSocialDraft').onclick=()=>saveSocialDraft(draft?.id||null);$('#prepareSocial').onclick=async()=>{await saveSocialDraft(draft?.id||null);};
    });
  }
  openSocialStudio=async function(){
    const {data,error}=await sb.from('social_drafts').select('*').order('updated_at',{ascending:false});if(error)return toast(error.message);
    openModal('Social Media Studio',`<div class="notice">Instagram-Verbindung: <b>noch nicht gekoppelt</b>. Entwürfe können aber vollständig vorbereitet werden.</div><button class="btn primary wide" id="newSocialDraft" style="margin-top:10px">+ Neuer Instagram-Entwurf</button><div class="section"><div class="sectionhead"><h2>Entwürfe</h2></div><div class="list">${(data||[]).map(d=>`<button class="card ticket-row clickable" data-social-draft="${d.id}"><div class="ticket-top"><b>${esc((d.caption||'Ohne Caption').slice(0,54))}</b><span class="muted tiny">${fmtAgo(d.updated_at)}</span></div><div class="muted tiny">${(d.hashtags||[]).map(esc).join(' ')||'Keine Hashtags'} · ${(d.media_ids||[]).length} Medien</div></button>`).join('')||'<div class="notice">Noch keine Entwürfe.</div>'}</div></div>`,()=>{$('#newSocialDraft').onclick=()=>{closeModal();openSocialDraftEditor()};$$('[data-social-draft]').forEach(b=>b.onclick=()=>{const d=(data||[]).find(x=>x.id===b.dataset.socialDraft);closeModal();openSocialDraftEditor(d)})});
  };

  // 5) Life360-style live map + more robust refresh.
  const previousSaveLiveMeta=saveLiveMeta;
  saveLiveMeta=async function(pos){
    state.live.expiresAt=Date.now()+45*60000;
    await previousSaveLiveMeta(pos);
  };
  async function liveAvatarHtml(u,own=false){const url=await signedUrl('avatars',u?._avatarPath,900);return url?`<div class="life-pin ${own?'me':''}"><img src="${url}" alt=""></div>`:`<div class="life-pin ${own?'me':''}">${esc((u?.name||'?').slice(0,1).toUpperCase())}</div>`}
  async function renderLifeMarkers(){
    if(page!=='live'||!map)return;
    liveMarkerLayer?.clearLayers();
    const {data:lives,error}=await sb.from('live_locations').select('*').eq('sharing',true);if(error)return;
    const valid=(lives||[]).filter(l=>l.latitude!=null&&l.longitude!=null&&(!l.expires_at||new Date(l.expires_at)>new Date()));
    const bounds=[];
    for(const l of valid){const u=state.users.find(x=>x.id===l.user_id),own=l.user_id===prodSession.user.id,html=await liveAvatarHtml(u,own);const icon=L.divIcon({className:'',html,iconSize:[46,46],iconAnchor:[23,23]});const marker=L.marker([l.latitude,l.longitude],{icon,zIndexOffset:own?1000:900}).addTo(liveMarkerLayer||map);marker.bindPopup(`<b>${esc(u?.name||'Crew')}</b><br>${esc(statusFromDb(l.status,l.target_name))}<br><span style="font-size:10px">${esc(l.place_label||'')} ${l.speed_kmh?`· ${Math.round(Number(l.speed_kmh))} km/h`:''}<br>${fmtAgo(l.updated_at)}</span>`);marker.on('click',()=>{});bounds.push([l.latitude,l.longitude])}
    if(bounds.length>1)map.fitBounds(bounds,{padding:[52,52],maxZoom:14});else if(bounds.length===1)map.setView(bounds[0],13);
    const strip=$('#livePeople');if(strip)strip.innerHTML=valid.map(l=>{const u=state.users.find(x=>x.id===l.user_id);return `<button class="card live-person clickable" data-live-person="${l.user_id}"><div class="live-person-line"><div class="avatar-mini">${esc((u?.name||'?').slice(0,1))}</div><div><b>${esc(u?.name||'Crew')}</b><div class="muted tiny">${esc(statusFromDb(l.status,l.target_name))} · ${fmtAgo(l.updated_at)}</div></div></div></button>`}).join('')||'<div class="notice" style="min-width:100%">Noch niemand teilt gerade seinen Standort.</div>';
    $$('[data-live-person]').forEach(b=>b.onclick=()=>openMemberSocialProfile(b.dataset.livePerson));
  }
  renderLive=function(){
    if(liveRefreshTimer){clearInterval(liveRefreshTimer);liveRefreshTimer=null}
    const eta=state.live.eta;$('#view').innerHTML=`${pageTitle('Crew','Live','Wie Life360 · freiwillig · in Echtzeit')}<div class="card live-summary"><div style="font-size:22px">${state.live.share?'🟣':'⚫'}</div><div style="flex:1"><b>${state.live.share?esc(state.live.status):'Du bist unsichtbar'}</b><div class="muted tiny">${state.live.share?'Dein Standort wird nur während der Freigabe geteilt.':'Standort wird nicht geteilt.'}</div></div><button class="btn ${state.live.share?'bad':'primary'} sm" id="toggleLive">${state.live.share?'Reset':'Live gehen'}</button></div>${eta?`<div class="card eta-card"><div class="eyebrow">Deine Ankunft</div><h3 style="margin:5px 0">${esc(eta.arrival)} Uhr · ${eta.minutes} Min.</h3><div class="muted small">${eta.distance} km bis ${esc(state.live.target?.name||'Treffpunkt')}</div></div>`:''}<div class="section"><div class="sectionhead"><h2>Gerade live</h2></div><div class="live-member-strip" id="livePeople"><div class="notice" style="min-width:100%">Live-Mitglieder werden geladen…</div></div></div><div id="liveMap" class="map"></div><div class="live-actions"><button class="btn outline" data-live="Bin unterwegs">${I('car')} Bin unterwegs</button><button class="btn good" data-live="Bin da">${I('pin')} Bin da</button><button class="btn warn" data-live="Tankstopp">⛽ Tankstopp</button><button class="btn bad" data-live="Panne">⚠ Panne</button></div><div class="section"><button class="btn outline wide" id="refreshLive">${I('pin')} Standort aktualisieren</button><button class="btn outline wide" id="managePlaces" style="margin-top:8px">⌂ Orte & Automatik</button></div>`;
    map=L.map('liveMap').setView(state.live.lat?[state.live.lat,state.live.lng]:[49.32,8.55],12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);liveMarkerLayer=L.layerGroup().addTo(map);
    const acquire=status=>{if(!navigator.geolocation)return toast('Standort nicht verfügbar');navigator.geolocation.getCurrentPosition(async p=>{state.live.share=true;state.live.status=status||state.live.status||'Bin unterwegs';state.live.lat=p.coords.latitude;state.live.lng=p.coords.longitude;state.live.expiresAt=Date.now()+45*60000;await saveLiveMeta(p);save();setTimeout(()=>renderLifeMarkers(),180)},()=>toast('Standort nicht erlaubt'),{enableHighAccuracy:true,timeout:15000,maximumAge:5000})};
    $('#toggleLive').onclick=()=>{if(state.live.share){state.live.share=false;state.live.status='Unsichtbar';state.live.lat=null;state.live.lng=null;state.live.eta=null;state.live.target=null;state.live.expiresAt=null;save();renderLive()}else acquire('Bin unterwegs')};
    $$('[data-live]').forEach(b=>b.onclick=()=>{state.live.status=b.dataset.live;if(state.live.lat){state.live.share=true;state.live.expiresAt=Date.now()+45*60000;save();renderLive()}else acquire(b.dataset.live)});$('#refreshLive').onclick=()=>acquire(state.live.status||'Bin unterwegs');$('#managePlaces').onclick=openSavedPlaces;
    if(state.live.share)ensureLiveWatch();else stopLiveWatch();renderLifeMarkers();liveRefreshTimer=setInterval(renderLifeMarkers,8000);
  };

  // 6) Full project CRUD.
  async function openProjectEditor(p=null){
    openModal(p?'Projekt bearbeiten':'Projekt erstellen',`<div class="field"><label>Titel</label><input id="projectTitle" value="${esc(p?.title||'')}"></div><div class="field"><label>Beschreibung</label><textarea id="projectText">${esc(p?.text||'')}</textarea></div><div class="field2"><div class="field"><label>Icon</label><input id="projectIcon" value="${esc(p?.icon||'◆')}"></div><div class="field"><label>Status</label><select id="projectStatus"><option value="idea">Idee</option><option value="vote">Abstimmung / geplant</option><option value="work">In Arbeit</option><option value="live">Live</option><option value="paused">Pausiert</option><option value="done">Fertig</option></select></div></div><div class="field"><label>Status-Text</label><input id="projectLabel" value="${esc(p?.statusLabel||'')}"></div><div class="field"><label>Reihenfolge</label><input id="projectOrder" type="number" value="${Number(p?._sortOrder||0)}"></div><button class="btn primary wide" id="saveProjectCrud">Speichern</button>${p?'<button class="btn bad wide" id="deleteProjectCrud" style="margin-top:8px">Projekt löschen</button>':''}`,()=>{
      $('#projectStatus').value=p?.status||'idea';$('#saveProjectCrud').onclick=async()=>{const title=$('#projectTitle').value.trim();if(!title)return toast('Titel fehlt');const row={title,description:$('#projectText').value.trim(),icon:$('#projectIcon').value.trim()||'◆',status:$('#projectStatus').value,status_label:$('#projectLabel').value.trim()||projectLabel($('#projectStatus').value),sort_order:+$('#projectOrder').value||0,created_by:p?._createdBy||prodSession.user.id};const q=p?sb.from('crew_projects').update(row).eq('id',p.id):sb.from('crew_projects').insert(row);const {error}=await q;if(error)return toast(error.message);closeModal();await loadServerState();openProjectAdmin();toast('Projekt gespeichert')};$('#deleteProjectCrud')?.addEventListener('click',async()=>{if(!confirm('Projekt wirklich löschen?'))return;const {error}=await sb.from('crew_projects').delete().eq('id',p.id);if(error)return toast(error.message);closeModal();await loadServerState();openProjectAdmin();toast('Projekt gelöscht')});
    });
  }
  openProjectAdmin=function(){
    openModal('Crew Projekte',`<button class="btn primary wide" id="newProjectCrud">+ Neues Projekt</button><div class="section"><div class="list">${(state.projects||[]).map(p=>`<div class="card pad project-manage-row"><div><b>${esc(p.icon||'◆')} ${esc(p.title)}</b><div class="muted tiny">${esc(p.statusLabel||projectLabel(p.status))} · ${esc(p.text||'')}</div></div><div class="project-manage-actions"><button class="btn outline sm" data-edit-project="${p.id}">Bearbeiten</button><button class="btn bad sm" data-delete-project="${p.id}">Löschen</button></div></div>`).join('')||'<div class="notice">Noch keine Crew-Projekte.</div>'}</div></div>`,()=>{$('#newProjectCrud').onclick=()=>{closeModal();openProjectEditor()};$$('[data-edit-project]').forEach(b=>b.onclick=()=>{const p=state.projects.find(x=>x.id===b.dataset.editProject);closeModal();openProjectEditor(p)});$$('[data-delete-project]').forEach(b=>b.onclick=async()=>{const p=state.projects.find(x=>x.id===b.dataset.deleteProject);if(!p||!confirm(`${p.title} wirklich löschen?`))return;const {error}=await sb.from('crew_projects').delete().eq('id',p.id);if(error)return toast(error.message);closeModal();await loadServerState();openProjectAdmin()})});
  };

  // 7) Internal owner/admin support tickets with chat, attachments and push (push is queued server-side).
  async function markTicketRead(ticketId){await sb.from('support_ticket_reads').upsert({ticket_id:ticketId,user_id:prodSession.user.id,last_read_at:new Date().toISOString()},{onConflict:'ticket_id,user_id'});await refreshSupportUnread();updateBadge()}
  async function openSupportTicket(ticketId){
    const {data:t,error}=await sb.from('support_tickets').select('*').eq('id',ticketId).single();if(error||!t)return toast(error?.message||'Ticket nicht gefunden');await markTicketRead(ticketId);
    const {data:msgs}=await sb.from('support_messages').select('*').eq('ticket_id',ticketId).order('created_at',{ascending:true});
    const senderIds=[...new Set((msgs||[]).map(m=>m.sender_id))],senderMap=new Map(state.users.filter(u=>senderIds.includes(u.id)).map(u=>[u.id,u]));
    const attachments=new Map();for(const m of msgs||[])if(m.attachment_path)attachments.set(m.id,await signedUrl('support-media',m.attachment_path,3600));
    const adminControls=isAdmin()?`<div class="field"><label>Status</label><select id="ticketStatus"><option value="open">Offen</option><option value="in_progress">In Bearbeitung</option><option value="waiting_user">Warten auf Nutzer</option><option value="resolved">Erledigt</option><option value="closed">Geschlossen</option></select></div>`:'';
    openModal(`Ticket #${t.ticket_no}`,`<div class="card pad"><div class="eyebrow">${t.channel==='owner'?'Owner Support':'Admin Support'} · ${supportPriorityLabel(t.priority)}</div><h3 style="margin:5px 0">${esc(t.subject)}</h3><div class="muted tiny">${supportStatusLabel(t.status)} · erstellt ${fmtAgo(t.created_at)}</div></div>${adminControls}<div class="section ticket-chat">${(msgs||[]).map(m=>{const sender=senderMap.get(m.sender_id);return `<div class="ticket-msg ${m.sender_id===prodSession.user.id?'me':''}"><b>${esc(sender?.name||'Support')}</b>${m.body?`<div class="small" style="margin-top:4px;white-space:pre-wrap">${esc(m.body)}</div>`:''}${attachments.get(m.id)?`<a class="ticket-attachment" href="${attachments.get(m.id)}" target="_blank" rel="noopener"><img src="${attachments.get(m.id)}" alt="Anhang"></a>`:''}<span class="tiny muted">${fmtAgo(m.created_at)}</span></div>`}).join('')||'<div class="notice">Noch keine Nachrichten.</div>'}</div>${t.status!=='closed'?`<div class="section"><div class="field"><label>Antwort</label><textarea id="ticketReply" placeholder="Nachricht schreiben …"></textarea></div><label class="btn outline wide">Bild anhängen<input hidden type="file" accept="image/jpeg,image/png,image/webp" id="ticketAttachment"></label><button class="btn primary wide" id="sendTicketReply" style="margin-top:8px">Antwort senden</button></div>`:'<div class="notice" style="margin-top:10px">Dieses Ticket ist geschlossen.</div>'}`,()=>{
      if(isAdmin()){const sel=$('#ticketStatus');sel.value=t.status;sel.onchange=async()=>{const next=sel.value;const {error}=await sb.from('support_tickets').update({status:next,closed_at:next==='closed'?new Date().toISOString():null}).eq('id',t.id);if(error)return toast(error.message);toast('Ticketstatus aktualisiert')}}
      $('#sendTicketReply')?.addEventListener('click',async()=>{const body=$('#ticketReply').value.trim(),file=$('#ticketAttachment')?.files?.[0];if(!body&&!file)return toast('Nachricht oder Bild fehlt');let attachment_path=null;try{if(file){const safe=await sanitizeImageFile(file);attachment_path=`${t.id}/${prodSession.user.id}/${uuid()}.webp`;await checked(sb.storage.from('support-media').upload(attachment_path,safe,{contentType:'image/webp'}),'Anhang')}const {error}=await sb.from('support_messages').insert({ticket_id:t.id,sender_id:prodSession.user.id,body,attachment_path});if(error)throw error;closeModal();await openSupportTicket(t.id)}catch(e){productionError(e,'Support');toast('Nachricht konnte nicht gesendet werden')}});
    });
  }
  async function createSupportTicket(){
    openModal('Support-Ticket erstellen',`<div class="field"><label>Bereich</label><select id="supportChannel"><option value="admin">Admin Support · für alle Admins sichtbar</option><option value="owner">Owner Support · nur Nutzer + Owner</option></select></div><div class="field"><label>Betreff</label><input id="supportSubject" placeholder="Worum geht es?"></div><div class="field2"><div class="field"><label>Kategorie</label><select id="supportCategory"><option>App / Bug</option><option>Account</option><option>Crew / Organisation</option><option>Sonstiges</option></select></div><div class="field"><label>Priorität</label><select id="supportPriority"><option value="normal">Normal</option><option value="important">Wichtig</option><option value="urgent">Dringend</option></select></div></div><div class="field"><label>Nachricht</label><textarea id="supportBody" placeholder="Beschreibe das Problem oder Anliegen möglichst genau."></textarea></div><label class="btn outline wide">Screenshot / Bild anhängen<input hidden type="file" accept="image/jpeg,image/png,image/webp" id="supportAttachment"></label><button class="btn primary wide" id="createSupportTicket" style="margin-top:8px">Ticket erstellen</button>`,()=>{
      $('#createSupportTicket').onclick=async()=>{const subject=$('#supportSubject').value.trim(),body=$('#supportBody').value.trim(),file=$('#supportAttachment').files?.[0];if(!subject||(!body&&!file))return toast('Betreff und Nachricht fehlen');const btn=$('#createSupportTicket');btn.disabled=true;btn.textContent='Ticket wird erstellt…';try{const {data:t,error}=await sb.from('support_tickets').insert({created_by:prodSession.user.id,channel:$('#supportChannel').value,subject,category:$('#supportCategory').value,priority:$('#supportPriority').value}).select('*').single();if(error)throw error;let attachment_path=null;if(file){const safe=await sanitizeImageFile(file);attachment_path=`${t.id}/${prodSession.user.id}/${uuid()}.webp`;await checked(sb.storage.from('support-media').upload(attachment_path,safe,{contentType:'image/webp'}),'Anhang')}const {error:me}=await sb.from('support_messages').insert({ticket_id:t.id,sender_id:prodSession.user.id,body,attachment_path});if(me)throw me;closeModal();await openSupportTicket(t.id)}catch(e){productionError(e,'Support');toast('Ticket konnte nicht erstellt werden');btn.disabled=false;btn.textContent='Ticket erstellen'}};
    });
  }
  openSupportCenter=async function(){
    const {data,error}=await sb.from('support_tickets').select('*').order('updated_at',{ascending:false});if(error)return toast(error.message);const {data:reads}=await sb.from('support_ticket_reads').select('ticket_id,last_read_at').eq('user_id',prodSession.user.id),rm=new Map((reads||[]).map(r=>[r.ticket_id,new Date(r.last_read_at).getTime()]));
    openModal('4W1F Support',`<button class="btn primary wide" id="supportNew">+ Neues Ticket</button><div class="section"><div class="sectionhead"><h2>${isAdmin()?'Support Inbox':'Meine Tickets'}</h2></div><div class="list">${(data||[]).map(t=>{const unread=new Date(t.updated_at).getTime()>(rm.get(t.id)||0);return `<button class="card ticket-row clickable" data-support-ticket="${t.id}"><div class="ticket-top"><b>${unread?'● ':''}#${t.ticket_no} · ${esc(t.subject)}</b><span class="ticket-status">${supportStatusLabel(t.status)}</span></div><div class="muted tiny">${t.channel==='owner'?'Owner':'Admin'} Support · ${supportPriorityLabel(t.priority)} · ${fmtAgo(t.updated_at)}</div></button>`}).join('')||'<div class="notice">Noch keine Support-Tickets.</div>'}</div></div>`,()=>{$('#supportNew').onclick=()=>{closeModal();createSupportTicket()};$$('[data-support-ticket]').forEach(b=>b.onclick=()=>{closeModal();openSupportTicket(b.dataset.supportTicket)})});
  };

  // 8) Role-aware release notes.
  async function maybeShowReleaseNotes(){
    if(!prodSession||!me())return;const {data:release,error}=await sb.from('update_releases').select('*').eq('version',RELEASE_VERSION).eq('active',true).maybeSingle();if(error||!release)return;const {data:seen}=await sb.from('update_receipts').select('version').eq('version',RELEASE_VERSION).eq('user_id',prodSession.user.id).maybeSingle();if(seen)return;const notes=(Array.isArray(release.notes)?release.notes:[]).filter(n=>!Array.isArray(n.roles)||n.roles.includes(me().role));if(!notes.length){await sb.from('update_receipts').upsert({version:RELEASE_VERSION,user_id:prodSession.user.id,seen_at:new Date().toISOString()},{onConflict:'version,user_id'});return}openModal(`Neu in ${release.version}`,`<div class="card pad"><div class="eyebrow">4W1F Update · Build ${esc(release.build||RELEASE_BUILD)}</div><h3 style="margin:6px 0">${esc(release.title||'Was ist neu?')}</h3><div class="muted small">Nur Änderungen, die für deine Rolle relevant sind.</div></div><div class="section">${notes.map(n=>`<div class="release-note"><b>${esc(n.title||'Neu')}</b><span>${esc(n.body||'')}</span></div>`).join('')}</div><button class="btn primary wide" id="releaseNotesDone" style="margin-top:12px">Verstanden · App öffnen</button>`,()=>{$('#releaseNotesDone').onclick=async()=>{await sb.from('update_receipts').upsert({version:RELEASE_VERSION,user_id:prodSession.user.id,seen_at:new Date().toISOString()},{onConflict:'version,user_id'});closeModal()}})}

  // Add support entry to Admin Center and Account Center.
  const previousRenderAdmin=renderAdmin;
  renderAdmin=function(){previousRenderAdmin();const communication=$('#newAnnAdmin')?.closest('.admin-grid');if(communication&&!$('#supportAdmin')){const b=document.createElement('button');b.className='card admin-tool clickable';b.id='supportAdmin';b.innerHTML=`${I('bell')}<div><b>Support Tickets${state.supportUnread?` (${state.supportUnread})`:''}</b><br><span>Owner- & Admin-Support</span></div>`;communication.appendChild(b);b.onclick=openSupportCenter}};
  const previousAccountCenter=openAccountCenter;
  openAccountCenter=function(){previousAccountCenter();setTimeout(()=>{const actions=$('#sheet .account-actions');if(actions&&!$('#accountSupport')){const b=document.createElement('button');b.className='btn outline wide';b.id='accountSupport';b.textContent=`Support${state.supportUnread?` · ${state.supportUnread} neu`:''}`;actions.appendChild(b);b.onclick=()=>{closeModal();openSupportCenter()}}},0)};

  // Make project sort_order available in state for editor.
  const previousLoadForSort=loadServerState;
  loadServerState=async function(){await previousLoadForSort();const {data}=await sb.from('crew_projects').select('id,sort_order');const sm=new Map((data||[]).map(x=>[x.id,x.sort_order]));(state.projects||[]).forEach(p=>p._sortOrder=sm.get(p.id)||0)};

  const previousRender330=render;
  render=function(){if(page!=='live'&&liveRefreshTimer){clearInterval(liveRefreshTimer);liveRefreshTimer=null;liveMarkerLayer=null}previousRender330()};

  // Wrap authenticated bootstrap so support deep links and release notes open after the app is ready.
  const previousBootstrapAuthenticated=bootstrapAuthenticated;
  bootstrapAuthenticated=async function(){await previousBootstrapAuthenticated();if(!prodSession||!serverLoaded)return;setTimeout(async()=>{const q=new URLSearchParams(location.search),support=q.get('support');if(support){try{await openSupportTicket(support)}catch{}}else await maybeShowReleaseNotes()},650)};

  // If already authenticated when this pack is hot-loaded, make UI counters current.
  setTimeout(()=>{if(prodSession&&serverLoaded){refreshSupportUnread().then(()=>updateBadge()).catch(()=>{})}},1200);
})();

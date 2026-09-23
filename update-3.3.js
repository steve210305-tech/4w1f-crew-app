/* 4W1F 3.3.0 prepared feature pack — loaded after production.js */
(function(){
  'use strict';
  const RELEASE_VERSION='3.3.0';
  const RELEASE_BUILD='2026-09-23.1';
  let liveRefreshTimer=null,liveMarkerLayer=null;

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
      $('#primarySave').onclick=async()=>{const addGallery=$('#primaryGallery').checked;try{const safe=await sanitizeImageFile(file),uid=prodSession.user.id;if(kind==='avatar'){const path=`${uid}/avatar.webp`;await checked(sb.storage.from('avatars').upload(path,safe,{contentType:'image/webp',upsert:true}),'Profilbild');await checked(sb.from('profiles').update({avatar_path:path}).eq('id',uid),'Profilbild');if(addGallery){const gp=`${uid}/profile/${uuid()}.webp`;await checked(sb.storage.from('crew-media').upload(gp,safe,{contentType:'image/webp'}),'Galerie');await checked(sb.from('gallery_items').insert({uploader_id:uid,category:'crew',storage_path:gp,caption:'Profilbild',approved:true,sanitized:true,profile_visible:true,gallery_visible:true}),'Galerie')}}else{const path=`${uid}/vehicle-profile.webp`;await checked(sb.storage.from('crew-media').upload(path,safe,{contentType:'image/webp',upsert:true}),'Fahrzeugbild');await checked(sb.from('vehicles').upsert({user_id:uid,photo_path:path},{onConflict:'user_id'}),'Fahrzeugbild');if(addGallery)await checked(sb.from('gallery_items').insert({uploader_id:uid,category:'vehicle',storage_path:path,caption:'Fahrzeug',approved:true,sanitized:true,profile_visible:true,gallery_visible:true}),'Galerie')}closeModal();await loadServerState();renderProfile();toast('Bild gespeichert')}catch(e){productionError(e,'Bild');toast('Bild konnte nicht gespeichert werden')}};
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

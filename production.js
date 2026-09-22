/* 4W1F V3 Production Adapter — real Supabase auth/data/storage/realtime/push */
const SUPABASE_URL='https://cfogdatapqmurckohvjt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_2H09gs7xy63KR1zF6N6S6g_7V96btNQ';
const VAPID_PUBLIC_KEY='BJg2v8hxYk_4HgMFDLAKqaPt9lfHow40pdD39yt1uvNbc6Fw6Lq3InGXD-XTzCH-duD4a9OuXEbHhJmS7-GUWf4';
const PENDING_INVITE_KEY='4w1f-pending-invite';
const PROD_CACHE_KEY='4w1f-production-cache-v3';
const REMEMBER_LOGIN_KEY='4w1f-remember-login';
const SENSITIVE_AUTH_UNTIL_KEY='4w1f-sensitive-auth-until';
const AUTH_STORAGE_PREFIX='sb-cfogdatapqmurckohvjt-auth-token';
function rememberLoginEnabled(){return localStorage.getItem(REMEMBER_LOGIN_KEY)!=='0'}
function setRememberLogin(enabled){localStorage.setItem(REMEMBER_LOGIN_KEY,enabled?'1':'0')}
function authStore(){return rememberLoginEnabled()?localStorage:sessionStorage}
function altAuthStore(){return rememberLoginEnabled()?sessionStorage:localStorage}
const authStorage={
  getItem(key){const a=authStore().getItem(key);return a!==null?a:altAuthStore().getItem(key)},
  setItem(key,value){authStore().setItem(key,value);altAuthStore().removeItem(key)},
  removeItem(key){localStorage.removeItem(key);sessionStorage.removeItem(key)}
};
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:authStorage}});
let prodSession=null,serverLoaded=false,serverSyncing=false,syncTimer=null,realtimeChannel=null,realtimeRefreshTimer=null,lastSyncError='';

function syncIndicator(text='',kind=''){
  let el=document.getElementById('syncIndicator');
  if(!el){el=document.createElement('div');el.id='syncIndicator';el.className='sync-indicator';document.body.appendChild(el)}
  clearTimeout(syncIndicator._t);el.textContent=text;el.className='sync-indicator '+(text?'show ':'')+(kind||'');
  if(text)syncIndicator._t=setTimeout(()=>el.className='sync-indicator',kind==='bad'?4200:1500);
}
function productionError(err,context='Server'){
  const msg=err?.message||String(err||'Unbekannter Fehler');lastSyncError=msg;console.error('[4W1F]',context,err);syncIndicator(context+': '+msg,'bad');
}
function makeLocalIso(date,time){
  if(!date)return null;const [y,m,d]=date.split('-').map(Number);const [hh,mm]=String(time||'12:00').split(':').map(Number);return new Date(y,m-1,d,hh||0,mm||0,0,0).toISOString();
}
function fmtServerDate(iso){if(!iso)return'Termin folgt';return new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'short',year:'numeric',timeZone:'Europe/Berlin'}).format(new Date(iso))}
function fmtServerTime(iso){if(!iso)return'offen';return new Intl.DateTimeFormat('de-DE',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Berlin'}).format(new Date(iso))}
function statusFromDb(v,target=''){return({unterwegs:target?`Auf dem Weg zu ${target}`:'Bin unterwegs',da:'Bin da',tankstopp:'Tankstopp',panne:'Panne',spaeter:'Komme später',gleich_da:'Bin gleich da',crew_verloren:'Crew verloren',off:'Unsichtbar'})[v]||'Unsichtbar'}
function statusToDb(v){v=String(v||'').toLowerCase();if(v.includes('panne'))return'panne';if(v.includes('tank'))return'tankstopp';if(v.includes('gleich'))return'gleich_da';if(v.includes('später')||v.includes('spaeter'))return'spaeter';if(v.includes('verloren'))return'crew_verloren';if(v.includes('bin da')||v==='da')return'da';if(v.includes('unterwegs')||v.includes('auf dem weg'))return'unterwegs';return'off'}
function projectLabel(status){return({idea:'Idee',vote:'Idee / geplant',work:'In Arbeit',live:'Live',paused:'Pausiert',done:'Fertig'})[status]||status||'Projekt'}
function uiKindFromDb(v){return v==='event'?'events':v==='vehicle'?'cars':'crew'}
function dbKindFromUi(v){return v==='events'?'event':v==='cars'?'vehicle':'crew'}
function uuid(){return crypto.randomUUID()}
function cleanBaseUrl(){const u=new URL(location.href);u.search='';u.hash='';return u.toString()}
function inviteUrl(code){const u=new URL(cleanBaseUrl());u.searchParams.set('invite',code);return u.toString()}
function authEmail(){return prodSession?.user?.email||''}
function markSensitiveAuth(minutes=15){sessionStorage.setItem(SENSITIVE_AUTH_UNTIL_KEY,String(Date.now()+minutes*60*1000))}
function sensitiveAuthFresh(){return Number(sessionStorage.getItem(SENSITIVE_AUTH_UNTIL_KEY)||0)>Date.now()}
async function updateRememberLogin(enabled){
  const {data:{session},error}=await sb.auth.getSession();if(error)throw error;
  setRememberLogin(enabled);
  if(session){
    const r=await sb.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
    if(r.error)throw r.error;
    const other=enabled?sessionStorage:localStorage;
    for(let i=other.length-1;i>=0;i--){const k=other.key(i);if(k&&k.startsWith(AUTH_STORAGE_PREFIX))other.removeItem(k)}
    prodSession=r.data.session||session;
  }
}
async function requireSensitiveAuth(reason='diese Aktion'){
  if(!isAdmin()||sensitiveAuthFresh())return true;
  const password=window.prompt(`Sicherheitsbestätigung\n\nFür ${reason} bitte dein aktuelles Passwort erneut eingeben.`);
  if(password===null)return false;
  const {data,error}=await sb.auth.signInWithPassword({email:authEmail(),password});
  if(error){toast('Bestätigung fehlgeschlagen');return false}
  prodSession=data.session||prodSession;markSensitiveAuth();return true;
}
function pendingInvite(){try{return JSON.parse(localStorage.getItem(PENDING_INVITE_KEY)||'null')}catch{return null}}
function setPendingInvite(v){if(v)localStorage.setItem(PENDING_INVITE_KEY,JSON.stringify(v));else localStorage.removeItem(PENDING_INVITE_KEY)}
function authInviteFromUrl(){return new URLSearchParams(location.search).get('invite')||pendingInvite()?.code||''}

function showAuthGate(mode='login',message='',messageType=''){
  document.body.classList.add('auth-mode');page='home';
  const invite=authInviteFromUrl();
  $('#view').innerHTML=`<div class="auth-shell"><div class="auth-card"><div class="server-pill"><i></i>4W1F SERVER · FRANKFURT</div><div class="auth-brand">4 WHEELS <span>1 FAMILY_</span></div><div class="auth-sub">Echte Crew-Konten · gemeinsame Daten · Live-Sync · Server-Push</div><div class="auth-tabs"><button id="authLoginTab" class="${mode==='login'?'active':''}">Anmelden</button><button id="authSignupTab" class="${mode==='signup'?'active':''}">Mit Einladung</button></div>${message?`<div class="auth-note ${messageType==='bad'?'auth-error':messageType==='ok'?'auth-ok':''}">${esc(message)}</div>`:''}${mode==='signup'?`<div class="field"><label>Dein Name</label><input id="authName" autocomplete="name" placeholder="Vorname / Crew-Name"></div><div class="field"><label>E-Mail</label><input id="authEmail" type="email" autocomplete="email" placeholder="name@mail.de"></div><div class="field"><label>Passwort</label><input id="authPassword" type="password" autocomplete="new-password" placeholder="Mindestens 10 Zeichen"></div><div class="field"><label>Einladungscode</label><input id="authInvite" value="${esc(invite)}" autocomplete="off" placeholder="4W1F-…"></div><label style="display:flex;align-items:center;gap:10px;margin:10px 0 14px;font-size:14px;color:#ddd;cursor:pointer"><input id="authRemember" type="checkbox" ${rememberLoginEnabled()?'checked':''} style="width:18px;height:18px;accent-color:#a72cff"><span><b>Angemeldet bleiben</b><small style="display:block;color:#8f8a99;margin-top:2px">Auf diesem Gerät automatisch wieder anmelden</small></span></label><button class="btn primary wide" id="authSignup">Konto erstellen</button><div class="auth-note">Nur mit gültiger Crew-Einladung. Deine E-Mail dient dem sicheren Login und der Kontowiederherstellung.</div>`:`<div class="field"><label>E-Mail</label><input id="authEmail" type="email" autocomplete="email" placeholder="name@mail.de"></div><div class="field"><label>Passwort</label><input id="authPassword" type="password" autocomplete="current-password" placeholder="Dein Passwort"></div><label style="display:flex;align-items:center;gap:10px;margin:10px 0 14px;font-size:14px;color:#ddd;cursor:pointer"><input id="authRemember" type="checkbox" ${rememberLoginEnabled()?'checked':''} style="width:18px;height:18px;accent-color:#a72cff"><span><b>Angemeldet bleiben</b><small style="display:block;color:#8f8a99;margin-top:2px">Auf diesem Gerät automatisch wieder anmelden</small></span></label><button class="btn primary wide" id="authLogin">Anmelden</button><div class="auth-actions"><button class="auth-link" id="forgotPassword">Passwort vergessen?</button><span class="tiny muted">Invite-only · kein öffentlicher Signup</span></div>`}</div></div>`;
  $('#authLoginTab').onclick=()=>showAuthGate('login');$('#authSignupTab').onclick=()=>showAuthGate('signup');
  if(mode==='signup')$('#authSignup').onclick=signupWithInvite;else{$('#authLogin').onclick=loginWithPassword;$('#forgotPassword').onclick=forgotPassword}
  finishLaunchScreen?.('Login bereit');
}
async function signupWithInvite(){
  const name=$('#authName').value.trim(),email=$('#authEmail').value.trim().toLowerCase(),password=$('#authPassword').value,code=$('#authInvite').value.trim().toUpperCase();
  if(!name||!email||password.length<10||!code)return showAuthGate('signup','Bitte Name, gültige E-Mail, Passwort ab 10 Zeichen und Einladungscode eingeben.','bad');
  try{
    setRememberLogin($('#authRemember')?.checked!==false);
    const r=await fetch(`${SUPABASE_URL}/functions/v1/invite-signup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,inviteCode:code,displayName:name})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok)return showAuthGate('signup',j.error||'Konto konnte nicht erstellt werden.','bad');
    setPendingInvite(null);
    const {data,error}=await sb.auth.signInWithPassword({email,password});
    if(error)return showAuthGate('login','Konto wurde erstellt. Bitte melde dich jetzt an.','ok');
    prodSession=data.session;markSensitiveAuth();await bootstrapAuthenticated();
  }catch(e){productionError(e,'Registrierung');showAuthGate('signup','Serververbindung fehlgeschlagen. Bitte erneut versuchen.','bad')}
}
async function loginWithPassword(){
  const email=$('#authEmail').value.trim().toLowerCase(),password=$('#authPassword').value;if(!email||!password)return;
  setRememberLogin($('#authRemember')?.checked!==false);
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error)return showAuthGate('login',error.message,'bad');prodSession=data.session;markSensitiveAuth();await bootstrapAuthenticated();
}
async function forgotPassword(){
  const email=$('#authEmail').value.trim().toLowerCase();if(!email)return showAuthGate('login','Trage zuerst deine E-Mail ein.','bad');
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:cleanBaseUrl()});
  showAuthGate('login',error?error.message:'Passwort-Mail wurde versendet. Öffne den Link und kehre zur App zurück.',error?'bad':'ok');
}
function showPasswordReset(){
  document.body.classList.add('auth-mode');$('#view').innerHTML=`<div class="auth-shell"><div class="auth-card"><div class="auth-brand">NEUES <span>PASSWORT</span></div><div class="field"><label>Neues Passwort</label><input id="newPassword" type="password" autocomplete="new-password" placeholder="Mindestens 10 Zeichen"></div><button class="btn primary wide" id="saveNewPassword">Speichern</button></div></div>`;
  $('#saveNewPassword').onclick=async()=>{const p=$('#newPassword').value;if(p.length<8)return toast('Mindestens 8 Zeichen');const {error}=await sb.auth.updateUser({password:p});if(error)return toast(error.message);markSensitiveAuth();toast('Passwort geändert');await bootstrapAuthenticated()}
}
async function finishInviteClaim(){
  const p=pendingInvite();if(!p?.code)return false;
  const {data,error}=await sb.rpc('claim_invite',{p_code:p.code,p_display_name:p.name||prodSession?.user?.user_metadata?.display_name||'Crew Member'});
  if(error){productionError(error,'Einladung');return false}setPendingInvite(null);return !!data;
}
function showClaimGate(msg='Dein Konto ist bestätigt. Jetzt noch die Crew-Einladung verbinden.'){
  document.body.classList.add('auth-mode');const p=pendingInvite()||{};const invite=authInviteFromUrl();
  $('#view').innerHTML=`<div class="auth-shell"><div class="auth-card"><div class="auth-brand">CREW <span>FREISCHALTEN</span></div><div class="auth-note">${esc(msg)}</div><div class="field"><label>Dein Name</label><input id="claimName" value="${esc(p.name||prodSession?.user?.user_metadata?.display_name||'')}"></div><div class="field"><label>Einladungscode</label><input id="claimCode" value="${esc(invite)}"></div><button class="btn primary wide" id="claimInvite">Einladung aktivieren</button><button class="btn outline wide" style="margin-top:8px" id="claimLogout">Abmelden</button></div></div>`;
  $('#claimInvite').onclick=async()=>{setPendingInvite({code:$('#claimCode').value.trim(),name:$('#claimName').value.trim(),email:authEmail()});if(await finishInviteClaim())await bootstrapAuthenticated();else showClaimGate('Einladung konnte nicht aktiviert werden. Prüfe den Code.')};
  $('#claimLogout').onclick=logoutApp;
}
function showPreviewLocked(access){
  document.body.classList.add('auth-mode');$('#view').innerHTML=`<div class="auth-shell"><div class="auth-card"><div class="server-pill"><i></i>KONTO AKTIV</div><div class="auth-brand">ADMIN <span>TESTPHASE</span></div><div class="auth-sub">Dein Mitgliedskonto ist bereits angelegt, aber die Crew-Freigabe ist noch nicht geöffnet.</div><div class="auth-note">Sobald der Owner die finale Freigabe bestätigt, funktioniert genau dieses Konto ohne neue Registrierung.</div><button class="btn outline wide" id="lockedLogout">Abmelden</button></div></div>`;$('#lockedLogout').onclick=logoutApp;
}
async function logoutApp(){await sb.auth.signOut({scope:'local'});sessionStorage.removeItem(SENSITIVE_AUTH_UNTIL_KEY);prodSession=null;serverLoaded=false;realtimeChannel?.unsubscribe();realtimeChannel=null;showAuthGate('login','Du bist auf diesem Gerät abgemeldet.','ok')}
async function logoutEverywhere(){if(!confirm('Wirklich auf allen Geräten abmelden?'))return;const {error}=await sb.auth.signOut({scope:'global'});if(error)return toast(error.message);sessionStorage.removeItem(SENSITIVE_AUTH_UNTIL_KEY);prodSession=null;serverLoaded=false;realtimeChannel?.unsubscribe();realtimeChannel=null;closeModal();showAuthGate('login','Alle Sitzungen wurden beendet.','ok')}

async function getAccessState(){const {data,error}=await sb.rpc('get_my_access_state');if(error)throw error;return Array.isArray(data)?data[0]:data}
async function bootstrapAuthenticated(){
  const {data:{session}}=await sb.auth.getSession();prodSession=session;if(!session)return showAuthGate('login');
  let access;try{access=await getAccessState()}catch(e){productionError(e,'Zugriff');return showAuthGate('login','Serververbindung fehlgeschlagen.','bad')}
  if(!access?.has_profile)return showAuthGate('login','Dieses Login-Konto hat keine aktive Crew-Freigabe. Bitte nutze deinen persönlichen Einladungslink oder wende dich an einen Admin.','bad')
  if(!access.active)return showPreviewLocked(access);
  if(!access.can_access)return showPreviewLocked(access);
  setLaunchStatus?.('Crew-Daten werden geladen…');
  document.body.classList.remove('auth-mode');await loadServerState();
  setLaunchStatus?.('Home wird vorbereitet…');
  applyLaunchContext();bindProductionHeader();subscribeRealtime();render();setTimeout(maybeFinalWelcome,350);
  finishLaunchScreen?.('App bereit');
}
function bindProductionHeader(){$('#notifBtn').onclick=showNotifications;$('#profileBtn').onclick=openAccountCenter}

async function loadServerState(){
  syncIndicator('Synchronisiere…');serverLoaded=false;const uid=prodSession.user.id;
  const q=[
    sb.from('crew_settings').select('*').eq('id',1).single(),
    sb.from('profiles').select('*').order('joined_at',{ascending:true}),
    sb.from('vehicles').select('*'),
    sb.from('events').select('*').order('starts_at',{ascending:true,nullsFirst:false}),
    sb.from('event_rsvps').select('*'),
    sb.from('announcements').select('*').order('published_at',{ascending:false}),
    sb.from('announcement_receipts').select('*'),
    sb.from('crew_projects').select('*').order('sort_order',{ascending:true}),
    sb.from('live_locations').select('*'),
    sb.from('gallery_items').select('*').order('created_at',{ascending:false}).limit(100),
    sb.from('push_subscriptions').select('id,endpoint,enabled').eq('user_id',uid).eq('enabled',true),
    sb.from('audit_log').select('*').order('created_at',{ascending:false}).limit(100),
    sb.from('saved_places').select('*').eq('user_id',uid).order('created_at',{ascending:true})
  ];
  const res=await Promise.all(q);for(const r of res)if(r.error)throw r.error;
  const [cfgR,profR,vehR,eventR,rsvpR,annR,receiptR,projectR,liveR,galleryR,pushR,auditR,placesR]=res;
  const cfg=cfgR.data,profiles=profR.data||[],vehicles=vehR.data||[],events=eventR.data||[],rsvps=rsvpR.data||[],anns=annR.data||[],receipts=receiptR.data||[],projects=projectR.data||[],lives=liveR.data||[],gallery=galleryR.data||[],savedPlaces=placesR.data||[];
  const vehicleMap=new Map(vehicles.map(v=>[v.user_id,v]));const liveMap=new Map(lives.map(v=>[v.user_id,v]));
  const fresh=normalize({schema:5,currentUser:uid,settings:{whatsapp:cfg.whatsapp_url||'',push:(pushR.data||[]).length>0,youtube:cfg.youtube_url||'',instagram:cfg.instagram_url||'',welcomeAuto:cfg.welcome_auto!==false,previewMode:cfg.release_stage!=='crew_release'},users:[],applications:[],announcements:[],events:[],live:{share:false,status:'Unsichtbar',lat:null,lng:null,expiresAt:null,target:null,eta:null,markers:[]},photos:[],audit:[],customLabels:cfg.custom_labels||[],branding:{slogan:'Different cars. Same values.'},welcomeSeenBy:[],finalWelcomeSeenBy:[],crew:{about:cfg.about||'',values:(cfg.values_json||[]).map(v=>Array.isArray(v)?v:[String(v.title||'VALUE').toUpperCase(),String(v.text||'')]),rules:cfg.rules_json||[]},projects:[],media:{crewFilmTitle:cfg.film_title||'Mehr als Blech',crewFilmStatus:cfg.film_status||'Vorbereitung'}});
  fresh.users=profiles.map(p=>{const v=vehicleMap.get(p.id),lv=liveMap.get(p.id);return{id:p.id,name:p.display_name,role:p.role,labels:p.labels||[],car:v?.model||'',ig:p.instagram||'',status:lv?.sharing?statusFromDb(lv.status,lv.target_name):'Offline',emoji:p.role==='owner'?'👑':p.role==='admin'?'💜':'🚗',bio:p.bio||'',joinedAt:(p.joined_at||'').slice(0,10),_active:p.active!==false,_avatarPath:p.avatar_path||null,_vehicle:v?{make:v.make||'',model:v.model||'',year:v.year||null,power_ps:v.power_ps||null,description:v.description||'',mods:v.mods||[],photo_path:v.photo_path||null}:null}});
  const rsvpByEvent={};for(const r of rsvps){(rsvpByEvent[r.event_id]??={})[r.user_id]=r.status}
  const arrivalsByTarget={};for(const l of lives){if(!l.sharing||!l.target_id)continue;(arrivalsByTarget[l.target_id]??={})[l.user_id]={arrival:l.eta_at?fmtServerTime(l.eta_at):'',minutes:l.eta_minutes||0,distance:Number(l.distance_km||0)}}
  fresh.events=events.map(e=>({id:e.id,name:e.title,date:fmtServerDate(e.starts_at),time:fmtServerTime(e.starts_at),place:e.place_name||'Treffpunkt folgt',lat:e.latitude,lng:e.longitude,type:e.event_type||'Treffen',tagline:e.tagline||'Gemeinsam. Unterwegs. Immer Family.',rsvp:rsvpByEvent[e.id]||{},arrivals:arrivalsByTarget[e.id]||{},stops:Array.isArray(e.route_json)?e.route_json:[],past:e.status==='completed'||e.status==='cancelled'||(e.starts_at&&new Date(e.starts_at)<new Date()),_startsAt:e.starts_at,_endsAt:e.ends_at,_status:e.status,_createdBy:e.created_by,_coverPath:e.cover_path,_isNew:false}));
  const recByAnn={};for(const r of receipts)(recByAnn[r.announcement_id]??=[]).push(r);
  fresh.announcements=anns.map(a=>{const rr=recByAnn[a.id]||[],responses={};for(const o of a.response_options||[])responses[o]=rr.filter(x=>x.response===o).map(x=>x.user_id);return{id:a.id,title:a.title,body:a.body,priority:a.priority,created:a.published_at?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(a.published_at)):'',date:a.starts_at?new Date(a.starts_at).toISOString().slice(0,10):'',time:a.starts_at?fmtServerTime(a.starts_at):'',place:a.place_name||'',lat:a.latitude,lng:a.longitude,responseOptions:a.response_options||[],responses,readBy:rr.filter(x=>x.read_at).map(x=>x.user_id),confirmedBy:rr.filter(x=>x.confirmed_at).map(x=>x.user_id),confirmRequired:a.requires_confirmation,hiddenBy:rr.filter(x=>x.hidden_at).map(x=>x.user_id),arrivals:arrivalsByTarget[a.id]||{},_startsAt:a.starts_at,_publishedAt:a.published_at,_pushEnabled:a.push_enabled!==false,_createdBy:a.created_by,_isNew:false,_displayUntil:a.display_until||null,_pinned:!!a.pinned}});
  fresh.projects=projects.map(p=>({id:p.id,icon:p.icon||'◆',title:p.title,status:p.status,statusLabel:p.status_label||projectLabel(p.status),text:p.description||'',_createdBy:p.created_by}));
  const myLive=liveMap.get(uid);fresh.live={share:!!myLive?.sharing,status:myLive?.sharing?statusFromDb(myLive.status,myLive.target_name):'Unsichtbar',lat:myLive?.latitude??null,lng:myLive?.longitude??null,expiresAt:myLive?.expires_at?new Date(myLive.expires_at).getTime():null,target:myLive?.target_name?{name:myLive.target_name,kind:myLive.target_type,id:myLive.target_id,lat:null,lng:null}:null,eta:myLive?.eta_at?{arrival:fmtServerTime(myLive.eta_at),minutes:myLive.eta_minutes||0,distance:Number(myLive.distance_km||0)}:null,_etaAt:myLive?.eta_at||null,placeLabel:myLive?.place_label||'',movementState:myLive?.movement_state||'unknown',speedKmh:Number(myLive?.speed_kmh||0),markers:lives.filter(l=>l.user_id!==uid&&l.sharing&&l.latitude!=null).map(l=>({id:l.user_id,lat:l.latitude,lng:l.longitude,status:l.place_label||statusFromDb(l.status,l.target_name)}))};
  if(fresh.live.target?.id){const t=fresh.live.target.kind==='event'?fresh.events.find(e=>e.id===fresh.live.target.id):fresh.announcements.find(a=>a.id===fresh.live.target.id);if(t){fresh.live.target.lat=t.lat;fresh.live.target.lng=t.lng}}
  fresh.projects=projects.map(p=>({id:p.id,icon:p.icon||'◆',title:p.title,status:p.status,statusLabel:p.status_label||projectLabel(p.status),text:p.description||'',_createdBy:p.created_by}));
  const meProfile=profiles.find(p=>p.id===uid);if(meProfile?.onboarding_complete){fresh.welcomeSeenBy=[uid];fresh.finalWelcomeSeenBy=[uid]}
  fresh.savedPlaces=savedPlaces;fresh.audit=(auditR.data||[]).map(x=>`${new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(x.created_at))} · ${x.action} · ${x.entity_type}`);
  fresh.photos=[];
  for(const g of gallery){const {data:signed}=await sb.storage.from('crew-media').createSignedUrl(g.storage_path,86400);if(signed?.signedUrl)fresh.photos.push({id:g.id,data:signed.signedUrl,label:g.caption||'Crew Foto',kind:uiKindFromDb(g.category),createdAt:new Date(g.created_at).getTime(),eventId:g.event_id,_storagePath:g.storage_path})}
  state=fresh;try{localStorage.setItem(PROD_CACHE_KEY,JSON.stringify(state))}catch{}serverLoaded=true;syncIndicator('Synchronisiert','ok');
}

function eventRow(e){return{id:e.id,title:e.name,event_type:e.type||'Treffen',tagline:e.tagline||'Gemeinsam. Unterwegs. Immer Family.',description:e.description||'',starts_at:e._startsAt||null,ends_at:e._endsAt||null,place_name:e.place||'',latitude:e.lat??null,longitude:e.lng??null,route_json:e.stops||[],cover_path:e._coverPath||null,status:e._status||'published',created_by:e._createdBy||prodSession.user.id}}
function annRow(a){a._publishedAt=a._publishedAt||new Date().toISOString();return{id:a.id,title:a.title,body:a.body||'',priority:a.priority||'normal',requires_confirmation:!!a.confirmRequired,response_options:a.responseOptions||[],place_name:a.place||null,latitude:a.lat??null,longitude:a.lng??null,starts_at:a._startsAt||null,published_at:a._publishedAt,reminder_enabled:true,push_enabled:a._pushEnabled!==false,display_until:a._displayUntil||null,pinned:!!a._pinned,created_by:a._createdBy||prodSession.user.id}}
async function checked(p,label){const r=await p;if(r.error)throw new Error(`${label}: ${r.error.message}`);return r}
function queueBackendSync(){if(!serverLoaded||!prodSession)return;clearTimeout(syncTimer);syncTimer=setTimeout(syncStateToBackend,120)}
async function syncStateToBackend(){
  if(serverSyncing||!serverLoaded||!prodSession)return;serverSyncing=true;syncIndicator('Speichere…');const uid=prodSession.user.id;
  try{
    const current=me();
    await checked(sb.from('profiles').update({display_name:current.name||'Crew Member',bio:current.bio||'',instagram:current.ig||'',onboarding_complete:(state.finalWelcomeSeenBy||[]).includes(uid)||(state.welcomeSeenBy||[]).includes(uid),last_seen_at:new Date().toISOString()}).eq('id',uid),'Profil');
    const cv=current._vehicle||{};await checked(sb.from('vehicles').upsert({user_id:uid,model:cv.model||current.car||'',make:cv.make||'',year:cv.year||null,power_ps:cv.power_ps||null,description:cv.description||'',mods:cv.mods||[],photo_path:cv.photo_path||null},{onConflict:'user_id'}),'Fahrzeug');
    if(isOwner())for(const u of state.users.filter(x=>x.id!==uid))await checked(sb.from('profiles').update({role:u.role,labels:u.labels||[]}).eq('id',u.id),'Rolle');
    if(isAdmin()){
      await checked(sb.from('crew_settings').update({about:state.crew.about||'',rules_json:state.crew.rules||[],values_json:(state.crew.values||[]).map(v=>({title:v[0],text:v[1]})),custom_labels:state.customLabels||[],whatsapp_url:state.settings.whatsapp||null,youtube_url:state.settings.youtube||null,instagram_url:state.settings.instagram||null,welcome_auto:state.settings.welcomeAuto!==false,film_title:state.media?.crewFilmTitle||'Mehr als Blech',film_status:state.media?.crewFilmStatus||'Vorbereitung'}).eq('id',1),'Crew-Einstellungen');
      for(const e of state.events){await checked(sb.from('events').upsert(eventRow(e),{onConflict:'id'}),'Event');e._isNew=false;e._createdBy=e._createdBy||uid}
      for(const a of state.announcements){await checked(sb.from('announcements').upsert(annRow(a),{onConflict:'id'}),'Ankündigung');a._isNew=false;a._createdBy=a._createdBy||uid}
      for(const p of state.projects)await checked(sb.from('crew_projects').upsert({id:p.id,title:p.title,description:p.text||'',icon:p.icon||'◆',status:p.status||'idea',status_label:p.statusLabel||projectLabel(p.status),created_by:p._createdBy||uid},{onConflict:'id'}),'Projekt');
    }
    for(const e of state.events){const v=e.rsvp?.[uid];if(v)await checked(sb.from('event_rsvps').upsert({event_id:e.id,user_id:uid,status:v,updated_at:new Date().toISOString()},{onConflict:'event_id,user_id'}),'Zusage')}
    for(const a of state.announcements){const response=myResponse(a)||null,read=(a.readBy||[]).includes(uid),confirmed=(a.confirmedBy||[]).includes(uid),hidden=(a.hiddenBy||[]).includes(uid);await checked(sb.from('announcement_receipts').update({read_at:read?new Date().toISOString():null,confirmed_at:confirmed?new Date().toISOString():null,response,hidden_at:hidden?new Date().toISOString():null}).eq('announcement_id',a.id).eq('user_id',uid),'Lesestatus')}
    const lv=state.live||{};await checked(sb.from('live_locations').upsert({user_id:uid,sharing:!!lv.share,status:lv.share?statusToDb(lv.status):'off',latitude:lv.share?lv.lat:null,longitude:lv.share?lv.lng:null,target_type:lv.share?(lv.target?.kind||null):null,target_id:lv.share?(lv.target?.id||null):null,target_name:lv.share?(lv.target?.name||null):null,eta_at:lv.share?(lv._etaAt||null):null,distance_km:lv.share?(lv.eta?.distance||null):null,eta_minutes:lv.share?(lv.eta?.minutes||null):null,expires_at:lv.share&&lv.expiresAt?new Date(lv.expiresAt).toISOString():null,place_label:lv.placeLabel||null,movement_state:lv.movementState||'unknown',speed_kmh:lv.speedKmh||null,updated_at:new Date().toISOString()},{onConflict:'user_id'}),'Live');
    try{localStorage.setItem(PROD_CACHE_KEY,JSON.stringify(state))}catch{}syncIndicator('Gespeichert','ok');
  }catch(e){productionError(e,'Speichern')}finally{serverSyncing=false}
}
save=function(){try{localStorage.setItem(PROD_CACHE_KEY,JSON.stringify(state))}catch{}updateBadge();queueBackendSync()};

function subscribeRealtime(){
  realtimeChannel?.unsubscribe();realtimeChannel=sb.channel('4w1f-production');for(const t of ['profiles','vehicles','events','event_rsvps','announcements','announcement_receipts','gallery_items','crew_projects','live_locations','crew_settings'])realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:t},()=>scheduleRealtimeRefresh());realtimeChannel.subscribe();
}
function scheduleRealtimeRefresh(){clearTimeout(realtimeRefreshTimer);realtimeRefreshTimer=setTimeout(async()=>{if(serverSyncing)return scheduleRealtimeRefresh();try{const currentPage=page;await loadServerState();page=currentPage;render()}catch(e){productionError(e,'Live-Sync')}},900)}

handlePhotos=async function(files){
  const arr=[...files].slice(0,8).filter(f=>/^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type)&&f.size<=12*1024*1024);if(!arr.length)return toast('Nur Bilder bis 12 MB');
  const events=state.events.slice(0,20);openModal('Fotos hochladen',`<div class="field"><label>Bereich</label><select id="uploadKind"><option value="crew">Crew</option><option value="vehicle">Fahrzeug</option><option value="event">Event</option></select></div><div class="field"><label>Event (optional)</label><select id="uploadEvent"><option value="">Kein Event</option>${events.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></div><div class="field"><label>Beschreibung</label><input id="uploadCaption" placeholder="z. B. Night Drive Mannheim"></div><div class="notice">${arr.length} Bild${arr.length===1?'':'er'} · private Crew-Mediathek</div><button class="btn primary wide" id="startUpload">Jetzt hochladen</button>`,()=>{$('#startUpload').onclick=async()=>{const btn=$('#startUpload');btn.disabled=true;btn.textContent='Upload läuft…';const kind=$('#uploadKind').value,eventId=$('#uploadEvent').value||null,caption=$('#uploadCaption').value.trim();let ok=0;for(const f of arr){try{const ext=(f.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`${prodSession.user.id}/${uuid()}.${ext}`;await checked(sb.storage.from('crew-media').upload(path,f,{contentType:f.type,upsert:false}),'Upload');await checked(sb.from('gallery_items').insert({uploader_id:prodSession.user.id,event_id:eventId,category:kind,storage_path:path,caption:caption||f.name.replace(/\.[^.]+$/,''),approved:true}),'Galerie');ok++}catch(e){productionError(e,'Foto')}}closeModal();await loadServerState();galleryView=kind==='event'?'events':kind==='vehicle'?'cars':'crew';renderGallery();toast(`${ok}/${arr.length} Fotos hochgeladen`)}})};
photoCount=function(){return state.photos.length};galleryDemoItems=function(){return[]};

openApplications=async function(){
  const {data:invites,error}=await sb.from('invites').select('*').eq('active',true).order('created_at',{ascending:false}).limit(30);if(error)return productionError(error,'Einladungen');
  openModal('Einladungen',`<div class="card pad"><div class="eyebrow">Invite-only</div><h3 style="margin:5px 0">Neue Crew-Konten</h3><div class="muted small">${state.settings.previewMode?'Aktuell Admin-Testphase. Owner kann Admin-Testlinks erzeugen; Mitglieder werden erst nach Crew-Freigabe zugelassen.':'Crew ist freigegeben. Mitgliedslinks können direkt verteilt werden.'}</div></div><div class="field"><label>Rolle</label><select id="inviteRole"><option value="member">Mitglied</option>${isOwner()?'<option value="admin">Admin</option>':''}</select></div><div class="field"><label>E-Mail sperren (optional)</label><input id="inviteEmail" type="email" placeholder="Nur diese Person darf den Code nutzen"></div><div class="field"><label>Anzahl Nutzungen</label><input id="inviteUses" type="number" min="1" max="100" value="1"></div><button class="btn primary wide" id="createInvite">Einladung erzeugen</button><div class="section"><div class="sectionhead"><h2>Aktive Codes</h2></div><div class="list">${(invites||[]).map(i=>`<div class="card pad"><b>${i.role==='admin'?'ADMIN':'MITGLIED'}</b><div class="invite-code">${esc(i.code)}</div><div class="muted tiny">${i.used_count}/${i.max_uses} genutzt${i.email?' · E-Mail gebunden':''}</div><div class="actions"><button class="btn outline sm" data-copy-invite="${i.code}">Link kopieren</button><button class="btn primary sm" data-share-invite="${i.code}">Teilen</button></div></div>`).join('')||'<div class="notice">Noch keine aktiven Einladungen.</div>'}</div></div>`,()=>{$('#createInvite').onclick=async()=>{const role=$('#inviteRole').value,email=$('#inviteEmail').value.trim()||null,uses=Math.max(1,Math.min(100,+$('#inviteUses').value||1));const {data,error}=await sb.rpc('create_invite',{p_role:role,p_labels:[],p_email:email,p_max_uses:uses});if(error)return toast(error.message);const code=data;await copyText(inviteUrl(code),'Einladungslink kopiert');closeModal();openApplications()};$$('[data-copy-invite]').forEach(b=>b.onclick=()=>copyText(inviteUrl(b.dataset.copyInvite),'Einladungslink kopiert'));$$('[data-share-invite]').forEach(b=>b.onclick=()=>shareAppLink(inviteUrl(b.dataset.shareInvite),'4W1F Einladung'))})
};

openMemberAdmin=function(id){
  const u=state.users.find(x=>x.id===id);if(!u)return;const targetOwner=u.role==='owner',canManageRole=isOwner()&&!targetOwner,canSuspend=!targetOwner&&(isOwner()||u.role==='member');let labels=[...(u.labels||[])];
  openModal(u.name,`<div class="card pad"><b>${esc(u.name)}</b><div class="muted small">${esc(u.car||'Kein Fahrzeug')} · ${roleLabel(u.role)}</div></div>${targetOwner?'<div class="notice">🔒 Owner ist serverseitig gegen Löschung, Sperre und Herabstufung geschützt.</div>':`${canManageRole?`<div class="field"><label>Rolle</label><select id="roleSel"><option value="member" ${u.role==='member'?'selected':''}>Mitglied</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select></div><div class="field"><label>Funktions-Labels</label><div class="chips" id="labelChoices">${(state.customLabels||[]).map(l=>`<button class="chip ${labels.includes(l)?'active':''}" data-label="${esc(l)}">${esc(l)}</button>`).join('')}</div></div><button class="btn primary wide" id="saveMember">Rolle & Labels speichern</button>`:''}${canSuspend?`<button class="btn ${u._active===false?'good':'bad'} wide" style="margin-top:8px" id="suspendMember">${u._active===false?'Zugang reaktivieren':'Zugang sperren'}</button>`:''}`}` ,()=>{if(canManageRole){$$('#labelChoices [data-label]').forEach(b=>b.onclick=()=>{const l=b.dataset.label;labels=labels.includes(l)?labels.filter(x=>x!==l):[...labels,l];b.classList.toggle('active')});$('#saveMember').onclick=async()=>{if(!await requireSensitiveAuth('Rollen- oder Rechteänderungen'))return;const role=$('#roleSel').value;const {error}=await sb.from('profiles').update({role,labels:role==='admin'?labels:[]}).eq('id',u.id);if(error)return toast(error.message);closeModal();await loadServerState();openMemberManagement()}}if(canSuspend)$('#suspendMember').onclick=async()=>{const next=u._active===false;if(!confirm(`${u.name} wirklich ${next?'reaktivieren':'sperren'}?`))return;if(!await requireSensitiveAuth('das Ändern eines Mitgliederzugangs'))return;const {error}=await sb.from('profiles').update({active:next}).eq('id',u.id);if(error)return toast(error.message);closeModal();await loadServerState();render();toast(next?'Zugang reaktiviert':'Zugang gesperrt')}})
};

async function enablePushNotifications(silent=false){
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){if(!silent)toast('Push wird auf diesem Gerät nicht unterstützt');return false}
  if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!window.matchMedia('(display-mode: standalone)').matches&&!navigator.standalone){if(!silent)openModal('Push auf iPhone',`<div class="notice">Für Push bei geschlossener App muss 4W1F zuerst über Safari → Teilen → <b>Zum Home-Bildschirm</b> installiert werden.</div><button class="btn primary wide" id="pushInstallGuide">Installationshilfe</button>`,()=>$('#pushInstallGuide').onclick=installCrewApp);return false}
  const perm=await Notification.requestPermission();if(perm!=='granted'){if(!silent)toast('Benachrichtigungen nicht erlaubt');return false}
  try{const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});const j=sub.toJSON();await checked(sb.from('push_subscriptions').upsert({user_id:prodSession.user.id,endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,user_agent:navigator.userAgent,enabled:true,failure_count:0},{onConflict:'endpoint'}),'Push');state.settings.push=true;save();if(!silent)toast('Server-Push aktiviert ✓');return true}catch(e){productionError(e,'Push');return false}
}
async function disablePushNotifications(){try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub){await sb.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);await sub.unsubscribe()}state.settings.push=false;save();toast('Push deaktiviert')}catch(e){productionError(e,'Push')}}
function urlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4),base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
pushTest=async function(title='4 Wheels 1 Family',body='Server-Push-Test',silent=false){if(!await enablePushNotifications(silent))return;const {error}=await sb.rpc('queue_self_test_push');if(error)return productionError(error,'Push-Test');if(!silent)toast('Server-Push eingeplant · kommt spätestens in ~1 Min.')};

openReleaseCenter=async function(){
  const {data:feedback}=await sb.from('release_feedback').select('id,page,message,status,created_at,user_id').order('created_at',{ascending:false}).limit(20);
  const stage=state.settings.previewMode?'admin_preview':'crew_release';openModal('Release Center',`<div class="card release-hero"><div class="eyebrow">V3.0 · PRODUCTION</div><h3>${stage==='admin_preview'?'Admin-Test läuft':'Crew Release aktiv'}</h3><p>${stage==='admin_preview'?'Ihr testet bereits das echte Produktivsystem. Dieselbe App wird nach deinem Go für Mitglieder freigeschaltet.':'Die Crew ist freigeschaltet. Neue Mitglieder können über Einladungscodes direkt starten.'}</p><div class="release-live"><i></i><div><b>Backend online</b><span>Auth · Postgres · RLS · Realtime · Storage · Web Push</span></div></div><div class="release-buttons"><button class="btn primary" id="shareMainApp">${I('share')} App teilen</button><button class="btn outline" id="releaseInvites">Einladungen</button><button class="btn outline" id="releasePush">Push testen</button></div></div>${isOwner()&&stage==='admin_preview'?`<div class="section card pad release-danger"><div class="eyebrow">Grande Finale</div><h3 style="margin:5px 0">Für die ganze Crew freigeben</h3><div class="muted small">Danach können vorhandene Mitgliedskonten und neue Member-Invites sofort auf dieselbe App zugreifen.</div><div class="field"><label>Zur Bestätigung FAMILY eingeben</label><input id="releaseConfirm" autocomplete="off"></div><button class="btn primary wide" id="releaseCrew">CREW RELEASE AKTIVIEREN</button></div>`:''}<div class="section"><div class="sectionhead"><h2>Admin Feedback</h2></div><div class="field"><textarea id="releaseFeedback" placeholder="Was soll vor dem Go noch geändert werden?"></textarea></div><button class="btn outline wide" id="sendFeedback">Feedback speichern</button><div class="feedback-list" style="margin-top:10px">${(feedback||[]).map(f=>`<div class="feedback-card"><b>${esc(f.message)}</b><span>${new Date(f.created_at).toLocaleString('de-DE')} · ${esc(f.status)}</span></div>`).join('')||'<div class="notice">Noch kein Feedback gespeichert.</div>'}</div></div><div class="section card pad"><div class="eyebrow">Produktionsstatus</div>${releaseStatus('Echter Login',true,'Invite-only E-Mail-Konten mit Passwort')}${releaseStatus('Server-Rollen & Owner Lock',true,'RLS und Datenbank-Trigger aktiv')}${releaseStatus('Galerie & Storage',true,'Private Crew-Mediathek')}${releaseStatus('Live Sync',true,'Realtime-Daten aus Supabase')}${releaseStatus('Push bei geschlossener App',true,'Web Push + Service Worker')}${releaseStatus('Ungelesen-Erinnerung',true,'Server prüft stündlich, Standard höchstens alle 6 Stunden tagsüber')}</div></div>`,()=>{$('#shareMainApp').onclick=()=>shareAppLink(cleanBaseUrl(),'4 Wheels 1 Family');$('#releaseInvites').onclick=()=>{closeModal();openApplications()};$('#releasePush').onclick=()=>pushTest();$('#sendFeedback').onclick=async()=>{const m=$('#releaseFeedback').value.trim();if(!m)return;const {error}=await sb.from('release_feedback').insert({user_id:prodSession.user.id,page:page,message:m});if(error)return toast(error.message);closeModal();openReleaseCenter()};if($('#releaseCrew'))$('#releaseCrew').onclick=async()=>{if($('#releaseConfirm').value.trim().toUpperCase()!=='FAMILY')return toast('Bitte FAMILY eingeben');if(!await requireSensitiveAuth('die Crew-Freigabe'))return;const {error}=await sb.from('crew_settings').update({release_stage:'crew_release'}).eq('id',1);if(error)return toast(error.message);state.settings.previewMode=false;save();closeModal();toast('Crew Release ist aktiv 💜');openReleaseCenter()}})
};

openAccountCenter=function(){const remembered=rememberLoginEnabled();openModal('Profil & App',`<div class="card member-row"><div class="avatar">${me().emoji}</div><div class="member-info"><b>${esc(me().name)}</b><span>${roleLabel(me().role)} · ${esc(me().car||'Crew Member')}</span><div class="tiny muted">${esc(authEmail())}</div></div></div><div class="card pad" style="margin-top:10px"><div class="eyebrow">ANMELDUNG</div><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:5px"><div><b>${remembered?'Angemeldet bleiben aktiv':'Nur diese Sitzung'}</b><div class="muted tiny">${remembered?'Die App meldet dich auf diesem Gerät automatisch wieder an.':'Beim Schließen dieser Browser-Sitzung wird die Anmeldung verworfen.'}</div></div><button class="btn outline sm" id="accountRemember">${remembered?'Deaktivieren':'Aktivieren'}</button></div></div><div class="account-actions"><button class="btn primary wide" id="accountProfile">Mein Profil</button>${isAdmin()?'<button class="btn outline wide" id="accountRelease">Release Center</button>':''}<button class="btn outline wide" id="accountPush">${state.settings.push?'Push verwalten':'Push aktivieren'}</button><button class="btn outline wide" id="accountInstall">App installieren</button><button class="btn outline wide" id="accountLogoutAll">Auf allen Geräten abmelden</button><button class="btn bad wide" id="accountLogout">Auf diesem Gerät abmelden</button></div><div class="tiny muted" style="margin-top:12px">V${APP_VERSION} · Build ${BUILD} · Production</div>`,()=>{$('#accountProfile').onclick=()=>{closeModal();page='profile';render()};$('#accountRelease')?.addEventListener('click',()=>{closeModal();openReleaseCenter()});$('#accountPush').onclick=()=>state.settings.push?openModal('Push verwalten',`<div class="notice">Push ist auf diesem Gerät aktiv. Ungelesene Crew-Nachrichten werden serverseitig erneut erinnert.</div><button class="btn bad wide" id="disablePush">Auf diesem Gerät deaktivieren</button>`,()=>$('#disablePush').onclick=async()=>{await disablePushNotifications();closeModal()}):enablePushNotifications();$('#accountInstall').onclick=installCrewApp;$('#accountRemember').onclick=async()=>{try{await updateRememberLogin(!remembered);toast(!remembered?'Anmeldung wird jetzt gespeichert':'Anmeldung gilt nur noch für diese Sitzung');closeModal();openAccountCenter()}catch(e){productionError(e,'Anmeldung');toast('Einstellung konnte nicht gespeichert werden')}};$('#accountLogoutAll').onclick=logoutEverywhere;$('#accountLogout').onclick=logoutApp})};

openSecurityCenter=function(){openModal('Sicherheit',`<div class="card pad"><div class="security-line"><i class="security-dot"></i><div><b>Supabase Production Backend</b><div class="muted tiny">Eigenes 4W1F Projekt · Frankfurt · getrennt von anderen Projekten</div></div></div><div class="security-line"><i class="security-dot"></i><div><b>Row Level Security</b><div class="muted tiny">Owner · Admin · Member werden serverseitig geprüft</div></div></div><div class="security-line"><i class="security-dot"></i><div><b>Owner Lock</b><div class="muted tiny">Owner kann serverseitig nicht gelöscht oder herabgestuft werden</div></div></div><div class="security-line"><i class="security-dot"></i><div><b>Private Media</b><div class="muted tiny">Galerie liegt in privatem Storage mit Upload-Limits</div></div></div><div class="security-line"><i class="security-dot"></i><div><b>Push-Secrets</b><div class="muted tiny">Private VAPID-/Cron-Schlüssel liegen ausschließlich im Server-Vault</div></div></div></div><div class="section"><button class="btn outline wide" id="auditOpen">Audit-Log öffnen</button></div>`,()=>$('#auditOpen').onclick=()=>{closeModal();openAudit()})};
openBackupUpdates=function(){openModal('System & Updates',`<div class="card pad"><b>Version ${APP_VERSION}</b><div class="muted small">Build ${BUILD} · Production</div></div><div class="actions"><button class="btn primary" id="checkUpdate">Updates prüfen</button><button class="btn outline" id="exportData">Ansicht exportieren</button></div><div class="notice">Daten werden nicht mehr aus lokalen JSON-Backups wiederhergestellt. Supabase ist die zentrale Wahrheit; dadurch kann ein altes Handy keinen neueren Crew-Stand überschreiben.</div>`,()=>{$('#checkUpdate').onclick=()=>checkForUpdates(true);$('#exportData').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`4w1f-export-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}})};

openFinalWelcome=function(){openModal('Willkommen bei 4W1F',`<div class="final-welcome"><div class="final-welcome-logo"><span>4 WHEELS</span><b>1 FAMILY_</b><small>MORE THAN A CREW</small></div><div class="eyebrow">${state.settings.previewMode?'ADMIN TEST · PRODUKTIVSYSTEM':'WILLKOMMEN IN DER FAMILY'}</div><h3>Cars verbinden uns.<br><em>Menschen machen uns zur Family.</em></h3><p>${esc(state.crew.about)}</p><div class="final-values">${state.crew.values.map(v=>`<div><b>${esc(v[0])}</b><span>${esc(v[1])}</span></div>`).join('')}</div><div class="welcome-feature-grid"><div><b>EVENTS</b><span>Treffen, Zusagen, ETA & Routen</span></div><div><b>CREW LIVE</b><span>Standort nur wenn du ihn freigibst</span></div><div><b>GALERIE</b><span>Events, Cars & Crew-Momente</span></div><div><b>PUSH</b><span>Wichtige Crew-News auch bei geschlossener App</span></div></div><div class="notice">Angemeldet als <b>${esc(me().name)}</b> · ${roleLabel(me().role)}. Deine Crew-Daten werden mit dem 4W1F-Server synchronisiert.</div></div><div class="actions"><button class="btn outline" id="finalDna">Crew DNA</button>${isAdmin()?'<button class="btn outline" id="finalRelease">Release Center</button>':''}<button class="btn primary" id="finalStart">App starten</button></div>`,()=>{$('#finalDna').onclick=()=>{closeModal();openCrewDNA()};$('#finalRelease')?.addEventListener('click',()=>{closeModal();openReleaseCenter()});$('#finalStart').onclick=()=>{state.finalWelcomeSeenBy??=[];if(!state.finalWelcomeSeenBy.includes(me().id))state.finalWelcomeSeenBy.push(me().id);save();closeModal();setTimeout(()=>{if(!state.settings.push)enablePushNotifications(true)},500);toast('Willkommen bei 4W1F 💜')}})};

applyLaunchContext=function(){const q=new URLSearchParams(location.search);const p=q.get('page');if(['home','events','members','gallery','admin','profile','live','announcements'].includes(p))page=p};
previewUrlFor=function(uid,pageName='home'){const u=new URL(cleanBaseUrl());if(pageName!=='home')u.searchParams.set('page',pageName);return u.toString()};
openPreviewProfileSwitch=function(){toast('Produktivsystem: Profile werden nicht simuliert')};

memberRows=function(adminMode=false,q=''){return state.users.filter(u=>(adminMode||u._active!==false)&&(!q||`${u.name} ${u.car} ${u.ig} ${(u.labels||[]).join(' ')}`.toLowerCase().includes(q))).map(u=>`<div class="card member-row clickable" ${adminMode?`data-admin-member="${u.id}"`:`data-member-detail="${u.id}"`}><div class="avatar">${u.emoji||'🚗'}</div><div class="member-info"><b>${esc(u.name)} ${u.role==='owner'?'♛':''}</b><span>${esc(u.ig||'')} · ${esc(u.car||'')}</span>${u.bio?`<div class="member-bio">${esc(u.bio)}</div>`:''}<div class="member-tags">${(u.labels||[]).map(l=>`<span class="label function">${esc(l)}</span>`).join('')}${u._active===false?'<span class="label" style="border-color:#ff4d5e;color:#ff7c89">GESPERRT</span>':''}</div></div><div class="member-right"><span class="label ${u.role}">${roleLabel(u.role)}</span>${u.role==='owner'?'<span class="tiny muted">🔒 geschützt</span>':''}</div></div>`).join('')};
countVehicles=function(){return state.users.filter(u=>u._active!==false&&u.car).length};
recentMembers=function(){return [...state.users].filter(u=>u._active!==false).sort((a,b)=>String(b.joinedAt||'').localeCompare(String(a.joinedAt||''))).slice(0,4)};
window.bootstrapProduction=async function(){
  initLaunchScreen?.();initVisualFX();initUpdates();setLaunchStatus?.('Sichere Verbindung…');
  sb.auth.onAuthStateChange((event,session)=>{prodSession=session;if(event==='PASSWORD_RECOVERY')setTimeout(showPasswordReset,0);if(event==='SIGNED_OUT')setTimeout(()=>showAuthGate('login'),0)});
  try{const {data:{session}}=await sb.auth.getSession();prodSession=session;if(!session){setLaunchStatus?.('Login wird geöffnet…');return showAuthGate(new URLSearchParams(location.search).has('invite')?'signup':'login')}await bootstrapAuthenticated()}catch(e){productionError(e,'Start');showAuthGate('login','Die Serververbindung konnte nicht aufgebaut werden.','bad')}
};


/* ===== 4W1F 3.1 final release overrides ===== */
function annIsVisible(a){
  if((a.hiddenBy||[]).includes(me().id)) return false;
  if(a._displayUntil && new Date(a._displayUntil).getTime() < Date.now()) return false;
  return true;
}
function annPriority(a){return ['urgent','important','normal'].includes(a.priority)?a.priority:'normal'}
function annPriorityLabel(a){return annPriority(a)==='urgent'?'DRINGEND':annPriority(a)==='important'?'WICHTIG':'NORMAL'}
function formatUntil(iso){if(!iso)return'ohne Ablauf';try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(iso))}catch{return''}}

const _renderHome31=renderHome;
renderHome=function(){
  _renderHome31();
  const view=$('#view'); if(!view)return;
  // Crew DNA only on first onboarding. Afterwards it lives in profile.
  if((state.finalWelcomeSeenBy||[]).includes(me().id)||(state.welcomeSeenBy||[]).includes(me().id)) $('#crewWelcome')?.remove();

  // no fake events
  const upcoming=(state.events||[]).filter(e=>e.past!==true);
  if(!upcoming.length){
    const hero=$('#homeEvent');
    if(hero) hero.outerHTML=`<div class="card empty-state"><div class="empty-icon">◇</div><b>Noch kein nächstes Event</b><span>Sobald ein Treffen veröffentlicht wird, erscheint es hier.</span>${isAdmin()?'<button class="btn primary empty-admin-action" id="homeCreateEvent">＋ Event erstellen</button>':''}</div>`;
    $('#teaser')?.closest('.section')?.remove();
    $('#homeCreateEvent')?.addEventListener('click',openEventEditor);
  } else if(upcoming.length<2){
    $('#teaser')?.closest('.section')?.remove();
  }

  // dedicated announcement stack before event hero
  $('#annHome')?.remove();
  const visible=(state.announcements||[]).filter(annIsVisible).sort((a,b)=>{
    if(!!a._pinned!==!!b._pinned)return a._pinned?-1:1;
    const rank={urgent:3,important:2,normal:1};return (rank[annPriority(b)]||0)-(rank[annPriority(a)]||0);
  }).slice(0,3);
  if(visible.length){
    const stack=document.createElement('div');stack.className='section home-ann-stack';stack.id='homeAnnouncements';
    stack.innerHTML=visible.map(a=>`<div class="home-ann ${annPriority(a)}" data-home-ann="${a.id}">
      <div class="home-ann-top"><span class="priority-pill">${a._pinned?'📌 ':''}${annPriorityLabel(a)}</span><span class="home-ann-meta">${a._displayUntil?'bis '+formatUntil(a._displayUntil):''}</span></div>
      <h3>${esc(a.title)}</h3><p>${esc(a.body)}</p>
    </div>`).join('');
    const first=view.firstElementChild;view.insertBefore(stack,first);
    $$('[data-home-ann]').forEach(x=>x.onclick=()=>openAnnouncementDetail(x.dataset.homeAnn));
  }

  // smarter newcomer block: only 14 days
  const newSection=[...view.querySelectorAll('.section')].find(s=>s.querySelector('.sectionhead h2')?.textContent.trim()==='Neu dabei');
  const recent=(state.users||[]).filter(u=>u._active!==false&&u.joinedAt&&Date.now()-new Date(u.joinedAt+'T12:00:00').getTime()<=14*86400000);
  if(newSection&&!recent.length)newSection.remove();
};

const _renderEvents31=renderEvents;
renderEvents=function(){
  _renderEvents31();
  const empty=$('#view .empty-state');
  if(empty&&isAdmin()&&!empty.querySelector('#emptyCreateEvent')){
    const b=document.createElement('button');b.id='emptyCreateEvent';b.className='btn primary empty-admin-action';b.textContent='+ Event erstellen';b.onclick=openEventEditor;empty.appendChild(b);
  }
};

openAnnouncementEditor=function(){
  let opts=['Dabei','Vielleicht','Nein'],pin={lat:null,lng:null};
  openModal('Ankündigung erstellen',`
    <div class="field"><label>Titel</label><input id="annTitle" placeholder="z. B. Treffen heute"></div>
    <div class="field"><label>Nachricht</label><textarea id="annBody"></textarea></div>
    <div class="field2"><div class="field"><label>Priorität</label><select id="annPriority"><option value="normal">Normal · Grün</option><option value="important">Wichtig · Gelb</option><option value="urgent">Dringend · Rot</option></select></div><div class="field"><label>Sichtbar für</label><select id="annDuration"><option value="1">1 Tag</option><option value="3" selected>3 Tage</option><option value="7">7 Tage</option><option value="14">14 Tage</option><option value="0">Kein Ablauf</option></select></div></div>
    <div class="field2"><div class="field"><label>Termin-Datum (optional)</label><input id="annDate" type="date"></div><div class="field"><label>Uhrzeit</label><input id="annTime" type="time"></div></div>
    <div class="field"><label>Ort</label><input id="annPlace" placeholder="Treffpunkt"></div><div id="annMap" class="map" style="height:220px"></div>
    <div class="field"><label>Antwortmöglichkeiten</label><div class="chips" id="optList"></div><div class="field2"><input id="optInput" placeholder="Eigene Antwort"><button class="btn outline" id="addOpt">＋ Hinzufügen</button></div></div>
    <div class="switchrow"><span>Oben anheften</span><button class="switch" id="pinSwitch"></button></div>
    <div class="switchrow"><span>Bestätigung erforderlich</span><button class="switch" id="confirmSwitch"></button></div>
    <div class="switchrow"><span>Push senden</span><button class="switch on" id="pushSwitch"></button></div>
    <button class="btn primary wide" id="saveAnn">Veröffentlichen</button>`,
  ()=>{let confirm=false,push=true,pinned=false;modalMap=L.map('annMap').setView([49.48,8.53],11);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(modalMap);let marker=null;
    const setPin=(lat,lng)=>{pin={lat,lng};if(marker)marker.setLatLng([lat,lng]);else marker=L.marker([lat,lng],{draggable:true}).addTo(modalMap)};
    modalMap.on('click',e=>setPin(e.latlng.lat,e.latlng.lng));
    const ro=()=>{$('#optList').innerHTML=opts.map((o,i)=>`<button class="chip active" data-delopt="${i}">${esc(o)} ×</button>`).join('');$$('[data-delopt]').forEach(b=>b.onclick=()=>{opts.splice(+b.dataset.delopt,1);ro()})};ro();
    $('#addOpt').onclick=()=>{const v=$('#optInput').value.trim();if(v&&!opts.includes(v))opts.push(v);$('#optInput').value='';ro()};
    $('#pinSwitch').onclick=()=>{$('#pinSwitch').classList.toggle('on');pinned=!pinned};
    $('#confirmSwitch').onclick=()=>{$('#confirmSwitch').classList.toggle('on');confirm=!confirm};
    $('#pushSwitch').onclick=()=>{$('#pushSwitch').classList.toggle('on');push=!push};
    $('#saveAnn').onclick=()=>{const title=$('#annTitle').value.trim(),body=$('#annBody').value.trim();if(!title||!body)return toast('Titel und Nachricht fehlen');
      const days=Number($('#annDuration').value||0),responses={};opts.forEach(o=>responses[o]=[]);
      state.announcements.unshift({id:crypto.randomUUID(),title,body,priority:$('#annPriority').value,_startsAt:makeLocalIso($('#annDate').value,$('#annTime').value),_displayUntil:days?new Date(Date.now()+days*86400000).toISOString():null,_pinned:pinned,_pushEnabled:push,_isNew:true,created:'Gerade eben',date:$('#annDate').value,time:$('#annTime').value,place:$('#annPlace').value.trim(),lat:pin.lat,lng:pin.lng,responseOptions:opts,responses,readBy:[me().id],confirmedBy:confirm?[me().id]:[],confirmRequired:confirm,hiddenBy:[],arrivals:{}});
      state.audit.unshift(`${me().name} veröffentlichte ${title}`);save();closeModal();toast(push?'Ankündigung veröffentlicht · Push wird versendet':'Ankündigung veröffentlicht');
    };
  });
};

// vehicle/profile editor
openProfileEditor=function(){
  const u=me(),v=u._vehicle||{make:'',model:u.car||'',year:null,power_ps:null,description:'',mods:[]};
  openModal('Profil & Fahrzeug bearbeiten',`
    <div class="field"><label>Name</label><input id="profName" value="${esc(u.name)}"></div>
    <div class="field"><label>Instagram / Handle</label><input id="profIg" value="${esc(u.ig||'')}"></div>
    <div class="field"><label>Über mich</label><textarea id="profBio">${esc(u.bio||'')}</textarea></div>
    <div class="section"><div class="sectionhead"><h2>Mein Fahrzeug</h2></div><div class="vehicle-editor-grid">
      <div class="field"><label>Marke</label><input id="vehMake" value="${esc(v.make||'')}"></div>
      <div class="field"><label>Modell</label><input id="vehModel" value="${esc(v.model||'')}"></div>
      <div class="field"><label>Baujahr</label><input id="vehYear" type="number" min="1900" max="2100" value="${v.year||''}"></div>
      <div class="field"><label>Leistung (PS)</label><input id="vehPower" type="number" min="0" max="3000" value="${v.power_ps||''}"></div>
      <div class="field full"><label>Umbauten · durch Komma trennen</label><input id="vehMods" value="${esc((v.mods||[]).join(', '))}"></div>
      <div class="field full"><label>Beschreibung</label><textarea id="vehDesc">${esc(v.description||'')}</textarea></div>
    </div></div>
    <button class="btn primary wide" id="saveProfile">Speichern</button>`,
    ()=>$('#saveProfile').onclick=()=>{u.name=$('#profName').value.trim()||u.name;u.ig=$('#profIg').value.trim();u.bio=$('#profBio').value.trim();u._vehicle={...v,make:$('#vehMake').value.trim(),model:$('#vehModel').value.trim(),year:+$('#vehYear').value||null,power_ps:+$('#vehPower').value||null,mods:$('#vehMods').value.split(',').map(x=>x.trim()).filter(Boolean),description:$('#vehDesc').value.trim()};u.car=[u._vehicle.make,u._vehicle.model].filter(Boolean).join(' ')||u._vehicle.model||'';save();closeModal();render();toast('Profil & Fahrzeug gespeichert')});
};

// safer image uploads by decoding and re-encoding to WebP before storage
async function sanitizeImageFile(file){
  const bitmap=await createImageBitmap(file);
  const max=4096,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  const blob=await new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('Bild konnte nicht verarbeitet werden')),'image/webp',.92));
  return blob;
}
handlePhotos=async function(files){
  const arr=[...files].slice(0,8).filter(f=>/^image\/(jpeg|png|webp)$/i.test(f.type)&&f.size<=12*1024*1024);if(!arr.length)return toast('JPEG, PNG oder WebP bis 12 MB');
  const events=state.events.slice(0,20);openModal('Fotos hochladen',`<div class="field"><label>Bereich</label><select id="uploadKind"><option value="crew">Crew</option><option value="vehicle">Fahrzeug</option><option value="event">Event</option></select></div><div class="field"><label>Event</label><select id="uploadEvent"><option value="">Kein Event</option>${events.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></div><div class="field"><label>Beschreibung</label><input id="uploadCaption" placeholder="z. B. Night Drive Mannheim"></div><div class="notice safe-upload-note">${arr.length} Bild${arr.length===1?'':'er'} · Bilder werden vor dem Upload neu codiert, Metadaten entfernt und nur als WebP gespeichert.</div><button class="btn primary wide" id="startUpload">Sicher hochladen</button>`,()=>{$('#startUpload').onclick=async()=>{const btn=$('#startUpload');const kind=$('#uploadKind').value,eventId=$('#uploadEvent').value||null;if(kind==='event'&&!eventId)return toast('Bitte ein Event auswählen');btn.disabled=true;btn.textContent='Bilder werden geprüft & verarbeitet…';const caption=$('#uploadCaption').value.trim();let ok=0;for(const f of arr){try{const safe=await sanitizeImageFile(f);if(safe.size>12*1024*1024)throw new Error('Verarbeitetes Bild ist zu groß');const path=`${prodSession.user.id}/${uuid()}.webp`;await checked(sb.storage.from('crew-media').upload(path,safe,{contentType:'image/webp',upsert:false}),'Upload');await checked(sb.from('gallery_items').insert({uploader_id:prodSession.user.id,event_id:eventId,category:kind,storage_path:path,caption:caption||f.name.replace(/\.[^.]+$/,''),approved:true,sanitized:true}),'Galerie');ok++}catch(e){productionError(e,'Foto')}}closeModal();await loadServerState();galleryView=kind==='event'?'events':kind==='vehicle'?'cars':'crew';renderGallery();toast(`${ok}/${arr.length} Fotos sicher hochgeladen`)}})};

const _renderGallery31=renderGallery;
renderGallery=function(){
  _renderGallery31();
  // media/vehicle blocks only on "Alle"; category tabs stay focused
  if(galleryView!=='all'){
    [...document.querySelectorAll('#view .section')].forEach(s=>{const h=s.querySelector('.sectionhead h2')?.textContent.trim();if(h==='Media & Crew Film'||h==='Mein Fahrzeug')s.remove()});
  }
};

// invite expiry, QR, revoke
openApplications=async function(){
  const {data:invites,error}=await sb.from('invites').select('*').eq('active',true).order('created_at',{ascending:false}).limit(50);if(error)return productionError(error,'Einladungen');
  openModal('Einladungen',`<div class="card pad"><div class="eyebrow">Invite-only</div><h3 style="margin:5px 0">Neue Crew-Konten</h3><div class="muted small">Links sind zeitlich begrenzt und können jederzeit deaktiviert werden.</div></div>
    <div class="field"><label>Rolle</label><select id="inviteRole"><option value="member">Mitglied</option>${isOwner()?'<option value="admin">Admin</option>':''}</select></div>
    <div class="field"><label>E-Mail sperren (optional)</label><input id="inviteEmail" type="email" placeholder="Nur diese Person darf den Code nutzen"></div>
    <div class="field2"><div class="field"><label>Anzahl Nutzungen</label><input id="inviteUses" type="number" min="1" max="100" value="1"></div><div class="field"><label>Gültig</label><select id="inviteDays"><option value="1">1 Tag</option><option value="7">7 Tage</option><option value="30" selected>30 Tage</option></select></div></div>
    <button class="btn primary wide" id="createInvite">Einladung erzeugen</button>
    <div class="section"><div class="sectionhead"><h2>Aktive Codes</h2></div><div class="list">${(invites||[]).map(i=>`<div class="card pad"><b>${i.role==='admin'?'ADMIN':'MITGLIED'}</b><div class="invite-code">${esc(i.code)}</div><div class="invite-meta"><span>${i.used_count}/${i.max_uses} genutzt</span>${i.email?'<span>E-Mail gebunden</span>':''}<span>bis ${i.expires_at?formatUntil(i.expires_at):'∞'}</span></div><div class="actions"><button class="btn outline sm" data-copy-invite="${i.code}">Link</button><button class="btn outline sm" data-qr-invite="${i.code}">QR</button><button class="btn primary sm" data-share-invite="${i.code}">Teilen</button><button class="btn bad sm" data-revoke-invite="${i.id}">Deaktivieren</button></div></div>`).join('')||'<div class="notice">Noch keine aktiven Einladungen.</div>'}</div></div>`,
    ()=>{$('#createInvite').onclick=async()=>{const role=$('#inviteRole').value,email=$('#inviteEmail').value.trim()||null,uses=Math.max(1,Math.min(100,+$('#inviteUses').value||1)),days=+$('#inviteDays').value||30,expires=new Date(Date.now()+days*86400000).toISOString();const {data,error}=await sb.rpc('create_invite',{p_role:role,p_labels:[],p_email:email,p_max_uses:uses,p_expires_at:expires});if(error)return toast(error.message);await copyText(inviteUrl(data),'Einladungslink kopiert');closeModal();openApplications()};
      $$('[data-copy-invite]').forEach(b=>b.onclick=()=>copyText(inviteUrl(b.dataset.copyInvite),'Einladungslink kopiert'));
      $$('[data-share-invite]').forEach(b=>b.onclick=()=>shareAppLink(inviteUrl(b.dataset.shareInvite),'4W1F Einladung'));
      $$('[data-qr-invite]').forEach(b=>b.onclick=()=>{const url=inviteUrl(b.dataset.qrInvite);openModal('QR Einladung',`<div class="qr-wrap" id="inviteQr"></div><div class="notice">QR scannen → Einladung öffnen → Crew-Konto erstellen.</div><button class="btn outline wide" id="qrCopy">Link kopieren</button>`,()=>{new QRCode(document.getElementById('inviteQr'),{text:url,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});$('#qrCopy').onclick=()=>copyText(url)})});
      $$('[data-revoke-invite]').forEach(b=>b.onclick=async()=>{if(!confirm('Einladung wirklich deaktivieren?'))return;const {error}=await sb.from('invites').update({active:false}).eq('id',b.dataset.revokeInvite);if(error)return toast(error.message);closeModal();openApplications()});
    });
};

// saved places and live automation
let liveWatchId=null,liveLastPoint=null,liveLastWrite=0;
function haversineKm(a,b,c,d){const R=6371,toRad=x=>x*Math.PI/180,dp=toRad(c-a),dl=toRad(d-b);const s=Math.sin(dp/2)**2+Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(s))}
function nearestSavedPlace(lat,lng){let best=null;for(const p of state.savedPlaces||[]){const m=haversineKm(lat,lng,p.latitude,p.longitude)*1000;if(m<=p.radius_m&&(!best||m<best.m))best={...p,m}}return best}
async function saveLiveMeta(pos){
  const now=Date.now(),lat=pos.coords.latitude,lng=pos.coords.longitude;
  let speed=Number.isFinite(pos.coords.speed)?Math.max(0,pos.coords.speed*3.6):0;
  if(liveLastPoint){const km=haversineKm(liveLastPoint.lat,liveLastPoint.lng,lat,lng),hrs=(now-liveLastPoint.t)/3600000;if(!speed&&hrs>0)speed=km/hrs}
  const place=nearestSavedPlace(lat,lng),movement=speed>5?'unterwegs':place?'am_ort':'steht';
  state.live.lat=lat;state.live.lng=lng;state.live.speedKmh=Math.round(speed*10)/10;state.live.movementState=movement;state.live.placeLabel=place?.name||'';
  if(place&&(!['Panne','Tankstopp'].includes(state.live.status)))state.live.status='Bin da';
  else if(!place&&movement==='unterwegs'&&!['Panne','Tankstopp'].includes(state.live.status))state.live.status='Bin unterwegs';
  liveLastPoint={lat,lng,t:now};
  if(now-liveLastWrite>12000){liveLastWrite=now;save()}
}
function ensureLiveWatch(){
  if(liveWatchId!=null||!state.live.share||!navigator.geolocation)return;
  liveWatchId=navigator.geolocation.watchPosition(p=>saveLiveMeta(p),()=>{}, {enableHighAccuracy:true,maximumAge:8000,timeout:20000});
}
function stopLiveWatch(){if(liveWatchId!=null&&navigator.geolocation){navigator.geolocation.clearWatch(liveWatchId);liveWatchId=null}liveLastPoint=null}
async function geocodeAddress(address){const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`);if(!r.ok)throw new Error('Adresse konnte nicht gesucht werden');const j=await r.json();if(!j.length)throw new Error('Adresse nicht gefunden');return{lat:+j[0].lat,lng:+j[0].lon,label:j[0].display_name}}
async function openSavedPlaces(){
  const {data,error}=await sb.from('saved_places').select('*').eq('user_id',prodSession.user.id).order('created_at');if(error)return toast(error.message);state.savedPlaces=data||[];
  openModal('Meine Orte',`<div class="notice">Wie bei Life360: Name + Adresse + Radius. Die genaue Adresse bleibt standardmäßig privat; Crew Live zeigt nur dein Ortslabel.</div>
  <div class="field2"><div class="field"><label>Name</label><input id="placeName" placeholder="Zuhause"></div><div class="field"><label>Radius</label><select id="placeRadius"><option value="100">100 m</option><option value="150" selected>150 m</option><option value="250">250 m</option><option value="500">500 m</option></select></div></div>
  <div class="field"><label>Adresse</label><input id="placeAddress" placeholder="Straße, Ort"></div><button class="btn primary wide" id="savePlace">Ort speichern</button>
  <div class="section"><div class="sectionhead"><h2>Gespeicherte Orte</h2></div><div class="list">${(state.savedPlaces||[]).map(p=>`<div class="card place-card"><div><b>${esc(p.name)}</b><span>${esc(p.address)} · ${p.radius_m} m</span></div><button class="btn bad sm" data-del-place="${p.id}">Löschen</button></div>`).join('')||'<div class="notice">Noch keine Orte gespeichert.</div>'}</div></div>`,
  ()=>{$('#savePlace').onclick=async()=>{const name=$('#placeName').value.trim(),addr=$('#placeAddress').value.trim();if(!name||!addr)return toast('Name und Adresse fehlen');const btn=$('#savePlace');btn.disabled=true;btn.textContent='Adresse wird gesucht…';try{const g=await geocodeAddress(addr);const {error}=await sb.from('saved_places').insert({user_id:prodSession.user.id,name,address:g.label,latitude:g.lat,longitude:g.lng,radius_m:+$('#placeRadius').value||150,share_exact:false});if(error)throw error;closeModal();await loadServerState();toast('Ort gespeichert')}catch(e){toast(e.message||'Ort konnte nicht gespeichert werden');btn.disabled=false;btn.textContent='Ort speichern'}};
    $$('[data-del-place]').forEach(b=>b.onclick=async()=>{const {error}=await sb.from('saved_places').delete().eq('id',b.dataset.delPlace);if(error)return toast(error.message);closeModal();await loadServerState();openSavedPlaces()});
  });
}
const _renderLive31=renderLive;
renderLive=function(){_renderLive31();const summary=$('#view .live-summary');if(summary&&state.live.share){const d=document.createElement('div');d.className='place-status';d.innerHTML=`<i></i><span>${state.live.placeLabel?`Ort: <b>${esc(state.live.placeLabel)}</b>`:`Bewegung: <b>${state.live.movementState==='unterwegs'?'unterwegs':'steht'}</b>`}${state.live.speedKmh?` · ${Math.round(state.live.speedKmh)} km/h`:''}</span>`;summary.querySelector('div[style*="flex:1"]')?.appendChild(d)}
  const sec=$('#refreshLive')?.closest('.section');if(sec&&!$('#managePlaces')){const b=document.createElement('button');b.className='btn outline wide';b.id='managePlaces';b.style.marginTop='8px';b.innerHTML='⌂ Orte & Automatik';b.onclick=openSavedPlaces;sec.appendChild(b)}
  $('#refreshLive')?.toggleAttribute('disabled',!state.live.share);
  if(state.live.share)ensureLiveWatch();else stopLiveWatch();
};

// profile: Crew DNA permanent location + leave crew
const _renderProfile31=renderProfile;
renderProfile=function(){_renderProfile31();const grid=$('#view .admin-grid');if(grid&&!$('#profileDnaPermanent')){const b=document.createElement('button');b.className='card admin-tool clickable';b.id='profileDnaPermanent';b.innerHTML=`${I('shield')}<div><b>Crew DNA & Regeln</b><br><span>Werte, Regeln und Onboarding</span></div>`;grid.prepend(b);b.onclick=openCrewDNA}}
const _openAccount31=openAccountCenter;
openAccountCenter=function(){_openAccount31();setTimeout(()=>{if(isOwner()||!$('#sheet .account-actions')||$('#accountLeave'))return;const b=document.createElement('button');b.className='btn bad wide';b.id='accountLeave';b.textContent='Crew verlassen';const logout=$('#accountLogout');logout?.before(b);b.onclick=async()=>{if(!confirm('Crew wirklich verlassen? Dein Zugang wird deaktiviert.'))return;if(!confirm('Letzte Bestätigung: 4W1F verlassen?'))return;const {error}=await sb.rpc('leave_crew');if(error)return toast(error.message);await sb.auth.signOut();toast('Crew-Zugang wurde deaktiviert')}} ,0)};

// accurate security wording
openSecurityCenter=function(){openModal('Sicherheit',`<div class="card pad">
<div class="security-line"><i class="security-dot"></i><div><b>Supabase Production Backend</b><div class="muted tiny">Eigenes 4W1F Projekt · getrennt von anderen Projekten</div></div></div>
<div class="security-line"><i class="security-dot"></i><div><b>Row Level Security</b><div class="muted tiny">Owner · Admin · Member werden serverseitig geprüft</div></div></div>
<div class="security-line"><i class="security-dot"></i><div><b>Owner Lock</b><div class="muted tiny">Owner kann serverseitig nicht gelöscht oder herabgestuft werden</div></div></div>
<div class="security-line"><i class="security-dot"></i><div><b>Sichere Bildpipeline</b><div class="muted tiny">Nur Bilder bis 12 MB; Browser decodiert und erzeugt neue WebP-Dateien ohne ursprüngliche Metadaten. Keine beliebigen Dateien.</div></div></div>
<div class="security-line"><i class="security-dot"></i><div><b>Private Media</b><div class="muted tiny">Galerie liegt im privaten Storage; Zugriff läuft über zeitlich begrenzte URLs.</div></div></div>
<div class="security-line"><i class="security-dot"></i><div><b>Push-Secrets</b><div class="muted tiny">Private VAPID-/Cron-Schlüssel liegen ausschließlich serverseitig.</div></div></div>
</div><div class="notice">Die Bildpipeline ist eine Sanitization-/Dateiprüfung, kein vollwertiger Antivirus für beliebige Dateien. Deshalb akzeptiert die App ausschließlich neu codierbare Bilder.</div><div class="section"><button class="btn outline wide" id="auditOpen">Audit-Log öffnen</button></div>`,()=>$('#auditOpen').onclick=()=>{closeModal();openAudit()})};

const _renderAdmin31=renderAdmin;
renderAdmin=function(){_renderAdmin31();const invite=$('#inviteAdmin');if(invite){const b=invite.querySelector('b');const s=invite.querySelector('span');if(b)b.textContent='Einladungen';if(s)s.textContent='Mitglieder & Admins sicher einladen'}};

/* ===== 4W1F 3.2 FINAL launch timeline ===== */
(function(){
  let timers=[];const phases=['phase-logo','phase-build','phase-reveal','phase-impact','phase-loading'];
  function later(ms,fn){const id=setTimeout(fn,ms);timers.push(id);return id}
  function clear(){timers.forEach(clearTimeout);timers=[]}
  function setPhase(name,status,progress){const el=launchFX.el;if(!el)return;phases.forEach(p=>el.classList.remove(p));el.classList.add(name);if(status)setLaunchStatus(status);if(progress!==undefined)advanceLaunchProgress(progress)}
  function closeIntro(text='App bereit'){if(launchFX.done||!launchFX.el)return;launchFX.done=true;clear();advanceLaunchProgress(100,text);later(260,()=>launchFX.el?.classList.add('hidden'));later(780,()=>{document.body.classList.remove('launch-active');launchFX.el?.remove()})}
  initLaunchScreen=function(){clear();launchFX.startedAt=performance.now();launchFX.done=false;launchFX.appReady=false;launchFX.visualDone=false;launchFX.finalText='App bereit';launchFX.el=$('#launchScreen');launchFX.bar=$('#launchProgressFill');launchFX.status=$('#launchStatus');if(!launchFX.el)return;document.body.classList.add('launch-active');launchFX.el.classList.remove('hidden',...phases);if(launchFX.bar)launchFX.bar.style.width='0%';requestAnimationFrame(()=>{launchFX.el.classList.add('show');setPhase('phase-logo','4W1F startet…',0)});later(420,()=>setPhase('phase-build','Cars · People · Passion · Family',0));later(980,()=>setPhase('phase-reveal','More than a crew',0));later(1660,()=>setPhase('phase-impact','4 Wheels. 1 Family.',0));later(2350,()=>setPhase('phase-loading','Sichere Verbindung…',18));later(2700,()=>advanceLaunchProgress(48,'Crew-Daten werden geladen…'));later(3050,()=>advanceLaunchProgress(78,'Fast bereit…'));later(3450,()=>{launchFX.visualDone=true;if(launchFX.appReady)closeIntro(launchFX.finalText)});later(6200,()=>closeIntro(launchFX.appReady?launchFX.finalText:'App öffnen…'))};
  finishLaunchScreen=function(text='App bereit'){launchFX.appReady=true;launchFX.finalText=text||'App bereit';if(launchFX.visualDone)closeIntro(launchFX.finalText)};
})();

/* ===== 4W1F 3.2 FINAL RELEASE MODE ===== */
(function(){
  const finalStyle=document.createElement('style');
  finalStyle.id='finalRelease320Style';
  finalStyle.textContent=`
  @media(min-width:900px){
    .app{width:min(1180px,calc(100% - 32px));max-width:none;margin:0 auto}
    .view{width:100%;max-width:1120px;margin:0 auto}
    .top{max-width:1120px;margin:0 auto}
    .bottom{left:50%;right:auto;transform:translateX(-50%);width:min(760px,calc(100% - 28px));border-radius:18px 18px 0 0}
    .sheet{width:min(720px,calc(100% - 32px))}
    .admin-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  }
  #launchScreen{background:radial-gradient(circle at 50% 15%,rgba(126,40,255,.24),transparent 30%),radial-gradient(circle at 50% 74%,rgba(185,50,255,.15),transparent 30%),linear-gradient(180deg,#020204 0%,#08050d 55%,#020204 100%)!important}
  #launchScreen:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 49.8%,rgba(183,72,255,.10) 50%,transparent 50.2%),repeating-linear-gradient(0deg,rgba(255,255,255,.018) 0 1px,transparent 1px 4px);opacity:.42;pointer-events:none}
  #launchScreen .launch-core{width:min(94vw,440px);min-height:650px;padding:46px 22px 28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0}
  #launchScreen .launch-core:before{inset:28px 12px 18px;border-color:rgba(178,64,255,.20);box-shadow:0 0 55px rgba(118,31,190,.08),inset 0 0 55px rgba(85,26,142,.05)}
  #launchScreen .launch-car{display:block!important}
  #launchScreen .launch-crown,#launchScreen .launch-logo,#launchScreen .launch-manifesto,#launchScreen .launch-progress,#launchScreen .launch-status{position:relative;z-index:8;opacity:0;transition:opacity .46s ease,transform .58s cubic-bezier(.16,.86,.22,1)}
  #launchScreen .launch-crown{transform:translateY(14px) scale(.72)}
  #launchScreen .launch-logo{transform:translateY(14px) scale(.95)}
  #launchScreen .launch-logo span,#launchScreen .launch-logo b{font-size:38px}
  #launchScreen .launch-logo small{margin-top:12px}
  #launchScreen .launch-manifesto{transform:translateY(9px);margin-top:10px}
  #launchScreen .launch-progress,#launchScreen .launch-status{transform:translateY(8px)}
  .premium-car-stage{position:relative;z-index:6;width:min(84vw,350px);height:220px;margin:-1px auto 2px;opacity:0;transform:translateY(30px) scale(.9);transition:opacity .55s ease,transform .72s cubic-bezier(.16,.9,.2,1);filter:drop-shadow(0 22px 34px rgba(0,0,0,.58))}
  .premium-car-stage:before{content:"";position:absolute;left:50%;bottom:9px;width:74%;height:28px;transform:translateX(-50%);border-radius:50%;background:rgba(174,64,255,.25);filter:blur(18px);opacity:.6;transition:.45s}
  .premium-car-stage:after{content:"";position:absolute;left:50%;bottom:4px;width:95%;height:2px;transform:translateX(-50%);background:linear-gradient(90deg,transparent,#8e30ff,#ef4ee2,#8e30ff,transparent);filter:blur(1px);opacity:.28}
  .premium-car-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center;opacity:0;transform:scale(.97);transition:opacity .5s ease,transform .72s cubic-bezier(.16,.88,.22,1);-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 8%,#000 85%,transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 8%,#000 85%,transparent 100%)}
  .premium-flare{position:absolute;left:50%;top:54%;width:0;height:2px;transform:translate(-50%,-50%);background:#f5c7ff;box-shadow:0 0 14px #d755ff,0 0 36px #942dff;opacity:0;z-index:9}
  .premium-ray{position:absolute;inset:-70px -90px;background:repeating-conic-gradient(from 0deg,rgba(175,62,255,.23) 0 1deg,transparent 1deg 8deg);opacity:0;transform:scale(.4) rotate(-12deg);z-index:-1;filter:blur(.4px)}
  #launchScreen.p-logo .launch-logo{opacity:1;transform:none}
  #launchScreen.p-build .launch-logo,#launchScreen.p-build .launch-manifesto{opacity:1;transform:none}
  #launchScreen.p-build .premium-car-stage{opacity:1;transform:translateY(8px) scale(.96)}
  #launchScreen.p-build .car-build{opacity:.92;transform:scale(1)}
  #launchScreen.p-reveal .launch-logo,#launchScreen.p-reveal .launch-manifesto,#launchScreen.p-reveal .launch-crown{opacity:1;transform:none}
  #launchScreen.p-reveal .premium-car-stage{opacity:1;transform:none}
  #launchScreen.p-reveal .car-reveal{opacity:1;transform:scale(1)}
  #launchScreen.p-impact .launch-logo,#launchScreen.p-impact .launch-manifesto,#launchScreen.p-impact .launch-crown{opacity:1;transform:none}
  #launchScreen.p-impact .premium-car-stage{opacity:1;transform:scale(1.055)}
  #launchScreen.p-impact .car-impact{opacity:1;transform:scale(1.03)}
  #launchScreen.p-impact .premium-ray{animation:premiumFinalRay .72s cubic-bezier(.1,.8,.2,1) both}
  #launchScreen.p-impact .premium-flare{animation:premiumFinalFlare .66s ease-out both}
  #launchScreen.p-impact .premium-car-stage:before{opacity:1;transform:translateX(-50%) scale(1.18)}
  #launchScreen.p-loading .launch-logo,#launchScreen.p-loading .launch-manifesto,#launchScreen.p-loading .launch-crown,#launchScreen.p-loading .launch-progress,#launchScreen.p-loading .launch-status{opacity:1;transform:none}
  #launchScreen.p-loading .premium-car-stage{opacity:.22;transform:translateY(10px) scale(.94);filter:blur(.2px) brightness(.75)}
  #launchScreen.p-loading .car-impact{opacity:.68}
  #launchScreen.p-loading .launch-progress{margin-top:-2px}
  @keyframes premiumFinalRay{0%{opacity:0;transform:scale(.35) rotate(-12deg)}28%{opacity:.88}100%{opacity:0;transform:scale(1.12) rotate(8deg)}}
  @keyframes premiumFinalFlare{0%{opacity:0;width:0}35%{opacity:1;width:86%}100%{opacity:0;width:108%}}
  @media(max-height:760px){#launchScreen .launch-core{min-height:590px;padding-top:30px}.premium-car-stage{height:188px}.launch-logo span,.launch-logo b{font-size:33px!important}}
  @media(prefers-reduced-motion:reduce){.premium-car-img,.premium-car-stage,#launchScreen .launch-logo,#launchScreen .launch-crown{transition-duration:.12s!important}.premium-ray,.premium-flare{display:none!important}}
  .profile-media-release{display:grid;grid-template-columns:132px 1fr;gap:13px;align-items:center;padding:14px;margin-bottom:12px}
  .profile-media-release .profile-photo{width:132px;height:132px;border-radius:22px;overflow:hidden;background:linear-gradient(145deg,rgba(153,48,255,.25),#08080d);border:1px solid rgba(180,75,255,.30);display:grid;place-items:center;font-size:45px;box-shadow:0 0 30px rgba(151,50,255,.09)}
  .profile-media-release img{width:100%;height:100%;object-fit:cover;display:block}
  .profile-media-release .media-actions{display:grid;gap:7px}
  .vehicle-release-photo{width:100%;height:180px;border-radius:14px;overflow:hidden;background:#07070a;border:1px solid var(--line);margin-top:10px;display:grid;place-items:center;color:var(--muted)}
  .vehicle-release-photo img{width:100%;height:100%;object-fit:cover}
  @media(max-width:480px){.profile-media-release{grid-template-columns:96px 1fr}.profile-media-release .profile-photo{width:96px;height:96px;border-radius:18px}.vehicle-release-photo{height:155px}}
  `;
  document.head.appendChild(finalStyle);

  let launchTimers=[];
  function clearFinalLaunch(){launchTimers.forEach(clearTimeout);launchTimers=[]}
  function ensurePremiumCarStage(){
    /* Final 3.2.2: use the integrated SVG car from index.html; no bitmap-in-a-box overlay. */
  }
  function setFinalPhase(name,status,progress){
    const el=launchFX.el;if(!el)return;
    ['p-logo','p-build','p-reveal','p-impact','p-loading','phase-reveal','phase-impact','phase-loading'].forEach(x=>el.classList.remove(x));
    el.classList.add(name);
    if(name==='p-reveal')el.classList.add('phase-reveal');
    if(name==='p-impact')el.classList.add('phase-impact');
    if(name==='p-loading')el.classList.add('phase-loading');
    if(status)setLaunchStatus(status);if(progress!=null)advanceLaunchProgress(progress);
  }
  function actuallyCloseLaunch(text='App bereit'){
    if(launchFX.done||!launchFX.el)return;
    launchFX.done=true;clearFinalLaunch();advanceLaunchProgress(100,text);
    launchTimers.push(setTimeout(()=>{launchFX.el?.classList.add('hidden');document.body.classList.remove('launch-active')},360));
    launchTimers.push(setTimeout(()=>launchFX.el?.remove(),1100));
  }
  initLaunchScreen=function(){
    clearFinalLaunch();
    launchFX.startedAt=performance.now();launchFX.done=false;launchFX.appReady=false;launchFX.visualDone=false;launchFX.finalText='App bereit';
    launchFX.el=$('#launchScreen');launchFX.bar=$('#launchProgressFill');launchFX.status=$('#launchStatus');
    if(!launchFX.el)return;
    ensurePremiumCarStage();document.body.classList.add('launch-active');
    launchFX.el.classList.remove('hidden','p-logo','p-build','p-reveal','p-impact','p-loading');
    if(launchFX.bar)launchFX.bar.style.width='0%';
    requestAnimationFrame(()=>{launchFX.el.classList.add('show');setFinalPhase('p-logo','4W1F startet…',0)});
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const k=reduced ? .42 : 1;
    launchTimers.push(setTimeout(()=>setFinalPhase('p-build','Cars · People · Passion · Family',0),Math.round(650*k)));
    launchTimers.push(setTimeout(()=>setFinalPhase('p-reveal','More than a crew',0),Math.round(1450*k)));
    launchTimers.push(setTimeout(()=>setFinalPhase('p-impact','4 Wheels. 1 Family.',0),Math.round(2250*k)));
    launchTimers.push(setTimeout(()=>setFinalPhase('p-loading','Sichere Verbindung…',20),Math.round(3000*k)));
    launchTimers.push(setTimeout(()=>advanceLaunchProgress(58,'Crew wird synchronisiert…'),Math.round(3380*k)));
    launchTimers.push(setTimeout(()=>advanceLaunchProgress(86,'Fast bereit…'),Math.round(3720*k)));
    launchTimers.push(setTimeout(()=>{launchFX.visualDone=true;if(launchFX.appReady)actuallyCloseLaunch(launchFX.finalText)},Math.round(4050*k)));
    launchTimers.push(setTimeout(()=>actuallyCloseLaunch(launchFX.appReady?launchFX.finalText:'App bereit'),7000));
  };
  finishLaunchScreen=function(text='App bereit'){launchFX.appReady=true;launchFX.finalText=text||'App bereit';if(launchFX.visualDone)actuallyCloseLaunch(launchFX.finalText)};

  async function mediaUrl(bucket,path){
    if(!path)return null;
    try{const {data,error}=await sb.storage.from(bucket).createSignedUrl(path,3600);if(error)throw error;return data?.signedUrl||null}catch{return null}
  }
  async function uploadProfileMedia(kind,file){
    if(!file||!/^image\/(jpeg|png|webp)$/i.test(file.type)||file.size>12*1024*1024)return toast('JPEG, PNG oder WebP bis 12 MB');
    try{
      toast('Bild wird sicher verarbeitet…');
      const safe=await sanitizeImageFile(file),uid=prodSession.user.id;
      if(kind==='avatar'){
        const path=`${uid}/avatar.webp`;
        await checked(sb.storage.from('avatars').upload(path,safe,{contentType:'image/webp',upsert:true}),'Profilbild');
        await checked(sb.from('profiles').update({avatar_path:path}).eq('id',uid),'Profilbild');
      }else{
        const path=`${uid}/vehicle-profile.webp`;
        await checked(sb.storage.from('crew-media').upload(path,safe,{contentType:'image/webp',upsert:true}),'Fahrzeugbild');
        await checked(sb.from('vehicles').upsert({user_id:uid,photo_path:path},{onConflict:'user_id'}),'Fahrzeugbild');
      }
      await loadServerState();renderProfile();toast(kind==='avatar'?'Profilbild gespeichert':'Fahrzeugbild gespeichert');
    }catch(e){productionError(e,'Bild');toast('Bild konnte nicht gespeichert werden')}
  }
  async function decorateProfileMedia(){
    if(page!=='profile'||!prodSession)return;
    const view=$('#view');if(!view||$('#profileMediaRelease'))return;
    const u=me(),v=u._vehicle||{};
    const wrap=document.createElement('section');wrap.className='card profile-media-release';wrap.id='profileMediaRelease';
    wrap.innerHTML=`<div class="profile-photo" id="releaseAvatar">${u.emoji||'🚗'}</div><div class="media-actions"><b>${esc(u.name)}</b><span class="muted tiny">${roleLabel(u.role)} · ${esc(u.car||'Noch kein Fahrzeug')}</span><button class="btn outline sm" id="changeAvatar">Profilbild ändern</button><button class="btn outline sm" id="changeVehiclePhoto">Fahrzeugbild ändern</button><input hidden type="file" accept="image/jpeg,image/png,image/webp" id="avatarFile"><input hidden type="file" accept="image/jpeg,image/png,image/webp" id="vehicleFile"></div>`;
    const title=view.querySelector('.page-title');if(title)title.insertAdjacentElement('afterend',wrap);else view.prepend(wrap);
    $('#changeAvatar').onclick=()=>$('#avatarFile').click();$('#changeVehiclePhoto').onclick=()=>$('#vehicleFile').click();
    $('#avatarFile').onchange=e=>uploadProfileMedia('avatar',e.target.files?.[0]);$('#vehicleFile').onchange=e=>uploadProfileMedia('vehicle',e.target.files?.[0]);
    const au=await mediaUrl('avatars',u._avatarPath);if(au&&$('#releaseAvatar'))$('#releaseAvatar').innerHTML=`<img src="${au}" alt="">`;
    if(v.photo_path){
      const cards=[...view.querySelectorAll('.card')];const vehicleCard=cards.find(x=>x.textContent.includes(u.car||'__never__'));
      if(vehicleCard&&!$('#releaseVehiclePhoto')){const vp=document.createElement('div');vp.className='vehicle-release-photo';vp.id='releaseVehiclePhoto';vp.textContent='Fahrzeugbild wird geladen…';vehicleCard.appendChild(vp);const vu=await mediaUrl('crew-media',v.photo_path);if(vu&&$('#releaseVehiclePhoto'))$('#releaseVehiclePhoto').innerHTML=`<img src="${vu}" alt="">`;}
    }
  }
  const previousProfile=renderProfile;
  renderProfile=function(){previousProfile();setTimeout(decorateProfileMedia,0)};
  const previousAccount=openAccountCenter;
  openAccountCenter=function(){previousAccount();setTimeout(()=>$('#accountSwitch')?.remove(),0)};
})();

/* 3.2.1 iOS-safe launch asset polish */
(function(){
  const s=document.createElement('style');
  s.textContent=`
  .premium-car-img{image-rendering:auto!important;-webkit-transform:translateZ(0);backface-visibility:hidden}
  #launchScreen.p-build .car-build{filter:brightness(.34) saturate(.65) contrast(1.08);opacity:.48!important}
  #launchScreen.p-reveal .car-reveal{filter:brightness(.78) saturate(.92) contrast(1.08);opacity:.92!important}
  #launchScreen.p-impact .car-impact{filter:brightness(1.08) saturate(1.14) contrast(1.09) drop-shadow(0 0 20px rgba(183,69,255,.38));opacity:1!important}
  `;
  document.head.appendChild(s);
})();
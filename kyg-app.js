"use strict";

const cfg = window.APP_CONFIG || {};
const EXPECTED_PROJECT = "mzxgpdwjklvoqsjclrtz";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = {
  client: null,
  session: null,
  workspace: null,
  areas: [],
  goals: [],
  milestones: [],
  actions: [],
  ideas: [],
  selectedGoalId: null,
  calendarMode: "week",
  calendarCursor: null,
  selectedCalendarDate: null,
  view: "now",
  signup: false,
  busy: false,
  bootstrapTask: null
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[character]
  ));
}
function shortDate(value) {
  if (!value) return "";
  const [y,m,d] = String(value).slice(0,10).split("-");
  return y && m && d ? [d,m,y].join("/") : "";
}
function todayLocal() {
  const d = new Date();
  const p = v => String(v).padStart(2,"0");
  return [d.getFullYear(),p(d.getMonth()+1),p(d.getDate())].join("-");
}
function plusMonths(input, count) {
  if (!input) return todayLocal();
  const [year,month,day] = input.split("-").map(Number);
  const targetMonth = month - 1 + Number(count);
  const y = year + Math.floor(targetMonth / 12);
  const m = ((targetMonth % 12) + 12) % 12 + 1;
  const end = new Date(Date.UTC(y,m,0)).getUTCDate();
  return [y,String(m).padStart(2,"0"),String(Math.min(day,end)).padStart(2,"0")].join("-");
}

function dateAtUTC(iso) {
  const [year,month,day] = String(iso).slice(0,10).split("-").map(Number);
  return new Date(Date.UTC(year,month-1,day,12));
}
function addDaysISO(iso, delta) {
  const day = dateAtUTC(iso);
  day.setUTCDate(day.getUTCDate()+delta);
  return day.toISOString().slice(0,10);
}
function mondayISO(iso) {
  const offset = (dateAtUTC(iso).getUTCDay()+6)%7;
  return addDaysISO(iso,-offset);
}
function calendarDates(mode, cursor) {
  const anchor=cursor||todayLocal();
  const first = mode==="month" ? mondayISO(anchor.slice(0,7)+"-01") : mondayISO(anchor);
  const count = mode==="month" ? 42 : 7;
  return Array.from({length:count},(_,i)=>addDaysISO(first,i));
}
function calendarPeriodLabel(mode,cursor) {
  const anchor=cursor||todayLocal();
  const format=(date,options)=>dateAtUTC(date).toLocaleDateString("fr-FR",{...options,timeZone:"UTC"});
  if(mode==="month") return format(anchor,{month:"long",year:"numeric"});
  const dates=calendarDates("week",anchor);
  const first=dates[0],last=dates[6];
  if(first.slice(0,7)===last.slice(0,7))
    return shortDate(first).slice(0,2)+" – "+format(last,{day:"numeric",month:"long",year:"numeric"});
  return format(first,{day:"numeric",month:"short",year:"numeric"})+" – "+format(last,{day:"numeric",month:"short",year:"numeric"});
}
function actionCalendarDay(action) {
  // Explicit planned day takes precedence; due_date is a fallback for unscheduled tasks.
  return action.planned_for || action.due_date || null;
}
function actionsOnCalendarDay(day) {
  return state.actions.filter(a=>actionCalendarDay(a)===day && a.status!=="discarded")
    .sort((a,b)=>Number(a.status==="done")-Number(b.status==="done") ||
      (a.due_date||"9999-12-31").localeCompare(b.due_date||"9999-12-31") ||
      (a.created_at||"").localeCompare(b.created_at||""));
}
function areaTrail(areaId) {
  const parts=[],seen=new Set();
  let current=state.areas.find(a=>a.id===areaId);
  while(current && !seen.has(current.id)) {
    parts.push(current.name);
    seen.add(current.id);
    current=state.areas.find(a=>a.id===current.parent_id);
  }
  return parts.reverse();
}
function actionTrail(action) {
  const goal=state.goals.find(g=>g.id===action.goal_id);
  if(!goal)return "Tâche indépendante";
  const milestone=state.milestones.find(m=>m.id===action.milestone_id && m.goal_id===goal.id);
  return [...areaTrail(goal.area_id),goal.title,...(milestone?[milestone.title]:[])].join(" › ");
}
function milestonesForGoal(goalId) {
  return state.milestones.filter(m=>m.goal_id===goalId && m.status!=="cancelled")
    .sort((a,b)=>a.horizon_months-b.horizon_months);
}
function renderCalendar() {
  const mode=state.calendarMode;
  const cursor=state.calendarCursor||todayLocal();
  const selected=state.selectedCalendarDate||todayLocal();
  const days=calendarDates(mode,cursor);
  const today=todayLocal();
  $("#calendar-period-label").textContent=calendarPeriodLabel(mode,cursor);
  $("#calendar-weekdays").innerHTML=["Lun.","Mar.","Mer.","Jeu.","Ven.","Sam.","Dim."]
    .map(day=>'<span>'+day+'</span>').join("");
  $$("[data-calendar-mode]").forEach(b=>{
    const active=b.dataset.calendarMode===mode;
    b.classList.toggle("active",active);
    b.setAttribute("aria-pressed",String(active));
  });
  $("#calendar-grid").classList.toggle("month-view",mode==="month");
  $("#calendar-grid").classList.toggle("week-view",mode==="week");
  const monthPrefix=cursor.slice(0,7);
  $("#calendar-grid").innerHTML=days.map(day=>{
    const tasks=actionsOnCalendarDay(day);
    const otherMonth=mode==="month" && !day.startsWith(monthPrefix);
    const classes=["calendar-day",day===selected?"selected":"",day===today?"today":"",otherMonth?"outside-month":""].filter(Boolean).join(" ");
    const dayLabel=dateAtUTC(day).toLocaleDateString("fr-FR",{timeZone:"UTC",day:"numeric"});
    const visible=tasks.slice(0,mode==="week"?4:2);
    return '<div class="'+classes+'" data-date="'+day+'">'+
      '<button type="button" class="calendar-day-heading" data-calendar-day="'+day+'" aria-label="Sélectionner le '+day+'"><span>'+dayLabel+'</span><span class="calendar-day-count">'+(tasks.length?tasks.length:"")+'</span></button>'+
      '<div class="calendar-task-chips">'+visible.map(a=>'<button type="button" class="calendar-chip'+(a.status==="done"?" done":"")+'" data-edit-action="'+esc(a.id)+'" title="'+esc(actionTrail(a))+'">'+esc(a.title)+'</button>').join("")+
      (tasks.length>visible.length?'<button type="button" class="calendar-more" data-calendar-day="'+day+'">+'+(tasks.length-visible.length)+' autres</button>':"")+
      '</div></div>';
  }).join("");
  $("#calendar-selected-label").textContent=dateAtUTC(selected).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"});
  const items=actionsOnCalendarDay(selected);
  $("#calendar-selected-actions").innerHTML=items.length?items.map(a=>actionRow(a)).join(""):
    '<p class="empty-state">Aucune tâche prévue pour ce jour. Vous pouvez en ajouter une sans la lier à un objectif.</p>';
  const undated=state.actions.filter(a=>!actionCalendarDay(a) && a.status!=="discarded");
  $("#calendar-undated-count").textContent=undated.length?"("+undated.length+")":"";
  $("#calendar-undated-actions").innerHTML=undated.length?undated.map(a=>actionRow(a)).join(""):
    '<p class="muted">Aucune tâche sans date.</p>';
}
function selectCalendarDay(day) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return;
  state.selectedCalendarDate=day;
  state.calendarCursor=day;
  renderCalendar();
}
function navigateCalendar(direction) {
  const cursor=state.calendarCursor||todayLocal();
  const day=state.calendarMode==="month"
    ? plusMonths(cursor.slice(0,7)+"-01",direction)
    : addDaysISO(cursor,direction*7);
  selectCalendarDay(day);
}

function toast(message, error = false) {
  const region = $("#notifications");
  const el = document.createElement("div");
  el.className = "notification" + (error ? " error" : "");
  el.textContent = String(message);
  region.append(el);
  setTimeout(() => el.remove(), 6000);
}
function niceError(error) {
  const text = String(error?.message || error || "Erreur inconnue");
  if (/failed to fetch|networkerror|network request failed|fetch failed|load failed/i.test(text))
    return "Impossible de joindre Supabase. Vérifiez votre connexion, puis réessayez. Si le problème persiste, vérifiez que le domaine Supabase n'est pas bloqué.";
  if (/invalid login credentials/i.test(text)) return "Adresse e-mail ou mot de passe incorrect.";
  if (/email not confirmed/i.test(text)) return "Confirmez votre adresse e-mail depuis le message de Supabase.";
  if (/user already registered/i.test(text)) return "Un compte existe déjà avec cette adresse.";
  if (/duplicate key.*kyg_milestones_goal_horizon_unique/i.test(text)) return "Un jalon existe déjà pour cet horizon.";
  if (/row-level security|permission denied/i.test(text)) return "Vous n'avez pas accès à ces données avec ce compte.";
  return text;
}
function showAuth(message = "", success = false) {
  $("#auth-screen").classList.remove("hidden");
  $("#main-app").classList.add("hidden");
  const msg = $("#auth-message");
  msg.textContent = message;
  msg.classList.toggle("success",success);
}
function showApp() {
  $("#auth-screen").classList.add("hidden");
  $("#main-app").classList.remove("hidden");
}
function setBusy(busy) {
  state.busy = busy;
  $("#submit-auth").disabled = busy;
  $("#submit-auth").textContent = busy ? "Connexion…" : (state.signup ? "Créer mon compte" : "Se connecter");
}
function setSync(text) {
  $("#connection-state").textContent = text;
}
function toggleSignup() {
  state.signup = !state.signup;
  $("#auth-title").textContent = state.signup ? "Un espace rien qu'à vous." : "Bon retour.";
  $("#auth-helper").textContent = state.signup ? "Créez votre compte pour organiser vos propres objectifs." : "Connectez-vous pour retrouver vos objectifs.";
  $("#toggle-auth").textContent = state.signup ? "J'ai déjà un compte" : "Créer un compte";
  $("#password").setAttribute("autocomplete",state.signup ? "new-password" : "current-password");
  $("#auth-message").textContent = "";
  setBusy(false);
}
async function unwrap(query) {
  const {data,error} = await query;
  if (error) throw error;
  return data;
}
function locateWorkspace() {
  if (!state.session?.user) throw new Error("La session a expiré.");
  return state.session.user.id;
}
async function ensureWorkspace() {
  const userId = locateWorkspace();
  const found = await unwrap(
    state.client.from("kyg_workspaces").select("*").eq("owner_user_id",userId).order("created_at").limit(1)
  );
  if (found.length) {
    state.workspace = found[0];
    return;
  }
  // Each new user gets a private workspace. Never auto-claim an unowned workspace.
  const created = await unwrap(
    state.client.from("kyg_workspaces")
      .insert({ name:"Mon espace", owner_user_id:userId, timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris" })
      .select("*").single()
  );
  state.workspace = created;
}
async function reload() {
  if (!state.workspace?.id) return;
  setSync("Synchronisation…");
  const wid = state.workspace.id;
  const [areas,goals,milestones,actions,ideas] = await Promise.all([
    unwrap(state.client.from("kyg_areas").select("*").eq("workspace_id",wid).order("position")),
    unwrap(state.client.from("kyg_goals").select("*").eq("workspace_id",wid).neq("status","archived").order("priority")),
    unwrap(state.client.from("kyg_milestones").select("*").eq("workspace_id",wid).order("due_date")),
    unwrap(state.client.from("kyg_actions").select("*").eq("workspace_id",wid).neq("status","discarded").order("created_at")),
    unwrap(state.client.from("kyg_ideas").select("*").eq("workspace_id",wid).neq("status","archived").order("created_at",{ascending:false}))
  ]);
  Object.assign(state,{areas,goals,milestones,actions,ideas});
  if (state.selectedGoalId && !goals.some(g => g.id===state.selectedGoalId)) state.selectedGoalId=null;
  render();
  setSync("À jour");
}
async function bootstrap() {
  if(state.bootstrapTask) return state.bootstrapTask;
  state.bootstrapTask = (async () => {
  if (!state.session?.user) {
    state.workspace=null;
    showAuth();
    return;
  }
  showApp();
  setSync("Connexion…");
  try {
    await ensureWorkspace();
    await reload();
  } catch (error) {
    setSync("Erreur de synchronisation");
    toast(niceError(error),true);
    // No false "all synced" status when a user lacks access.
  }
  })();
  try { return await state.bootstrapTask; }
  finally { state.bootstrapTask = null; }
}
async function initialize() {
  bindEvents();
  if (!window.supabase?.createClient)
    return showAuth("La bibliothèque de connexion n'a pas été chargée. Vérifiez l'accès au CDN et rechargez la page.");
  const url = String(cfg.SUPABASE_URL||"").trim();
  const key = String(cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_ANON_KEY||"").trim();
  if (url !== "https://" + EXPECTED_PROJECT + ".supabase.co" || !key.startsWith("sb_publishable_"))
    return showAuth("Configuration du nouveau projet Supabase indisponible. Aucune connexion n'a été tentée vers l'ancienne base.");
  state.client = window.supabase.createClient(url,key,{ auth:{ persistSession:true,autoRefreshToken:true,detectSessionInUrl:true } });
  try {
    const {data,error} = await state.client.auth.getSession();
    if (error) throw error;
    state.session=data.session;
    await bootstrap();
    state.client.auth.onAuthStateChange((_event,session) => {
      const oldId=state.session?.user?.id;
      state.session=session;
      if (oldId!==session?.user?.id || _event==="SIGNED_OUT")
        setTimeout(() => bootstrap().catch(e=>toast(niceError(e),true)),0);
    });
  } catch(error) {
    showAuth(niceError(error));
  }
}
function areaName(id) {
  return state.areas.find(a => a.id===id)?.name || "Sans catégorie";
}
function areaChildren(parentId) {
  return state.areas.filter(a => a.status==="active" && a.parent_id===parentId)
    .sort((a,b) => a.position-b.position || a.name.localeCompare(b.name,"fr"));
}
function areaDepth(id) {
  let depth=0, cur=state.areas.find(a=>a.id===id),seen=new Set();
  while(cur?.parent_id && depth<8 && !seen.has(cur.id)) {
    seen.add(cur.id);depth++;cur=state.areas.find(a=>a.id===cur.parent_id);
  }
  return depth;
}
function treeOptions(excludeId=null) {
  return state.areas.filter(a=>a.status==="active" && a.id!==excludeId)
    .sort((a,b)=>a.position-b.position||a.name.localeCompare(b.name,"fr"))
    .map(a=>({id:a.id,name: "— ".repeat(areaDepth(a.id))+a.name}));
}
function selectOptions(selected, includeBlank=false) {
  return (includeBlank ? '<option value="">Sans catégorie</option>' : '<option value="">Choisir un volet…</option>') +
    treeOptions().map(a=>'<option value="'+esc(a.id)+'"'+(a.id===selected?' selected':'')+'>'+esc(a.name)+'</option>').join("");
}
function setView(view) {
  if (!["now","calendar","path","ideas"].includes(view))return;
  state.view=view;
  for(const v of ["now","calendar","path","ideas"]) $("#screen-"+v).classList.toggle("hidden",v!==view);
  $$("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  if(view==="calendar")renderCalendar();
  window.scrollTo({top:0,behavior:"smooth"});
}
function actionReady(a) {
  return ["ready","in_progress"].includes(a.status) &&
    (!a.goal_id || state.goals.some(g=>g.id===a.goal_id && g.status==="active"));
}
function actionSort(a,b) {
  const da=a.due_date||"9999-12-31",db=b.due_date||"9999-12-31";
  return da.localeCompare(db) || (a.created_at||"").localeCompare(b.created_at||"");
}
function renderNow() {
  const open=state.actions.filter(actionReady).sort(actionSort);
  const current=open.find(a=>a.is_focus) || open[0];
  const title=$("#focus-title"),details=$("#focus-details"),meta=$("#focus-meta"),buttons=$("#focus-buttons");
  if(current) {
    title.textContent=current.title;
    details.textContent=current.details || (current.goal_id ? "Objectif : "+(state.goals.find(g=>g.id===current.goal_id)?.title||"") : "Une petite action à terminer.");
    meta.textContent=current.estimated_minutes?current.estimated_minutes+" min":"";
    buttons.innerHTML='<button type="button" class="button primary" data-complete-action="'+esc(current.id)+'">✓ C’est fait</button>'+
      (current.goal_id?'<button type="button" class="button secondary" data-open-goal="'+esc(current.goal_id)+'">Voir l’objectif</button>':"");
  }else{
    title.textContent="Rien d'urgent à faire.";
    details.textContent=state.goals.length?"Choisissez une prochaine action depuis un objectif, seulement quand vous le souhaitez.":"Commencez par créer votre premier volet et votre premier objectif.";
    meta.textContent="";
    buttons.innerHTML='<button type="button" class="button secondary" data-view="path">Voir mon chemin</button>';
  }
  const rest=open.filter(a=>a.id!==current?.id);
  $("#other-actions-count").textContent=rest.length ? "("+rest.length+")" : "";
  $("#other-actions-list").innerHTML=rest.length?rest.map(a=>actionRow(a)).join(""):'<p class="muted">Aucune autre action en attente.</p>';
}
function actionRow(a) {
  const path=actionTrail(a);
  const schedule=a.planned_for?"Prévue le "+shortDate(a.planned_for):a.due_date?"Échéance le "+shortDate(a.due_date):"Sans date";
  const due=a.due_date&&a.planned_for&&a.due_date!==a.planned_for?" · Échéance "+shortDate(a.due_date):"";
  return '<article class="action-item'+(a.status==="done"?" done":"")+'">'+
    (a.status!=="done"?'<button type="button" class="icon-button" data-complete-action="'+esc(a.id)+'" aria-label="Marquer comme terminée">◯</button>':'<span class="action-done-icon" aria-label="Terminée">✓</span>')+
    '<div class="action-item-body"><h3>'+esc(a.title)+'</h3><p title="'+esc(path)+'">'+esc(path)+'</p><p>'+esc(schedule+due)+' · '+statusLabel(a.status)+'</p></div>'+
    '<button type="button" class="icon-button" data-edit-action="'+esc(a.id)+'" title="Modifier cette tâche" aria-label="Modifier la tâche">✎</button>'+
    (!a.is_focus&&actionReady(a)?'<button type="button" class="icon-button" data-focus-action="'+esc(a.id)+'" title="Choisir comme focus" aria-label="Choisir comme prochaine action">◎</button>':"")+
  '</article>';
}
function renderAreas() {
  const roots=areaChildren(null);
  $("#areas-tree").innerHTML=roots.length?roots.map(root=>{
    const children=state.areas.filter(a=>a.status==="active" && a.id!==root.id && isDescendantOf(a.id,root.id)).sort((a,b)=>a.position-b.position);
    return '<article class="area-card"><div class="area-title"><span>'+esc(root.name)+'</span><span class="area-actions">'+
      '<button type="button" class="icon-button" data-edit-area="'+esc(root.id)+'" title="Renommer" aria-label="Modifier '+esc(root.name)+'">✎</button>'+
      '<button type="button" class="icon-button" data-add-subarea="'+esc(root.id)+'" title="Créer un sous-volet">＋</button></span></div>'+
      (children.length?'<div class="area-children">'+children.map(a=>'<div class="area-child" style="padding-left:'+Math.max(0,(areaDepth(a.id)-1)*12)+'px"><span>↳ '+esc(a.name)+'</span><button type="button" class="icon-button" data-edit-area="'+esc(a.id)+'" aria-label="Modifier '+esc(a.name)+'">✎</button></div>').join("")+'</div>':'<p class="mini-note">Ajoutez un sous-volet si nécessaire.</p>')+'</article>';
  }).join(""):'<p class="empty-state">Créez votre premier volet. Il peut s’appeler Personnel, Formation, Entreprise… ou comme vous voulez.</p>';
}
function isDescendantOf(id,ancestorId) {
  let node=state.areas.find(a=>a.id===id),visited=new Set();
  while(node?.parent_id && !visited.has(node.id)){ if(node.parent_id===ancestorId)return true;visited.add(node.id);node=state.areas.find(a=>a.id===node.parent_id); }
  return false;
}
function renderGoals() {
  $("#goals-counter").textContent=state.goals.length+" objectif"+(state.goals.length>1?"s":"");
  $("#goals-list").innerHTML=state.goals.length?state.goals.map(g=>{
    const ms=state.milestones.filter(m=>m.goal_id===g.id);
    const reached=ms.filter(m=>m.status==="reached").length;
    const excerpt=g.specific_outcome||g.why_it_matters||"Définissez la réussite à votre rythme.";
    return '<button type="button" class="goal-card" data-open-goal="'+esc(g.id)+'">'+
      '<span class="eyebrow">'+esc(areaName(g.area_id))+'</span><h3>'+esc(g.title)+'</h3><p>'+esc(excerpt.slice(0,140))+'</p>'+
      '<footer><span>'+reached+'/'+ms.length+' jalon'+(ms.length>1?"s":"")+'</span><span class="status '+esc(g.status)+'">'+statusLabel(g.status)+'</span></footer></button>';
  }).join(""):'<p class="empty-state">Aucun objectif. Vous pouvez en créer un sans vous engager à le réaliser immédiatement.</p>';
}
function statusLabel(status) {
  return ({draft:"Brouillon",active:"Actif",paused:"En pause",achieved:"Atteint",archived:"Archivé",proposed:"Proposé",planned:"Planifié",reached:"Atteint",missed:"À revoir",cancelled:"Annulé",backlog:"Plus tard",ready:"À faire",in_progress:"En cours",done:"Terminé"})[status]||status;
}
function renderIdeas() {
  $("#idea-area").innerHTML=selectOptions("",true);
  const ideas=state.ideas.filter(x=>x.status==="parked");
  $("#ideas-counter").textContent=ideas.length+" idée"+(ideas.length>1?"s":"");
  $("#ideas-list").innerHTML=ideas.length?ideas.map(i=>{
    return '<article class="idea-card"><h3>'+esc(i.title)+'</h3>'+
      (i.raw_text&&i.raw_text!==i.title?'<p>'+esc(i.raw_text)+'</p>':"")+
      '<footer><span class="muted">'+esc(i.area_id?areaName(i.area_id):"Sans catégorie")+'</span>'+
      '<button type="button" class="button subtle small" data-archive-idea="'+esc(i.id)+'">Classer sans suite</button></footer></article>';
  }).join(""):'<p class="empty-state">Votre coffre est vide. C’est très bien ainsi.</p>';
}
function renderDetail() {
  const g=state.goals.find(x=>x.id===state.selectedGoalId);
  if(!g)return;
  $("#detail-category").textContent=areaName(g.area_id);
  $("#detail-title").textContent=g.title;
  $("#detail-outcome").textContent=g.specific_outcome||"Le résultat attendu reste à préciser.";
  $("#detail-meta").innerHTML='<span class="status '+esc(g.status)+'">'+statusLabel(g.status)+'</span>'+
    '<span>Début : '+shortDate(g.start_date)+'</span>'+
    (g.target_date?'<span>Cible : '+shortDate(g.target_date)+'</span>':"")+
    (g.metric_name?'<span>Indicateur : '+esc(g.metric_name)+'</span>':"");
  const ms=state.milestones.filter(x=>x.goal_id===g.id).sort((a,b)=>a.horizon_months-b.horizon_months);
  $("#detail-milestones").innerHTML=ms.length?ms.map(m=>
    '<article class="milestone-card"><header><span class="eyebrow">'+m.horizon_months+' MOIS</span><span class="status '+esc(m.status)+'">'+statusLabel(m.status)+'</span></header>'+
    '<h3>'+esc(m.title)+'</h3><p>'+esc(m.acceptance_evidence||m.expected_result||"")+'</p>'+
    '<footer><span class="muted">'+shortDate(m.due_date)+'</span><button type="button" class="icon-button" data-edit-milestone="'+esc(m.id)+'">Modifier</button></footer></article>'
  ).join(""):'<p class="empty-state">Aucun jalon. Ajoutez le premier résultat intermédiaire quand vous êtes prêt.</p>';
  const aa=state.actions.filter(x=>x.goal_id===g.id);
  $("#detail-actions").innerHTML=aa.length?aa.map(a=>actionRow(a)).join(""):'<p class="empty-state">Aucune action obligatoire. Vous pouvez en définir une à votre rythme.</p>';
}
function render() {
  renderNow();
  renderCalendar();
  renderAreas();
  renderGoals();
  renderIdeas();
  renderDetail();
}
function openDialog(name) {$("#"+name).showModal();}
function closeDialog(name) {$("#"+name).close();}
function openArea(id=null,parentId=null) {
  const form=$("#area-form");
  form.reset();
  const area=state.areas.find(x=>x.id===id);
  $("#area-id").value=area?.id||"";
  $("#area-name").value=area?.name||"";
  $("#area-dialog-title").textContent=area?"Modifier un volet":parentId?"Créer un sous-volet":"Créer un volet";
  const parentOptions=[...treeOptions(area?.id)];
  // Prevent moving a parent inside any of its descendants.
  const allowed=parentOptions.filter(x=>!area||!isDescendantOf(x.id,area.id));
  $("#area-parent").innerHTML='<option value="">Volet principal</option>'+allowed.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join("");
  $("#area-parent").value=area?.parent_id||parentId||"";
  openDialog("area-dialog");
}
async function saveArea(form) {
  const values=Object.fromEntries(new FormData(form));
  const id=values.id||null;
  const data={name:String(values.name||"").trim(),parent_id:values.parent_id||null,updated_at:new Date().toISOString()};
  if(!data.name) return toast("Donnez un nom au volet.",true);
  if(data.parent_id && areaDepth(data.parent_id)>=7)return toast("Trop de niveaux de sous-volets.",true);
  if(id){
    if(data.parent_id===id||isDescendantOf(data.parent_id,id))return toast("Ce déplacement créerait une boucle.",true);
    await unwrap(state.client.from("kyg_areas").update(data).eq("workspace_id",state.workspace.id).eq("id",id));
  }else{
    await unwrap(state.client.from("kyg_areas").insert({...data,workspace_id:state.workspace.id}));
  }
  closeDialog("area-dialog");
  await reload();
  toast("Volet enregistré.");
}
function openGoal(id=null) {
  const g=state.goals.find(x=>x.id===id);
  const f=$("#goal-form");
  f.reset();
  $("#goal-dialog-title").textContent=g?"Modifier mon objectif":"Définir un objectif";
  $("#goal-id").value=g?.id||"";
  $("#goal-area").innerHTML=selectOptions(g?.area_id||"");
  $("#goal-title").value=g?.title||"";
  $("#goal-outcome").value=g?.specific_outcome||"";
  f.elements.metric_name.value=g?.metric_name||"";
  f.elements.target_value.value=g?.target_value??"";
  $("#goal-start").value=g?.start_date||todayLocal();
  f.elements.target_date.value=g?.target_date||"";
  $("#goal-status").value=g?.status||"draft";
  if(!state.areas.some(a=>a.status==="active")){
    toast("Créez un volet avant de définir votre objectif.");
    return openArea();
  }
  openDialog("goal-dialog");
}
async function saveGoal(form) {
  const v=Object.fromEntries(new FormData(form));
  const data={
    workspace_id:state.workspace.id,
    area_id:v.area_id,
    title:String(v.title||"").trim(),
    specific_outcome:v.specific_outcome?.trim()||null,
    metric_name:v.metric_name?.trim()||null,
    target_value:v.target_value===""?null:Number(v.target_value),
    start_date:v.start_date||todayLocal(),
    target_date:v.target_date||null,
    status:v.status||"draft",
    updated_at:new Date().toISOString()
  };
  if (!data.area_id) return toast("Choisissez un volet.",true);
  if(data.target_date && data.target_date<data.start_date)return toast("L'échéance doit suivre la date de départ.",true);
  if(!data.title)return toast("Précisez un objectif.",true);
  if(v.id)await unwrap(state.client.from("kyg_goals").update(data).eq("id",v.id).eq("workspace_id",state.workspace.id));
  else await unwrap(state.client.from("kyg_goals").insert(data));
  closeDialog("goal-dialog");
  await reload();
  toast("Objectif enregistré, sans création de tâches automatique.");
}
function openGoalDetail(id) {
  if(!state.goals.find(g=>g.id===id))return;
  state.selectedGoalId=id;
  renderDetail();
  openDialog("goal-detail-dialog");
}
function openMilestone(id=null) {
  const g=state.goals.find(x=>x.id===state.selectedGoalId);
  if(!g)return;
  const form=$("#milestone-form");
  form.reset();
  const m=state.milestones.find(x=>x.id===id);
  $("#milestone-id").value=m?.id||"";
  $("#milestone-dialog-title").textContent=m?"Modifier un jalon":"Ajouter un jalon";
  const used=state.milestones.filter(x=>x.goal_id===g.id).map(x=>x.horizon_months);
  const horizon=m?.horizon_months||[1,3,6,12].find(x=>!used.includes(x))||Math.max(1,...used)+1;
  $("#milestone-horizon").value=horizon;
  $("#milestone-date").value=m?.due_date||plusMonths(g.start_date,horizon);
  form.elements.title.value=m?.title||"";
  form.elements.acceptance_evidence.value=m?.acceptance_evidence||"";
  form.elements.status.value=m?.status||"proposed";
  openDialog("milestone-dialog");
}
async function saveMilestone(form) {
  const v=Object.fromEntries(new FormData(form));
  const g=state.goals.find(x=>x.id===state.selectedGoalId);
  if(!g)return;
  const data={
    workspace_id:state.workspace.id,goal_id:g.id,
    horizon_months:Number(v.horizon_months),
    due_date:v.due_date,title:v.title?.trim(),
    acceptance_evidence:v.acceptance_evidence?.trim()||null,
    status:v.status||"proposed",updated_at:new Date().toISOString()
  };
  if(!data.title || !data.due_date)return toast("Complétez le jalon.",true);
  if(v.id)await unwrap(state.client.from("kyg_milestones").update(data).eq("id",v.id).eq("workspace_id",state.workspace.id));
  else await unwrap(state.client.from("kyg_milestones").insert(data));
  closeDialog("milestone-dialog");
  await reload();
  toast("Jalon enregistré.");
}
function goalsForArea(areaId) {
  return !areaId ? state.goals :
    state.goals.filter(g=>g.area_id===areaId || isDescendantOf(g.area_id,areaId));
}
function refreshActionGoalOptions(selectedId="") {
  const goals=goalsForArea($("#action-area-filter").value);
  $("#action-goal").innerHTML='<option value="">Aucun — tâche indépendante</option>'+
    goals.map(g=>'<option value="'+esc(g.id)+'">'+esc([...areaTrail(g.area_id),g.title].join(" › "))+(g.status!=="active"?" ("+statusLabel(g.status)+")":"")+'</option>').join("");
  $("#action-goal").value=goals.some(g=>g.id===selectedId)?selectedId:"";
  refreshActionMilestoneOptions();
}
function refreshActionMilestoneOptions(selectedId="") {
  const goalId=$("#action-goal").value;
  const select=$("#action-milestone");
  const milestones=milestonesForGoal(goalId);
  select.innerHTML='<option value="">Sans jalon</option>'+
    milestones.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.title)+' · '+m.horizon_months+' mois</option>').join("");
  select.disabled=!goalId||!milestones.length;
  select.value=milestones.some(m=>m.id===selectedId)?selectedId:"";
  refreshActionBreadcrumb();
}
function refreshActionBreadcrumb() {
  const goal=state.goals.find(g=>g.id===$("#action-goal").value);
  const milestone=state.milestones.find(m=>m.id===$("#action-milestone").value && m.goal_id===goal?.id);
  const trail=goal?[...areaTrail(goal.area_id),goal.title,...(milestone?[milestone.title]:[])]:["Tâche indépendante","Aucun objectif requis"];
  $("#action-breadcrumb").textContent=trail.join(" › ");
}
function openAction({id=null,goalId=null,date=null}={}) {
  const a=id?state.actions.find(x=>x.id===id):null;
  if(id&&!a)return;
  const form=$("#action-form");
  form.reset();
  $("#action-dialog-title").textContent=a?"Modifier une tâche":"Ajouter une tâche";
  $("#action-id").value=a?.id||"";
  $("#action-title").value=a?.title||"";
  form.elements.details.value=a?.details||"";
  $("#action-planned-for").value=a?.planned_for||date||"";
  $("#action-due-date").value=a?.due_date||"";
  form.elements.estimated_minutes.value=a?.estimated_minutes||"";
  $("#action-status").value=a?.status==="backlog"?"backlog":a?.status==="in_progress"?"in_progress":a?.status==="done"?"done":"ready";
  $("#action-focus").checked=Boolean(a?.is_focus);
  const selectedGoal=a?.goal_id||goalId||"";
  const goal=state.goals.find(g=>g.id===selectedGoal);
  $("#action-area-filter").innerHTML='<option value="">Tous les volets</option>'+
    treeOptions().map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join("");
  $("#action-area-filter").value=goal?.area_id||"";
  refreshActionGoalOptions(selectedGoal);
  refreshActionMilestoneOptions(a?.milestone_id||"");
  openDialog("action-dialog");
}
async function clearFocus() {
  await unwrap(state.client.from("kyg_actions").update({is_focus:false,updated_at:new Date().toISOString()})
    .eq("workspace_id",state.workspace.id).eq("is_focus",true));
}
function actionFormPayload(values, focus) {
  const goalId=values.goal_id||null;
  const milestoneId=values.milestone_id||null;
  const goal=goalId?state.goals.find(g=>g.id===goalId):null;
  if(goalId&&!goal)throw new Error("L'objectif sélectionné n'existe plus dans cet espace.");
  const milestone=milestoneId?state.milestones.find(m=>m.id===milestoneId && m.goal_id===goalId):null;
  if(milestoneId&&!milestone)throw new Error("Le jalon sélectionné n'appartient pas à cet objectif.");
  if(focus && values.status!=="ready" && values.status!=="in_progress")throw new Error("Seule une tâche à faire ou en cours peut être la priorité.");
  if(focus && goal && goal.status!=="active")throw new Error("Activez l'objectif parent avant de définir une action prioritaire.");
  if(values.planned_for&&!/^\d{4}-\d{2}-\d{2}$/.test(values.planned_for))throw new Error("Jour prévu invalide.");
  return {
    goal_id:goalId, milestone_id:milestoneId,
    title:String(values.title||"").trim(),
    details:values.details?.trim()||null,
    planned_for:values.planned_for||null,
    due_date:values.due_date||null,
    estimated_minutes:values.estimated_minutes?Number(values.estimated_minutes):null,
    status:values.status||"ready",
    is_focus:focus
  };
}
async function saveAction(form) {
  const v=Object.fromEntries(new FormData(form));
  const id=v.id||null;
  const existing=id?state.actions.find(a=>a.id===id):null;
  if(id&&!existing)throw new Error("Cette tâche n'est plus disponible.");
  const data=actionFormPayload(v,form.elements.is_focus.checked);
  if(!data.title)return toast("Précisez la tâche.",true);
  const completedAt=data.status==="done"?existing?.completed_at||new Date().toISOString():null;
  if(data.is_focus && !existing?.is_focus)await clearFocus();
  if(id) {
    await unwrap(state.client.from("kyg_actions").update({...data,completed_at:completedAt,updated_at:new Date().toISOString()})
      .eq("id",id).eq("workspace_id",state.workspace.id));
  } else {
    await unwrap(state.client.from("kyg_actions").insert({...data,workspace_id:state.workspace.id,completed_at:completedAt}));
  }
  closeDialog("action-dialog");
  if(data.planned_for || data.due_date){
    state.selectedCalendarDate=data.planned_for||data.due_date;
    state.calendarCursor=state.selectedCalendarDate;
  }
  await reload();
  toast(id?"Tâche mise à jour.":"Tâche ajoutée à votre espace.");
}
async function completeAction(id) {
  const a=state.actions.find(x=>x.id===id);
  if(!a||a.status==="done")return;
  await unwrap(state.client.from("kyg_actions").update({status:"done",completed_at:new Date().toISOString(),is_focus:false,updated_at:new Date().toISOString()})
    .eq("id",id).eq("workspace_id",state.workspace.id));
  await reload();
  toast("Action terminée.");
}
async function setFocus(id) {
  const a=state.actions.find(x=>x.id===id);
  if(!a||!actionReady(a))return;
  await clearFocus();
  await unwrap(state.client.from("kyg_actions").update({is_focus:true,updated_at:new Date().toISOString()})
    .eq("id",id).eq("workspace_id",state.workspace.id));
  await reload();
  setView("now");
  toast("C'est votre prochaine action.");
}
async function saveIdea(form) {
  const raw=$("#idea-text").value.trim();
  if(!raw)return;
  const data={
    workspace_id:state.workspace.id,
    area_id:$("#idea-area").value||null,
    title:raw.split("\n")[0].slice(0,180),
    raw_text:raw,
    status:"parked"
  };
  await unwrap(state.client.from("kyg_ideas").insert(data));
  form.reset();
  await reload();
  toast("Idée conservée. Rien à faire pour l'instant.");
}
async function archiveIdea(id) {
  await unwrap(state.client.from("kyg_ideas").update({status:"archived",updated_at:new Date().toISOString()})
    .eq("workspace_id",state.workspace.id).eq("id",id));
  await reload();
  toast("Idée classée sans suite.");
}
function withError(fn) {
  return async (...args) => {
    try { await fn(...args); }
    catch(error) { setSync("Erreur"); toast(niceError(error),true); console.error("KeepYourGoals",error); }
  };
}
function bindEvents() {
  $("#toggle-auth").addEventListener("click",toggleSignup);
  $("#auth-form").addEventListener("submit",withError(async event=>{
    event.preventDefault();
    if(!state.client)return showAuth("Impossible de joindre le service de connexion.");
    setBusy(true);
    $("#auth-message").textContent="";
    try {
      const args={email:$("#email").value.trim(),password:$("#password").value};
      // Redirect after email verification to the current site, if allowed in Supabase Auth settings.
      const signupArgs={...args,options:{emailRedirectTo:window.location.origin+window.location.pathname}};
      const {data,error}=state.signup?
        await state.client.auth.signUp(signupArgs):
        await state.client.auth.signInWithPassword(args);
      if(error) throw error;
      if(state.signup && !data?.session){
        toggleSignup();
        showAuth("Compte créé. Consultez vos e-mails pour confirmer votre adresse, puis connectez-vous.",true);
        return;
      }
      state.session=data.session;
      await bootstrap();
    }catch(error){
      showAuth(niceError(error));
    }finally{setBusy(false);}
  }));
  $("#signout").addEventListener("click",withError(async()=>{
    if(!state.client)return;
    await unwrap(state.client.auth.signOut());
    state.session=null;state.workspace=null;
    showAuth("Vous êtes déconnecté.",true);
  }));
  document.body.addEventListener("click",withError(async event=>{
    const el=event.target.closest("button");
    if(!el)return;
    if(el.dataset.view)return setView(el.dataset.view);
    if(el.id==="go-ideas")return setView("ideas");
    if(el.id==="calendar-prev")return navigateCalendar(-1);
    if(el.id==="calendar-next")return navigateCalendar(1);
    if(el.id==="calendar-today")return selectCalendarDay(todayLocal());
    if(el.dataset.calendarMode){
      state.calendarMode=el.dataset.calendarMode;
      return renderCalendar();
    }
    if(el.dataset.calendarDay)return selectCalendarDay(el.dataset.calendarDay);
    if(el.id==="calendar-add-action"||el.id==="calendar-add-selected")
      return openAction({date:state.selectedCalendarDate||todayLocal()});
    if(el.dataset.editAction)return openAction({id:el.dataset.editAction});

    if(el.id==="new-area")return openArea();
    if(el.id==="new-goal")return openGoal();
    if(el.dataset.addSubarea)return openArea(null,el.dataset.addSubarea);
    if(el.dataset.editArea)return openArea(el.dataset.editArea);
    if(el.dataset.openGoal)return openGoalDetail(el.dataset.openGoal);
    if(el.dataset.completeAction)return completeAction(el.dataset.completeAction);
    if(el.dataset.focusAction)return setFocus(el.dataset.focusAction);
    if(el.dataset.archiveIdea)return archiveIdea(el.dataset.archiveIdea);
    if(el.dataset.editMilestone)return openMilestone(el.dataset.editMilestone);
    if(el.dataset.close)return closeDialog(el.dataset.close);
    if(el.id==="edit-selected-goal"){closeDialog("goal-detail-dialog");return openGoal(state.selectedGoalId);}
    if(el.id==="add-milestone")return openMilestone();
    if(el.id==="add-action")return openAction({goalId:state.selectedGoalId});
  }));
  $("#area-form").addEventListener("submit",withError(async e=>{e.preventDefault();await saveArea(e.currentTarget);}));
  $("#goal-form").addEventListener("submit",withError(async e=>{e.preventDefault();await saveGoal(e.currentTarget);}));
  $("#milestone-form").addEventListener("submit",withError(async e=>{e.preventDefault();await saveMilestone(e.currentTarget);}));
  $("#action-form").addEventListener("submit",withError(async e=>{e.preventDefault();await saveAction(e.currentTarget);}));
  $("#idea-form").addEventListener("submit",withError(async e=>{e.preventDefault();await saveIdea(e.currentTarget);}));
  $("#action-area-filter").addEventListener("change",()=>refreshActionGoalOptions());
  $("#action-goal").addEventListener("change",()=>refreshActionMilestoneOptions());
  $("#action-milestone").addEventListener("change",refreshActionBreadcrumb);
  $("#action-status").addEventListener("change",()=>{
    if(!["ready","in_progress"].includes($("#action-status").value))$("#action-focus").checked=false;
  });
    $("#milestone-horizon").addEventListener("change",()=>{
    const g=state.goals.find(x=>x.id===state.selectedGoalId);
    if(g && !$("#milestone-id").value)$("#milestone-date").value=plusMonths(g.start_date,$("#milestone-horizon").value);
  });
}
initialize().catch(error=>showAuth(niceError(error)));

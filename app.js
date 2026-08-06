const cfg = window.APP_CONFIG || {};
const SUPABASE_URL = String(cfg.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_ANON_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes('YOUR_PROJECT') || SUPABASE_KEY.includes('YOUR_')) {
  document.body.innerHTML = '<main style="font-family:system-ui;padding:40px;max-width:760px;margin:auto"><h1>Configuration Supabase manquante</h1><p>Renseigne <code>SUPABASE_URL</code> et <code>SUPABASE_PUBLISHABLE_KEY</code> dans <code>public/config.js</code>.</p></main>';
  throw new Error('Configuration Supabase invalide');
}

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
const isoToday = () => new Date().toISOString().slice(0, 10);
const addDays = (dateString, count) => { const d = new Date(`${dateString}T12:00:00`); d.setDate(d.getDate() + count); return d.toISOString().slice(0,10); };
const dateLabel = (value) => value ? new Intl.DateTimeFormat('fr-FR', { day:'numeric', month:'short', year:'numeric' }).format(new Date(`${value}T12:00:00`)) : 'Plus tard';
const minuteLabel = (value) => Number(value || 0) >= 60 ? `${Math.floor(Number(value)/60)} h${Number(value)%60 ? ` ${Number(value)%60}` : ''}` : `${Number(value || 0)} min`;
const debounce = (fn, delay = 450) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; };

const palette = ['#173B68','#B7652A','#3B7B55','#7558A6','#B48818','#A75262','#2B7B83'];
const icons = { work:'▣', business:'⌁', health:'♥', organization:'◉', money:'◎', study:'▤', home:'⌂', default:'◇' };

const state = {
  session: null,
  tenants: [],
  tenant: null,
  membership: null,
  domains: [],
  objectives: [],
  axes: [],
  projects: [],
  milestones: [],
  actions: [],
  ideas: [],
  proposals: [],
  checkin: null,
  view: 'path',
  path: { level: 'root', domainId: null, objectiveId: null, axisId: null, projectId: null },
  currentAction: null,
  currentProposal: null,
  guide: null,
  intake: { sessionId:null, rawText:'', lastProvider:null },
  providerStatus: null,
  saveActionDebounced: null,
};

async function init() {
  bindStaticEvents();
  const { data: { session } } = await db.auth.getSession();
  state.session = session;
  await routeAuth();
  db.auth.onAuthStateChange(async (_event, sessionValue) => {
    state.session = sessionValue;
    await routeAuth();
  });
}

async function routeAuth() {
  const signedIn = Boolean(state.session);
  $('#auth-view').classList.toggle('hidden', signedIn);
  $('#app-view').classList.toggle('hidden', !signedIn);
  if (!signedIn) return;
  await db.rpc('bootstrap_personal_tenant', { p_name: 'Mon espace' });
  await loadWorkspaces();
  const lastTenant = localStorage.getItem('ikigai_tenant_id');
  state.tenant = state.tenants.find(t => t.id === lastTenant) || state.tenants[0] || null;
  if (!state.tenant) return;
  localStorage.setItem('ikigai_tenant_id', state.tenant.id);
  await loadAll();
  renderAll();
  await refreshProviderStatus();
}

async function loadWorkspaces() {
  const { data, error } = await db.from('tenant_members')
    .select('role,tenant_id,tenants(*)')
    .eq('user_id', state.session.user.id)
    .order('created_at');
  if (error) throw error;
  state.tenants = (data || []).map(row => ({ ...row.tenants, membership_role: row.role }));
}

async function loadAll() {
  setSync('Mise à jour…');
  const tenantId = state.tenant.id;
  const requests = [
    db.from('domains').select('*').eq('tenant_id', tenantId).neq('status','archived').order('position'),
    db.from('objectives').select('*').eq('tenant_id', tenantId).neq('status','abandoned').order('created_at'),
    db.from('axes').select('*').eq('tenant_id', tenantId).neq('status','archived').order('position'),
    db.from('projects').select('*').eq('tenant_id', tenantId).neq('status','abandoned').order('created_at'),
    db.from('milestones').select('*').eq('tenant_id', tenantId).neq('status','cancelled').order('position'),
    db.from('actions').select('*').eq('tenant_id', tenantId).neq('status','cancelled').order('planned_date', { ascending: true, nullsFirst: false }),
    db.from('ideas').select('*').eq('tenant_id', tenantId).eq('status','parked').order('created_at', { ascending:false }),
    db.from('ai_proposals').select('*').eq('tenant_id', tenantId).eq('status','pending').order('created_at', { ascending:false }),
    db.from('daily_checkins').select('*').eq('tenant_id', tenantId).eq('user_id', state.session.user.id).eq('checkin_date', isoToday()).maybeSingle(),
  ];
  const results = await Promise.allSettled(requests);
  const resultData = (index, fallback) => results[index].status === 'fulfilled' && !results[index].value.error ? results[index].value.data ?? fallback : fallback;
  state.domains = resultData(0, []);
  state.objectives = resultData(1, []);
  state.axes = resultData(2, []);
  state.projects = resultData(3, []);
  state.milestones = resultData(4, []);
  state.actions = resultData(5, []);
  state.ideas = resultData(6, []);
  state.proposals = resultData(7, []);
  state.checkin = resultData(8, null);
  setSync('À jour');
}

function renderAll() {
  renderHeader();
  renderToday();
  renderPath();
  renderIdeas();
  renderProfile();
  renderNaturalIntakeState();
}

async function refreshProviderStatus() {
  try {
    const { data, error } = await db.functions.invoke('ai-assistant', { body:{ tenant_id:state.tenant.id, feature:'provider_status' } });
    if (error) throw error;
    state.providerStatus = data;
  } catch (error) {
    state.providerStatus = { available:{groq:false,openai:false}, selected:state.tenant.ai_provider_preference || 'groq', enabled:Boolean(state.tenant.ai_enabled), error:error.message };
  }
  renderNaturalIntakeState();
  renderProviderAvailability();
}

function renderNaturalIntakeState() {
  const shell = document.querySelector('.path-shell');
  if (shell) shell.classList.toggle('has-tree', state.domains.length > 0);
  const label = $('#ai-provider-state');
  if (!label) return;
  const status = state.providerStatus;
  if (!status) { label.textContent='Vérification de l’aide…'; label.className='provider-state'; return; }
  const selected = status.selected || state.tenant.ai_provider_preference || 'groq';
  const available = status.available || {};
  const usable = selected === 'auto' ? (available.groq || available.openai) : Boolean(available[selected]);
  label.className = `provider-state ${usable && status.enabled ? 'ready' : 'warning'}`;
  if (!status.enabled) label.textContent = 'Aide désactivée';
  else if (!usable) label.textContent = selected === 'groq' ? 'Groq à relier' : selected === 'openai' ? 'OpenAI à relier' : 'Aucun moteur relié';
  else label.textContent = selected === 'auto' ? (available.groq ? 'Aide prête · Groq' : 'Aide prête · OpenAI') : `Aide prête · ${selected === 'groq' ? 'Groq' : 'OpenAI'}`;
}

function renderProviderAvailability() {
  const el = $('#provider-availability');
  if (!el) return;
  const available = state.providerStatus?.available || {};
  el.textContent = `Groq : ${available.groq ? 'prêt' : 'non configuré'} · OpenAI : ${available.openai ? 'prêt' : 'non configuré'}`;
}

async function startNaturalIntake(rawText) {
  const text = String(rawText || '').trim();
  if (text.length < 3) return toast('Écris simplement ce que tu veux changer ou sortir de ta tête.');
  await ensureAIConsent();
  state.intake = { sessionId:null, rawText:text, lastProvider:null };
  openGuide({ mode:'loading', feature:'natural_intake' });
  await callNaturalIntake({ raw_text:text, weekly_capacity_minutes:state.tenant.weekly_capacity_minutes });
}

async function callNaturalIntake(context = {}, answer = null, selectedGroup = null) {
  state.guide = { ...(state.guide || {}), mode:'loading', feature:'natural_intake' };
  renderGuide();
  if (!$('#guide-dialog').open) $('#guide-dialog').showModal();
  const body = {
    tenant_id:state.tenant.id,
    feature:'natural_intake',
    context_type:'tenant',
    context_id:state.tenant.id,
    context,
    session_id:state.intake.sessionId,
    answer,
    selected_group:selectedGroup,
  };
  const { data, error } = await db.functions.invoke('ai-assistant', { body });
  if (error) { $('#guide-dialog').close(); return toast(error.message || 'L’aide n’est pas disponible.'); }
  if (data?.blocked) { state.guide={mode:'safe',title:data.title,message:data.message}; renderGuide(); return; }
  state.intake.sessionId = data.session_id || state.intake.sessionId;
  state.intake.lastProvider = data.provider || state.intake.lastProvider;
  if (data?.mode === 'ask') {
    state.guide = { mode:'natural_question', question:data.question, summary:data.summary };
    renderGuide(); return;
  }
  if (data?.mode === 'organize') {
    state.guide = { mode:'natural_organize', groups:data.groups || [], summary:data.summary };
    renderGuide(); return;
  }
  if (!data?.proposal) { $('#guide-dialog').close(); return toast('Je n’ai pas trouvé de chemin suffisamment clair.'); }
  state.currentProposal = data.proposal;
  $('#guide-dialog').close();
  await loadAll();
  openProposal(data.proposal);
}

function submitNaturalFreeAnswer() {
  const input = $('#natural-free-answer');
  if (!input?.value.trim()) return toast('Une phrase suffit.');
  callNaturalIntake({}, { type:'free_text', value:input.value.trim() });
}

function renderHeader() {
  const breadcrumb = buildBreadcrumb();
  $('#header-breadcrumb').innerHTML = breadcrumb.length
    ? breadcrumb.map((item, index) => `<span class="crumb" data-crumb-index="${index}">${esc(item.label)}</span>`).join('')
    : '<span>Mon espace</span>';
  $('#profile-space-name').textContent = state.tenant.name;
  $('#profile-initial').textContent = (state.session.user.email || 'I').slice(0,1).toUpperCase();
  $('#proposal-count').textContent = state.proposals.length;
  $('#proposal-count').classList.toggle('hidden', state.proposals.length === 0);
  const select = $('#workspace-select');
  select.innerHTML = state.tenants.map(t => `<option value="${t.id}" ${t.id === state.tenant.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
}

function buildBreadcrumb() {
  const items = [];
  const domain = state.domains.find(x => x.id === state.path.domainId);
  const objective = state.objectives.find(x => x.id === state.path.objectiveId);
  const axis = state.axes.find(x => x.id === state.path.axisId);
  const project = state.projects.find(x => x.id === state.path.projectId);
  if (domain) items.push({ level:'domain', label:domain.name });
  if (objective) items.push({ level:'objective', label:objective.title });
  if (axis) items.push({ level:'axis', label:axis.title });
  if (project) items.push({ level:'project', label:project.title });
  return items;
}

function renderToday() {
  const firstName = state.session.user.user_metadata?.display_name || state.session.user.email?.split('@')[0] || '';
  $('#today-greeting').textContent = firstName ? `BONJOUR ${firstName}` : 'BONJOUR';
  const selected = selectTodayActions();
  const main = selected[0];
  const secondary = selected.slice(1, Math.max(1, Number(state.tenant.daily_focus_limit || 3)));
  $('#today-count').textContent = selected.length;
  $('#today-count').classList.toggle('hidden', selected.length === 0);
  $('#today-total').textContent = selected.length ? minuteLabel(selected.reduce((sum,a) => sum + Number(a.estimated_minutes || 0), 0)) : '';

  const card = $('#main-focus-card');
  card.classList.toggle('empty', !main);
  $('#main-focus-title').textContent = main?.title || 'Tout est rangé.';
  $('#main-focus-context').textContent = main ? actionContext(main) : 'Choisis une prochaine action quand tu es prêt.';
  $('#main-focus-duration').textContent = main ? minuteLabel(main.estimated_minutes) : '';
  $('#main-focus-start').classList.toggle('hidden', !main);
  $('#main-focus-start').dataset.actionId = main?.id || '';

  $('#today-secondary-actions').innerHTML = secondary.length
    ? secondary.map(actionRowHtml).join('')
    : '<div class="empty-calm">Rien d’autre n’est nécessaire aujourd’hui.</div>';
  $('#today-reassurance').textContent = selected.length > 3
    ? `${selected.length - 3} autres actions sont rangées pour plus tard.`
    : 'Tout le reste est rangé. Tu n’as pas besoin d’y penser maintenant.';
  $('#energy-checkin').classList.toggle('hidden', Boolean(state.checkin));
}

function selectTodayActions() {
  const today = isoToday();
  const open = state.actions.filter(a => a.status !== 'done');
  const relevant = open.filter(a => a.planned_date === today || a.due_date === today || (a.due_date && a.due_date < today) || a.is_main);
  const energy = Number(state.checkin?.energy_level || 3);
  return relevant
    .map(a => ({ ...a, _score: actionScore(a, today, energy) }))
    .sort((a,b) => b._score - a._score)
    .slice(0, Math.max(3, Number(state.tenant.daily_focus_limit || 3)));
}

function actionScore(action, today, energy) {
  const priority = { low:10, medium:25, high:45, critical:70 }[action.priority] || 25;
  const overdue = action.due_date && action.due_date < today ? 55 : action.due_date === today ? 35 : 0;
  const planned = action.planned_date === today ? 25 : 0;
  const main = action.is_main ? 35 : 0;
  const impact = Number(action.impact_score || 3) * 5;
  const energyFit = Number(action.energy_level || 3) <= energy ? 10 : -10;
  return priority + overdue + planned + main + impact + energyFit - Math.min(20, Number(action.report_count || 0) * 2);
}

function actionContext(action) {
  const project = state.projects.find(p => p.id === action.project_id);
  const objective = project ? state.objectives.find(o => o.id === project.objective_id) : null;
  return [project?.title, objective?.title].filter(Boolean).join(' · ') || 'Action personnelle';
}

function actionRowHtml(action) {
  return `<article class="calm-task ${action.status === 'done' ? 'done' : ''} ${action.is_main ? 'priority' : ''}" data-action-id="${action.id}">
    <span class="task-circle ${action.status === 'done' ? 'done' : ''}" data-toggle-action="${action.id}" aria-label="${action.status === 'done' ? 'Rouvrir' : 'Terminer'}"></span>
    <div class="task-copy"><strong>${esc(action.title)}</strong><small>${esc(actionContext(action))}</small></div>
    <span class="tiny-meta">${minuteLabel(action.estimated_minutes)}</span>
  </article>`;
}

function renderPath() {
  const level = state.path.level;
  const focusCanvas = $('#focus-canvas');
  const projectDetail = $('#project-detail');
  const config = pathConfig();

  $('#path-overline').textContent = config.overline;
  $('#path-title').textContent = config.title;
  $('#path-subtitle').textContent = config.subtitle;
  document.documentElement.style.setProperty('--active-color', config.color || 'var(--accent)');

  if (level === 'project') {
    focusCanvas.classList.add('hidden');
    projectDetail.classList.remove('hidden');
    renderProjectDetail();
    $('#path-progress').classList.add('hidden');
  } else {
    focusCanvas.classList.remove('hidden');
    projectDetail.classList.add('hidden');
    focusCanvas.classList.toggle('root-canvas', level === 'root');
    renderParentNode(config.parent);
    renderChildNodes(config.children, config.childLevel, config.addLabel, config.color);
    const progress = config.parent ? progressOf(config.parent.type, config.parent.id) : null;
    renderProgressOrbit($('#path-progress'), progress, config.color, progress === null ? '' : 'progression globale');
    requestAnimationFrame(drawTreeLines);
  }
  renderHeader();
}

function pathConfig() {
  const domain = state.domains.find(x => x.id === state.path.domainId);
  const objective = state.objectives.find(x => x.id === state.path.objectiveId);
  const axis = state.axes.find(x => x.id === state.path.axisId);
  const project = state.projects.find(x => x.id === state.path.projectId);
  const color = domain?.color || palette[0];
  if (state.path.level === 'root') return {
    overline:'MON CHEMIN', title:'Ce qui compte vraiment pour moi', subtitle:'Entre dans un domaine. Le reste disparaîtra pour te laisser respirer.',
    parent:null, children:state.domains, childLevel:'domain', addLabel:'Ajouter un domaine', color,
  };
  if (state.path.level === 'domain') return {
    overline:'DOMAINE', title:domain?.name || 'Domaine', subtitle:domain?.description || 'Ce domaine rassemble les résultats que tu veux réellement obtenir.',
    parent:{ type:'domain', id:domain?.id, data:domain }, children:state.objectives.filter(o => o.domain_id === domain?.id), childLevel:'objective', addLabel:'Ajouter un objectif', color,
  };
  if (state.path.level === 'objective') return {
    overline:'CE QUE JE VEUX ATTEINDRE', title:objective?.title || 'Objectif', subtitle:objective?.success_metric || objective?.description || 'Choisis les chemins qui permettront d’atteindre ce résultat.',
    parent:{ type:'objective', id:objective?.id, data:objective }, children:state.axes.filter(a => a.objective_id === objective?.id), childLevel:'axis', addLabel:'Ajouter un axe', color,
  };
  if (state.path.level === 'axis') return {
    overline:'LE CHEMIN CHOISI', title:axis?.title || 'Axe', subtitle:axis?.description || 'Transforme ce chemin en projets concrets.',
    parent:{ type:'axis', id:axis?.id, data:axis }, children:state.projects.filter(p => p.axis_id === axis?.id), childLevel:'project', addLabel:'Ajouter un projet', color,
  };
  return { overline:'PROJET', title:project?.title || 'Projet', subtitle:project?.description || '', parent:{type:'project',id:project?.id,data:project}, children:[], color };
}

function renderParentNode(parent) {
  if (!parent?.data) { $('#focus-parent').innerHTML = ''; return; }
  $('#focus-parent').innerHTML = nodeCardHtml(parent.data, parent.type, true);
}

function renderChildNodes(items, type, _addLabel, _color) {
  const maxVisible = 5;
  const visible = items.slice(0, maxVisible);
  let html = visible.map(item => nodeCardHtml(item, type, false)).join('');
  if (!visible.length) html = `<div class="empty-calm">Écris simplement ce que tu veux dans la zone au-dessus. Le chemin apparaîtra ici après ta validation.</div>`;
  if (items.length > maxVisible) html += `<article class="node-card add-node" data-show-more="${type}"><strong>${items.length - maxVisible} autres éléments</strong><p>Ils restent rangés jusqu’à ce que tu choisisses de les voir.</p></article>`;
  $('#focus-children').innerHTML = html;
}

function nodeCardHtml(item, type, parent = false) {
  const progress = progressOf(type, item.id);
  const domain = domainFor(type, item.id);
  const color = domain?.color || palette[0];
  const count = childCount(type, item.id);
  const subtitle = nodeSubtitle(item, type);
  return `<article class="node-card ${parent ? 'parent-node' : ''}" data-node-type="${type}" data-node-id="${item.id}" style="--node-color:${color}">
    <div>
      <span class="node-icon">${esc(nodeIcon(item, type))}</span>
      <h3>${esc(type === 'domain' ? item.name : item.title)}</h3>
      <p>${esc(subtitle)}</p>
    </div>
    <div class="node-foot"><div><small class="tiny-meta">${count}</small><div class="node-progress"><span style="width:${progress}%"></span></div></div><span class="node-percent">${progress}%</span></div>
  </article>`;
}

function nodeIcon(item, type) {
  if (type === 'domain') return item.icon || icons.default;
  if (type === 'objective') return '◎';
  if (type === 'axis') return '⌁';
  if (type === 'project') return '▣';
  return '○';
}

function nodeSubtitle(item, type) {
  if (type === 'domain') return item.description || `${childCount(type,item.id)} · ${progressOf(type,item.id)} %`;
  if (type === 'objective') return item.target_date ? `Cible : ${dateLabel(item.target_date)}` : item.description || 'Objectif actif';
  if (type === 'axis') return item.description || 'Chemin stratégique';
  if (type === 'project') return item.target_date ? `Cible : ${dateLabel(item.target_date)}` : item.description || 'Projet';
  return '';
}

function childCount(type, id) {
  if (type === 'domain') return `${state.objectives.filter(o => o.domain_id === id).length} objectifs`;
  if (type === 'objective') return `${state.axes.filter(a => a.objective_id === id).length} axes`;
  if (type === 'axis') return `${state.projects.filter(p => p.axis_id === id).length} projets`;
  if (type === 'project') return `${state.actions.filter(a => a.project_id === id && a.status !== 'cancelled').length} actions`;
  return '';
}

function progressOf(type, id) {
  if (!id) return 0;
  if (type === 'project') {
    const milestones = state.milestones.filter(m => m.project_id === id);
    if (milestones.length) {
      const totalWeight = milestones.reduce((s,m) => s + Number(m.weight || 1),0);
      return Math.round(milestones.reduce((s,m) => s + (m.status === 'done' ? Number(m.weight || 1) : 0),0) / totalWeight * 100);
    }
    const actions = state.actions.filter(a => a.project_id === id && a.status !== 'cancelled');
    return actions.length ? Math.round(actions.filter(a => a.status === 'done').length / actions.length * 100) : 0;
  }
  if (type === 'axis') return averageProgress(state.projects.filter(p => p.axis_id === id).map(p => progressOf('project',p.id)));
  if (type === 'objective') return averageProgress(state.axes.filter(a => a.objective_id === id).map(a => progressOf('axis',a.id)));
  if (type === 'domain') return averageProgress(state.objectives.filter(o => o.domain_id === id).map(o => progressOf('objective',o.id)));
  return 0;
}

function averageProgress(values) { return values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length) : 0; }

function domainFor(type, id) {
  if (type === 'domain') return state.domains.find(d => d.id === id);
  if (type === 'objective') return state.domains.find(d => d.id === state.objectives.find(o => o.id === id)?.domain_id);
  if (type === 'axis') {
    const objective = state.objectives.find(o => o.id === state.axes.find(a => a.id === id)?.objective_id);
    return state.domains.find(d => d.id === objective?.domain_id);
  }
  if (type === 'project') {
    const project = state.projects.find(p => p.id === id);
    const objective = state.objectives.find(o => o.id === project?.objective_id);
    return state.domains.find(d => d.id === objective?.domain_id);
  }
  return null;
}

function renderProgressOrbit(element, progress, color, label) {
  if (progress === null || progress === undefined) { element.classList.add('hidden'); return; }
  element.classList.remove('hidden');
  element.style.setProperty('--p', progress);
  element.style.setProperty('--orbit-color', color || 'var(--accent)');
  element.innerHTML = `<strong>${progress}%</strong>${label ? `<small>${esc(label)}</small>` : ''}`;
}

function drawTreeLines() {
  const svg = $('#tree-lines');
  svg.innerHTML = '';
  if ($('#focus-canvas').classList.contains('root-canvas')) return;
  const parent = $('#focus-parent .node-card');
  const children = [...$('#focus-children').querySelectorAll('.node-card:not(.add-node)')];
  if (!parent || !children.length || window.innerWidth <= 640) return;
  const canvasRect = $('#focus-canvas').getBoundingClientRect();
  const p = parent.getBoundingClientRect();
  const startX = p.left + p.width/2 - canvasRect.left;
  const startY = p.bottom - canvasRect.top;
  svg.setAttribute('viewBox', `0 0 ${canvasRect.width} ${canvasRect.height}`);
  children.forEach(child => {
    const c = child.getBoundingClientRect();
    const endX = c.left + c.width/2 - canvasRect.left;
    const endY = c.top - canvasRect.top;
    const midY = startY + Math.max(34,(endY-startY)*.48);
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`);
    svg.appendChild(path);
  });
}

function renderProjectDetail() {
  const project = state.projects.find(p => p.id === state.path.projectId);
  if (!project) return;
  const domain = domainFor('project', project.id);
  const progress = progressOf('project', project.id);
  $('#project-title').textContent = project.title;
  $('#project-description').textContent = project.description || 'Ce projet transforme ton chemin en résultat concret.';
  renderProgressOrbit($('#project-progress-orbit'), progress, domain?.color || palette[0], 'progression du projet');

  const milestones = state.milestones.filter(m => m.project_id === project.id);
  $('#milestone-path').innerHTML = milestones.length
    ? milestones.map(m => `<div class="milestone-item ${m.status}"><span class="milestone-dot"></span><strong>${esc(m.title)}</strong><small>${m.due_date ? dateLabel(m.due_date) : ''}</small></div>`).join('')
    : '<div class="empty-calm">Aucun jalon. Le projet peut encore avancer avec ses actions.</div>';

  const openActions = state.actions.filter(a => a.project_id === project.id && a.status !== 'done' && a.status !== 'cancelled').sort((a,b) => actionScore(b,isoToday(),3)-actionScore(a,isoToday(),3));
  const doneActions = state.actions.filter(a => a.project_id === project.id && a.status === 'done').slice(0,5);
  $('#project-open-count').textContent = `${openActions.length} actions ouvertes`;
  $('#project-actions-now').innerHTML = (openActions.length ? openActions.map(actionRowHtml).join('') : '<div class="empty-calm">Le projet n’a plus d’action ouverte.</div>') + (doneActions.length ? `<div class="section-label-row" style="margin-top:1.35rem"><h3>Terminé</h3><span class="tiny-meta">${doneActions.length}</span></div>${doneActions.map(actionRowHtml).join('')}` : '');
  const due = openActions.filter(a => a.due_date).sort((a,b) => a.due_date.localeCompare(b.due_date))[0];
  $('#project-quiet-detail').innerHTML = `
    <div class="quiet-kpi"><span>Prochaine action</span><strong>${esc(openActions[0]?.title || 'À définir')}</strong></div>
    <div class="quiet-kpi"><span>Date cible</span><strong>${esc(project.target_date ? dateLabel(project.target_date) : 'Plus tard')}</strong></div>
    <div class="quiet-kpi"><span>Prochaine échéance</span><strong>${esc(due?.due_date ? dateLabel(due.due_date) : 'Aucune')}</strong></div>
    <div class="quiet-kpi"><span>Temps estimé restant</span><strong>${minuteLabel(openActions.reduce((s,a)=>s+Number(a.estimated_minutes||0),0))}</strong></div>
    ${openActions.length === 0 ? `<div class="context-help" data-ai-empty-project="${project.id}" role="button" tabindex="0">Je ne sais pas quelle action ajouter. M’aider à trouver la première.</div>` : ''}`;
}

function renderIdeas() {
  $('#ideas-list').innerHTML = state.ideas.length ? state.ideas.map(idea => {
    const reviewDue = idea.review_after && idea.review_after <= isoToday();
    return `<article class="idea-card" data-idea-id="${idea.id}"><h3>${esc(idea.title)}</h3><p>${esc(idea.description || 'Rangée sans obligation.')}</p><div class="idea-meta"><span>Ajoutée ${dateLabel(idea.created_at.slice(0,10))}</span><span class="${reviewDue ? 'idea-review' : ''}">${reviewDue ? 'À revoir' : `Revoir ${dateLabel(idea.review_after)}`}</span></div></article>`;
  }).join('') : '<div class="empty-calm">Aucune idée ne te demande de l’attention.</div>';
}

function renderProfile() {
  const settings = $('#settings-form');
  settings.elements.name.value = state.tenant.name || '';
  settings.elements.weekly_capacity_minutes.value = state.tenant.weekly_capacity_minutes || 600;
  settings.elements.daily_focus_limit.value = Math.min(3, state.tenant.daily_focus_limit || 3);
  settings.elements.ai_enabled.checked = Boolean(state.tenant.ai_enabled);
  if (settings.elements.ai_provider_preference) settings.elements.ai_provider_preference.value = state.tenant.ai_provider_preference || 'groq';
  renderProviderAvailability();
}

function switchView(view) {
  state.view = view;
  $$('.app-view').forEach(el => el.classList.toggle('active-view', el.id === `view-${view}`));
  $$('.dock-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  if (view === 'path') renderPath();
  if (view === 'today') renderToday();
  if (view === 'ideas') renderIdeas();
  window.scrollTo({ top:0, behavior:'smooth' });
}

function navigateTo(type, id) {
  if (type === 'domain') state.path = { level:'domain', domainId:id, objectiveId:null, axisId:null, projectId:null };
  if (type === 'objective') {
    const objective = state.objectives.find(o => o.id === id);
    state.path = { level:'objective', domainId:objective?.domain_id || null, objectiveId:id, axisId:null, projectId:null };
  }
  if (type === 'axis') {
    const axis = state.axes.find(a => a.id === id); const objective = state.objectives.find(o => o.id === axis?.objective_id);
    state.path = { level:'axis', domainId:objective?.domain_id || null, objectiveId:axis?.objective_id || null, axisId:id, projectId:null };
  }
  if (type === 'project') {
    const project = state.projects.find(p => p.id === id); const objective = state.objectives.find(o => o.id === project?.objective_id);
    state.path = { level:'project', domainId:objective?.domain_id || null, objectiveId:project?.objective_id || null, axisId:project?.axis_id || null, projectId:id };
  }
  switchView('path');
}

function goToBreadcrumb(index) {
  const crumbs = buildBreadcrumb();
  const item = crumbs[index];
  if (!item) { state.path = { level:'root',domainId:null,objectiveId:null,axisId:null,projectId:null }; }
  else {
    const id = item.level === 'domain' ? state.path.domainId : item.level === 'objective' ? state.path.objectiveId : item.level === 'axis' ? state.path.axisId : state.path.projectId;
    navigateTo(item.level, id);
  }
  renderPath();
}

function bindStaticEvents() {
  $('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('#auth-message').textContent = '';
    const { error } = await db.auth.signInWithPassword({ email:$('#email').value.trim(), password:$('#password').value });
    if (error) $('#auth-message').textContent = friendlyAuthError(error.message);
  });
  $('#signup-btn').addEventListener('click', async () => {
    $('#auth-message').textContent = '';
    const { error } = await db.auth.signUp({ email:$('#email').value.trim(), password:$('#password').value });
    $('#auth-message').textContent = error ? friendlyAuthError(error.message) : 'Ton espace est créé. Vérifie ton e-mail si une confirmation est demandée.';
  });

  $$('.dock-item').forEach(item => item.addEventListener('click', () => switchView(item.dataset.view)));
  $('#profile-trigger').addEventListener('click', () => $('#profile-sheet').showModal());
  $('#workspace-select').addEventListener('change', async e => {
    state.tenant = state.tenants.find(t => t.id === e.target.value);
    localStorage.setItem('ikigai_tenant_id', state.tenant.id);
    state.path = { level:'root',domainId:null,objectiveId:null,axisId:null,projectId:null };
    $('#profile-sheet').close();
    await loadAll(); renderAll(); await refreshProviderStatus();
  });

  document.body.addEventListener('click', handleBodyClick);
  document.body.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"]')) { e.preventDefault(); e.target.click(); }
  });
  window.addEventListener('resize', debounce(drawTreeLines, 100));

  $('#natural-intake-form').addEventListener('submit', e => {
    e.preventDefault();
    startNaturalIntake($('#natural-intake-input').value);
  });
  $('#idea-quick-form').addEventListener('submit', saveQuickIdea);
  $('#idea-quick-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#idea-quick-form').requestSubmit(); }
  });

  $('#settings-form').addEventListener('submit', saveSettings);
  $('#action-sheet').addEventListener('close', () => { state.currentAction = null; });
  setupActionAutosave();
}

async function handleBodyClick(event) {
  const viewTarget = event.target.closest('[data-view]');
  if (viewTarget && !viewTarget.classList.contains('dock-item')) switchView(viewTarget.dataset.view);

  const node = event.target.closest('[data-node-type]');
  if (node) navigateTo(node.dataset.nodeType, node.dataset.nodeId);

  const addNode = event.target.closest('[data-add-type]');
  if (addNode) openEntityEditor(addNode.dataset.addType);

  const taskCircle = event.target.closest('[data-toggle-action]');
  if (taskCircle) { event.stopPropagation(); await toggleAction(taskCircle.dataset.toggleAction); }

  const actionRow = event.target.closest('[data-action-id]');
  if (actionRow && !taskCircle) openActionSheet(actionRow.dataset.actionId);

  const mainStart = event.target.closest('#main-focus-start');
  if (mainStart?.dataset.actionId) openActionSheet(mainStart.dataset.actionId);

  const inlineAdd = event.target.closest('#inline-action-entry');
  if (inlineAdd) activateInlineActionEntry();

  const emptyProjectHelp = event.target.closest('[data-ai-empty-project]');
  if (emptyProjectHelp) startContextGuide('suggest_actions', 'project', emptyProjectHelp.dataset.aiEmptyProject);

  const energy = event.target.closest('[data-energy]');
  if (energy) await saveEnergyCheckin(Number(energy.dataset.energy));

  const profileAction = event.target.closest('[data-profile-action]');
  if (profileAction) handleProfileAction(profileAction.dataset.profileAction);

  const crumb = event.target.closest('[data-crumb-index]');
  if (crumb) goToBreadcrumb(Number(crumb.dataset.crumbIndex));

  const proposalAction = event.target.closest('[data-proposal-action]');
  if (proposalAction) handleProposalAction(proposalAction.dataset.proposalAction);

  const guideOption = event.target.closest('[data-guide-option]');
  if (guideOption) handleGuideOption(guideOption.dataset.guideOption);

  const guideNext = event.target.closest('[data-guide-next]');
  if (guideNext) handleGuideNext();

  const naturalAnswer = event.target.closest('[data-natural-answer]');
  if (naturalAnswer) callNaturalIntake({}, { type:'choice', id:naturalAnswer.dataset.naturalAnswer, label:naturalAnswer.dataset.naturalLabel || naturalAnswer.textContent.trim() });

  const naturalGroup = event.target.closest('[data-natural-group]');
  if (naturalGroup) {
    const group = (state.guide?.groups || []).find(g => g.id === naturalGroup.dataset.naturalGroup);
    if (group) callNaturalIntake({}, null, group);
  }

  const naturalFree = event.target.closest('[data-natural-free-submit]');
  if (naturalFree) submitNaturalFreeAnswer();

  const sheetHelp = event.target.closest('[data-action-ai]');
  if (sheetHelp) startActionAI(sheetHelp.dataset.actionAi);

  const speechTarget = event.target.closest('[data-speech-target]');
  if (speechTarget) startSpeechCapture(document.getElementById(speechTarget.dataset.speechTarget));
  const speechGuide = event.target.closest('[data-speech-guide]');
  if (speechGuide) startSpeechCapture($('#guide-step [data-guide-field]'));
}


function startSpeechCapture(target) {
  if (!target) return;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return toast('La dictée vocale n’est pas disponible dans ce navigateur.');
  const recognition = new Recognition();
  recognition.lang = 'fr-FR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  toast('Je t’écoute…');
  recognition.onresult = event => {
    const transcript = event.results?.[0]?.[0]?.transcript || '';
    target.value = `${target.value ? `${target.value.trim()} ` : ''}${transcript}`.trim();
    target.dispatchEvent(new Event('input',{bubbles:true}));
  };
  recognition.onerror = () => toast('Je n’ai pas pu utiliser le microphone. Tu peux continuer par écrit.');
  recognition.start();
}

function friendlyAuthError(message) {
  if (/Invalid login credentials/i.test(message)) return 'E-mail ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(message)) return 'Confirme ton e-mail avant de te connecter.';
  return message;
}

function setSync(text) { const el = $('#sync-state'); if (el) el.textContent = text; }
function toast(message) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = message; $('#toast-region').appendChild(el); setTimeout(() => el.remove(), 3200); }

async function toggleAction(id) {
  const action = state.actions.find(a => a.id === id); if (!action) return;
  const status = action.status === 'done' ? 'todo' : 'done';
  const { error } = await db.from('actions').update({ status }).eq('id', id);
  if (error) return toast(error.message);
  action.status = status;
  renderAll();
}

function openActionSheet(id) {
  const action = state.actions.find(a => a.id === id); if (!action) return;
  state.currentAction = action;
  $('#sheet-action-title').value = action.title || '';
  $('#sheet-project').innerHTML = `<option value="">Sans projet</option>${state.projects.map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join('')}`;
  $('#sheet-project').value = action.project_id || '';
  $('#sheet-planned-date').value = action.planned_date || '';
  $('#sheet-due-date').value = action.due_date || '';
  $('#sheet-duration').value = action.estimated_minutes || 30;
  $('#sheet-priority').value = action.priority || 'medium';
  $('#sheet-description').value = action.description || '';
  $('#sheet-status-circle').classList.toggle('done', action.status === 'done');
  renderActionHelp(action);
  $('#action-sheet').showModal();
}

function setupActionAutosave() {
  const save = debounce(async () => {
    if (!state.currentAction) return;
    const old = state.currentAction;
    const newPlanned = $('#sheet-planned-date').value || null;
    const reportIncrease = old.planned_date && newPlanned && old.planned_date < newPlanned && old.planned_date <= isoToday() ? 1 : 0;
    const payload = {
      title: $('#sheet-action-title').value.trim(), project_id: $('#sheet-project').value || null,
      planned_date: newPlanned, due_date: $('#sheet-due-date').value || null,
      estimated_minutes: Math.max(5, Number($('#sheet-duration').value || 30)), priority: $('#sheet-priority').value,
      description: $('#sheet-description').value.trim() || null,
      report_count: Number(old.report_count || 0) + reportIncrease,
    };
    if (!payload.title) return;
    setSync('Enregistrement…');
    const { error } = await db.from('actions').update(payload).eq('id', old.id);
    if (error) { setSync('Erreur'); return toast(error.message); }
    Object.assign(old, payload);
    setSync('À jour'); renderToday(); renderPath();
  }, 500);
  state.saveActionDebounced = save;
  ['sheet-action-title','sheet-project','sheet-planned-date','sheet-due-date','sheet-duration','sheet-priority','sheet-description'].forEach(id => $(`#${id}`).addEventListener('input', save));
  $('#sheet-status-circle').addEventListener('click', async () => { if (state.currentAction) await toggleAction(state.currentAction.id); $('#action-sheet').close(); });
}

function renderActionHelp(action) {
  const vague = action.title.trim().split(/\s+/).length < 3 || /^(faire|travailler|avancer|réfléchir|gérer|voir)\b/i.test(action.title.trim());
  const repeated = Number(action.report_count || 0) >= 3;
  const area = $('#sheet-ai-help');
  area.classList.toggle('hidden', !vague && !repeated);
  if (!vague && !repeated) return;
  area.innerHTML = `<strong>${repeated ? 'Cette action revient souvent.' : 'Cette action semble encore large.'}</strong><p>${repeated ? 'Elle est peut-être trop grande ou mal placée.' : 'Rendons-la plus facile à commencer.'}</p><div class="choice-row"><span class="choice-chip" data-action-ai="split_action" role="button" tabindex="0">La rendre plus petite</span>${repeated ? '<span class="choice-chip" data-action-ai="analyze_blockage" role="button" tabindex="0">Comprendre ce qui bloque</span>' : ''}</div>`;
}

function activateInlineActionEntry() {
  const container = $('#inline-action-entry');
  if (container.querySelector('input')) return;
  container.innerHTML = '<span>○</span><input aria-label="Nouvelle action" placeholder="Écrire la prochaine action…" style="border:0;outline:none;background:transparent;width:100%" />';
  const input = container.querySelector('input'); input.focus();
  input.addEventListener('keydown', async e => {
    if (e.key === 'Escape') { renderPath(); return; }
    if (e.key === 'Enter' && input.value.trim()) {
      const { error } = await db.from('actions').insert({ tenant_id:state.tenant.id, project_id:state.path.projectId, title:input.value.trim(), estimated_minutes:30 });
      if (error) return toast(error.message);
      await loadAll(); renderAll(); toast('Action rangée dans le projet.');
    }
  });
}

async function saveQuickIdea(event) {
  event.preventDefault();
  const input = $('#idea-quick-input'); const text = input.value.trim(); if (!text) return;
  const [title,...rest] = text.split('\n');
  const { error } = await db.from('ideas').insert({ tenant_id:state.tenant.id, title:title.slice(0,180), description:rest.join('\n').trim() || null, review_after:addDays(isoToday(),7) });
  if (error) return toast(error.message);
  input.value = ''; await loadAll(); renderIdeas(); toast('Idée rangée. Tu peux la laisser ici.');
}

async function saveEnergyCheckin(level) {
  const payload = { tenant_id:state.tenant.id,user_id:state.session.user.id,checkin_date:isoToday(),energy_level:level };
  const { data, error } = await db.from('daily_checkins').upsert(payload,{onConflict:'tenant_id,user_id,checkin_date'}).select().single();
  if (error) return toast('Installe la migration 02 pour activer le point énergie.');
  state.checkin = data; renderToday();
}

function openEntityEditor(type) {
  const labels = {
    domain:['CE QUI COMPTE','Nouveau domaine','Un grand espace de vie ou de travail.'],
    objective:['CE QUE JE VEUX ATTEINDRE','Nouvel objectif','Un résultat visible, pas encore une liste de tâches.'],
    axis:['LE CHEMIN CHOISI','Nouvel axe','Un chemin stratégique pour avancer vers l’objectif.'],
    project:['CE QUE JE CONSTRUIS','Nouveau projet','Un résultat concret avec un début et une fin.'],
  };
  const [overline,title,helper] = labels[type] || labels.project;
  $('#editor-overline').textContent = overline; $('#editor-title').textContent = title; $('#editor-helper').textContent = helper;
  let fields = `<label>Nom<input name="title" required autofocus /></label>`;
  if (type === 'domain') fields += `<label>En une phrase<textarea name="description" rows="2"></textarea></label><label>Couleur<select name="color">${palette.map((c,i)=>`<option value="${c}">Couleur ${i+1}</option>`).join('')}</select></label>`;
  if (type === 'objective') fields += `<label>Résultat visible<textarea name="success_metric" rows="2"></textarea></label><label>Date cible<input name="target_date" type="date" /></label>`;
  if (type === 'axis') fields += `<label>À quoi sert ce chemin ?<textarea name="description" rows="2"></textarea></label>`;
  if (type === 'project') fields += `<label>Résultat attendu<textarea name="description" rows="2"></textarea></label><label>Date cible<input name="target_date" type="date" /></label>`;
  fields += `<div class="context-help" data-guide-option="help-${type}" role="button" tabindex="0">Je ne sais pas encore comment le formuler. M’aider à clarifier.</div>`;
  $('#editor-fields').innerHTML = fields;
  $('#simple-editor').showModal();
  $('#simple-editor-form').onsubmit = async event => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { tenant_id:state.tenant.id };
    let table = '';
    if (type === 'domain') { table='domains'; Object.assign(payload,{name:values.title,description:values.description||null,color:values.color||palette[state.domains.length%palette.length],icon:icons.default}); }
    if (type === 'objective') { table='objectives'; Object.assign(payload,{domain_id:state.path.domainId,title:values.title,success_metric:values.success_metric||null,target_date:values.target_date||null}); }
    if (type === 'axis') { table='axes'; Object.assign(payload,{objective_id:state.path.objectiveId,title:values.title,description:values.description||null}); }
    if (type === 'project') { table='projects'; Object.assign(payload,{objective_id:state.path.objectiveId,axis_id:state.path.axisId,title:values.title,description:values.description||null,target_date:values.target_date||null,status:'planned'}); }
    const { data, error } = await db.from(table).insert(payload).select().single();
    if (error) return toast(error.message);
    $('#simple-editor').close(); await loadAll(); navigateTo(type,data.id); renderAll();
  };
}

function handleProfileAction(action) {
  $('#profile-sheet').close();
  if (action === 'logout') return db.auth.signOut();
  if (action === 'settings') { refreshProviderStatus(); return $('#settings-dialog').showModal(); }
  if (action === 'review') return openReview();
  if (action === 'proposals') return openLatestProposal();
}

async function saveSettings(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const payload = { name:values.name.trim(), weekly_capacity_minutes:Number(values.weekly_capacity_minutes||600), daily_focus_limit:Math.min(3,Number(values.daily_focus_limit||3)), ai_enabled:event.currentTarget.elements.ai_enabled.checked, ai_provider_preference:values.ai_provider_preference || 'groq' };
  const { data, error } = await db.from('tenants').update(payload).eq('id',state.tenant.id).select().single();
  if (error) return toast(error.message);
  state.tenant = {...state.tenant,...data}; $('#settings-dialog').close(); await refreshProviderStatus(); renderAll(); toast('Réglages enregistrés.');
}

function openReview() {
  const start = addDays(isoToday(), -6);
  const period = state.actions.filter(a => (a.planned_date && a.planned_date >= start && a.planned_date <= isoToday()) || (a.completed_at && a.completed_at.slice(0,10) >= start));
  const done = period.filter(a => a.status === 'done').length;
  const overdue = state.actions.filter(a => a.status !== 'done' && a.due_date && a.due_date < isoToday()).length;
  const repeated = state.actions.filter(a => Number(a.report_count||0) >= 3 && a.status !== 'done');
  const domainMinutes = state.domains.map(d => {
    const objectiveIds = state.objectives.filter(o=>o.domain_id===d.id).map(o=>o.id);
    const projectIds = state.projects.filter(p=>objectiveIds.includes(p.objective_id)).map(p=>p.id);
    return { name:d.name, minutes:period.filter(a=>projectIds.includes(a.project_id)).reduce((s,a)=>s+Number(a.actual_minutes||a.estimated_minutes||0),0) };
  }).sort((a,b)=>b.minutes-a.minutes);
  $('#review-content').innerHTML = `
    <div class="review-stat"><span>Actions terminées</span><strong>${done}</strong></div>
    <div class="review-stat"><span>Actions prévues</span><strong>${period.length}</strong></div>
    <div class="review-stat"><span>En retard</span><strong>${overdue}</strong></div>
    <div class="review-stat"><span>Reportées 3 fois</span><strong>${repeated.length}</strong></div>
    <div class="review-narrative"><strong>${domainMinutes[0]?.name ? `Tu as surtout avancé sur ${esc(domainMinutes[0].name)}.` : 'Ta semaine est encore légère.'}</strong><p>${repeated.length ? `${esc(repeated[0].title)} revient souvent. Elle mérite d’être réduite, déplacée ou supprimée.` : 'Garde trois priorités maximum pour la semaine suivante.'}</p>${state.tenant.ai_enabled ? '<div class="choice-chip" data-guide-option="weekly_review" role="button" tabindex="0">M’aider à comprendre cette semaine</div>' : ''}</div>`;
  $('#review-dialog').showModal();
}

function maybeOpenOnboarding() {
  if (state.domains.length > 0 || sessionStorage.getItem('ikigai_onboarding_skipped')) return;
  setTimeout(() => openGuide({ mode:'intro' }), 250);
}

function openGuide(guide) {
  state.guide = { answers:{}, ...guide };
  renderGuide(); $('#guide-dialog').showModal();
}

function renderGuide() {
  const g = state.guide || { mode:'intro' };
  let html = '';
  if (g.mode === 'intro') html = `<p class="overline soft">COMMENÇONS SIMPLEMENT</p><h2>Qu’est-ce qui t’aiderait maintenant ?</h2><p>Tu n’as pas besoin d’avoir déjà les bons mots.</p><div class="guide-options"><article class="guide-option" data-guide-option="goal"><strong>Je sais ce que je veux atteindre</strong><small>Aide-moi à transformer cette envie en chemin clair.</small></article><article class="guide-option" data-guide-option="brain-dump"><strong>J’ai besoin de remettre de l’ordre</strong><small>Je vais tout vider, puis nous choisirons une seule priorité.</small></article><article class="guide-option" data-guide-option="manual"><strong>Je préfère construire seul</strong><small>Je commencerai avec un domaine vide.</small></article></div>`;
  if (g.mode === 'goal_text') html = guideQuestion('Qu’aimerais-tu vraiment changer ?', 'Écris avec tes mots, même si c’est encore vague.', 'goal_text', 'Ex. Je veux être plus libre professionnellement.');
  if (g.mode === 'victory') html = guideQuestion('Quelle serait une première victoire visible ?', 'Une preuve simple que les choses ont réellement avancé.', 'victory', 'Ex. Obtenir mon premier client payant.');
  if (g.mode === 'horizon') html = `<p class="overline soft">UN HORIZON, PAS UNE PRESSION</p><h2>Quand aimerais-tu constater un vrai changement ?</h2><div class="guide-options">${[['month','Dans un mois','Pour une première victoire courte.'],['quarter','Dans trois mois','Pour installer une vraie progression.'],['year','Cette année','Pour une transformation structurante.'],['later','Plus tard','La date peut rester souple.']].map(([v,t,s])=>`<article class="guide-option" data-guide-option="horizon:${v}"><strong>${t}</strong><small>${s}</small></article>`).join('')}</div>`;
  if (g.mode === 'capacity') html = `<p class="overline soft">UNE CAPACITÉ RÉALISTE</p><h2>Combien de temps peux-tu réellement y consacrer ?</h2><div class="guide-options">${[['60','Moins d’une heure par semaine','Commençons très petit.'],['180','1 à 3 heures','Un rythme léger et régulier.'],['360','3 à 6 heures','Une progression soutenue.'],['600','Plus de 6 heures','Un projet important de la période.']].map(([v,t,s])=>`<article class="guide-option" data-guide-option="capacity:${v}"><strong>${t}</strong><small>${s}</small></article>`).join('')}</div>`;
  if (g.mode === 'brain_dump') html = guideQuestion('Dis tout ce que tu as en tête.', 'Je vais t’aider à ranger, pas à transformer chaque pensée en projet.', 'brain_dump', 'Travail, argent, santé, projets, démarches…');
  if (g.mode === 'context_text') html = guideQuestion(g.question || 'Qu’est-ce qui te bloque ?', g.helper || 'Une phrase suffit.', 'context_text', g.placeholder || 'Écris ici…');
  if (g.mode === 'natural_question') {
    const q = g.question || {};
    html = `<div class="ai-question-card"><p class="overline soft">UNE SEULE QUESTION UTILE</p><h2>${esc(q.text || 'Peux-tu préciser ?')}</h2><p class="question-helper">${esc(q.helper || 'Choisis ce qui te ressemble le plus ou réponds avec tes mots.')}</p><div class="answer-options">${(q.choices || []).map(choice=>`<article class="answer-option" data-natural-answer="${esc(choice.id)}" data-natural-label="${esc(choice.label)}"><strong>${esc(choice.label)}</strong><small>${esc(choice.description || '')}</small></article>`).join('')}</div>${q.allow_free_text ? `<div class="free-answer"><input id="natural-free-answer" placeholder="Répondre avec mes mots…"><button type="button" class="primary-control" data-natural-free-submit="1">Continuer</button></div>` : ''}</div>`;
  }
  if (g.mode === 'natural_organize') {
    html = `<p class="overline soft">J’AI RANGÉ CE QUE TU AS DIT</p><h2>Choisissons une seule chose à rendre réelle.</h2><p>${esc(g.summary || 'Le reste restera rangé. Tu pourras y revenir plus tard.')}</p><div class="organized-groups">${(g.groups || []).map(group=>`<article class="organized-group ${group.recommended ? 'recommended' : ''}" data-natural-group="${esc(group.id)}"><h3>${esc(group.domain_title)}</h3><ul>${(group.items || []).map(item=>`<li>${esc(item)}</li>`).join('')}</ul><p>${esc(group.reason || '')}</p></article>`).join('')}</div>`;
  }
  if (g.mode === 'natural_refine') html = guideQuestion(g.question || 'Qu’est-ce qui ne te correspond pas ?', g.helper || 'Une phrase suffit.', 'natural_refine', 'Ex. Je veux moins de projets et des actions plus petites.');
  if (g.mode === 'loading') html = `<div class="guide-loading"><div class="loading-orbit"></div><h2>Je transforme tes mots en chemin.</h2><p>Je vais poser une question seulement si elle est vraiment nécessaire.</p></div>`;
  if (g.mode === 'safe') html = `<p class="overline soft">PRENONS SOIN DE TOI</p><h2>${esc(g.title || 'Cette situation mérite une aide humaine maintenant.')}</h2><p>${esc(g.message || 'L’application ne va pas transformer ce sujet en objectifs ou en tâches. Contacte une personne de confiance ou un service d’urgence local si le danger est immédiat.')}</p><div class="guide-options"><article class="guide-option" data-guide-option="close-safe"><strong>Fermer et revenir à mon espace</strong><small>Aucune donnée dangereuse n’a été transformée en plan.</small></article></div>`;
  $('#guide-step').innerHTML = html;
}

function guideQuestion(title, helper, field, placeholder) {
  const value = state.guide?.answers?.[field] || '';
  return `<p class="overline soft">UNE QUESTION À LA FOIS</p><h2>${esc(title)}</h2><p>${esc(helper)}</p><textarea class="guide-input" data-guide-field="${field}" placeholder="${esc(placeholder)}">${esc(value)}</textarea><div class="guide-next"><span class="voice-link" data-speech-guide="1" role="button" tabindex="0">◉ Parler</span><button type="button" class="primary-control" data-guide-next="1">Continuer</button></div>`;
}

async function handleGuideOption(option) {
  if (option === 'goal') { await ensureAIConsent(); state.guide.mode='goal_text'; renderGuide(); return; }
  if (option === 'brain-dump') { await ensureAIConsent(); state.guide.mode='brain_dump'; renderGuide(); return; }
  if (option === 'manual') { sessionStorage.setItem('ikigai_onboarding_skipped','1'); $('#guide-dialog').close(); openEntityEditor('domain'); return; }
  if (option.startsWith('horizon:')) { state.guide.answers.horizon=option.split(':')[1]; state.guide.mode='capacity'; renderGuide(); return; }
  if (option.startsWith('capacity:')) { state.guide.answers.capacity_minutes=Number(option.split(':')[1]); await callGuideAI('clarify_goal'); return; }
  if (option.startsWith('help-')) { $('#simple-editor').close(); await ensureAIConsent(); const type=option.slice(5); startContextGuide(type==='objective'?'clarify_goal':type==='axis'?'suggest_axes':type==='project'?'suggest_projects':'clarify_goal', state.path.level, currentContextId()); return; }
  if (option === 'weekly_review') { $('#review-dialog').close(); await callAI('weekly_review','tenant',state.tenant.id,buildReviewContext()); return; }
  if (option === 'close-safe') { $('#guide-dialog').close(); return; }
}

function handleGuideNext() {
  const input = $('#guide-step [data-guide-field]'); if (!input || !input.value.trim()) return toast('Une phrase suffit pour continuer.');
  const field = input.dataset.guideField; state.guide.answers[field] = input.value.trim();
  if (field === 'goal_text') { state.guide.mode='victory'; renderGuide(); return; }
  if (field === 'victory') { state.guide.mode='horizon'; renderGuide(); return; }
  if (field === 'brain_dump') { callGuideAI('organize_brain_dump'); return; }
  if (field === 'natural_refine') {
    const base = state.guide.proposal?.payload?.branch || {};
    const text = `Reprends ce chemin proposé : ${JSON.stringify(base)}. Corrige-le selon cette demande : ${input.value.trim()}`;
    $('#guide-dialog').close(); startNaturalIntake(text); return;
  }
  if (field === 'context_text') { callAI(state.guide.feature,state.guide.contextType,state.guide.contextId,{ ...(state.guide.contextSnapshot || buildActiveBranchContext()), user_note:input.value.trim() }); }
}

async function ensureAIConsent() {
  if (state.tenant.ai_enabled) return;
  const { data, error } = await db.from('tenants').update({ ai_enabled:true }).eq('id',state.tenant.id).select().single();
  if (!error) state.tenant = {...state.tenant,...data};
}

async function callGuideAI(feature) {
  const context = feature === 'clarify_goal'
    ? { raw_text:state.guide.answers.goal_text, visible_victory:state.guide.answers.victory, horizon:state.guide.answers.horizon, weekly_capacity_minutes:state.guide.answers.capacity_minutes }
    : { raw_text:state.guide.answers.brain_dump };
  await callAI(feature,'tenant',state.tenant.id,context);
}

function startContextGuide(feature, contextType, contextId) {
  if (!state.tenant.ai_enabled) ensureAIConsent();
  const questions = {
    suggest_axes:['Qu’est-ce qui rend cet objectif difficile à atteindre ?','Cela aidera à identifier des chemins utiles.'],
    suggest_projects:['Quel résultat concret attends-tu de cet axe ?','Nous limiterons la proposition à trois projets.'],
    suggest_actions:['Qu’est-ce qui doit être vrai quand ce projet aura avancé ?','Les actions proposées resteront petites et exécutables.'],
    split_action:['Qu’est-ce qui rend cette action difficile à commencer ?','Nous allons la rendre plus petite.'],
    analyze_blockage:['Qu’est-ce qui se passe quand tu essaies de commencer ?','L’aide ne posera aucun diagnostic.'],
  };
  const [question,helper] = questions[feature] || ['Que veux-tu clarifier ?','Une phrase suffit.'];
  openGuide({ mode:'context_text', feature, contextType, contextId, question, helper, contextSnapshot:buildActiveBranchContext() });
}

function startActionAI(feature) {
  const action = state.currentAction; if (!action) return;
  $('#action-sheet').close();
  startContextGuide(feature,'action',action.id);
}

function currentContextId() {
  return state.path.projectId || state.path.axisId || state.path.objectiveId || state.path.domainId || state.tenant.id;
}

function buildActiveBranchContext() {
  const domain = state.domains.find(d=>d.id===state.path.domainId);
  const objective = state.objectives.find(o=>o.id===state.path.objectiveId);
  const axis = state.axes.find(a=>a.id===state.path.axisId);
  const project = state.projects.find(p=>p.id===state.path.projectId);
  const action = state.currentAction;
  return {
    domain:domain && { id:domain.id,name:domain.name,description:domain.description },
    objective:objective && { id:objective.id,title:objective.title,description:objective.description,success_metric:objective.success_metric,target_date:objective.target_date },
    axis:axis && { id:axis.id,title:axis.title,description:axis.description },
    project:project && { id:project.id,title:project.title,description:project.description,target_date:project.target_date,status:project.status },
    action:action && { id:action.id,title:action.title,description:action.description,estimated_minutes:action.estimated_minutes,report_count:action.report_count },
    existing_axes: objective ? state.axes.filter(a=>a.objective_id===objective.id).map(a=>a.title) : [],
    existing_projects: axis ? state.projects.filter(p=>p.axis_id===axis.id).map(p=>p.title) : [],
    existing_actions: project ? state.actions.filter(a=>a.project_id===project.id && a.status!=='cancelled').map(a=>({title:a.title,status:a.status})) : [],
    weekly_capacity_minutes:state.tenant.weekly_capacity_minutes,
  };
}

function buildReviewContext() {
  return { ...buildActiveBranchContext(), actions:state.actions.map(a=>({title:a.title,status:a.status,planned_date:a.planned_date,due_date:a.due_date,report_count:a.report_count})), active_projects:state.projects.filter(p=>p.status==='active').map(p=>p.title) };
}

async function callAI(feature, contextType, contextId, extraContext = null) {
  await ensureAIConsent();
  state.guide = { mode:'loading', feature, contextType, contextId };
  renderGuide();
  if (!$('#guide-dialog').open) $('#guide-dialog').showModal();
  const context = extraContext || (feature === 'weekly_review' ? buildReviewContext() : buildActiveBranchContext());
  const { data, error } = await db.functions.invoke('ai-assistant', { body:{ tenant_id:state.tenant.id, feature, context_type:contextType, context_id:contextId, context } });
  if (error) { $('#guide-dialog').close(); return toast(error.message || 'L’aide intelligente est indisponible.'); }
  if (data?.blocked) {
    state.guide = { mode:'safe', title:data.title, message:data.message }; renderGuide(); return;
  }
  if (!data?.proposal) { $('#guide-dialog').close(); return toast('Aucune proposition exploitable.'); }
  state.currentProposal = data.proposal;
  $('#guide-dialog').close();
  await loadAll();
  openProposal(data.proposal);
}

function openLatestProposal() {
  $('#profile-sheet').close();
  const proposal = state.proposals[0];
  if (!proposal) return toast('Aucune proposition en attente.');
  openProposal(proposal);
}

function openProposal(proposal) {
  state.currentProposal = proposal;
  const payload = proposal.payload || {};
  $('#proposal-summary').textContent = proposal.summary || payload.summary || 'Une proposition est prête.';
  $('#proposal-preview').innerHTML = proposalPreviewHtml(proposal.feature_code,payload);
  const warnings = [...(payload.warnings || []), ...(payload.assumptions || []).map(a=>`Hypothèse : ${a}`)];
  $('#proposal-warnings').innerHTML = warnings.map(w=>`<div class="warning-note">${esc(w)}</div>`).join('');
  const positive = $('[data-proposal-action="apply"]');
  const canApply = isApplicableFeature(proposal.feature_code) && proposal.guardrail_state !== 'blocked' && !proposal.requires_professional_review;
  const isBrainDump = proposal.feature_code === 'organize_brain_dump';
  positive.classList.toggle('hidden', !canApply && !isBrainDump);
  if (isBrainDump) {
    positive.querySelector('span').textContent = 'Choisir la priorité proposée';
    positive.querySelector('small').textContent = 'Continuer avec une seule préoccupation à clarifier';
  } else {
    positive.querySelector('span').textContent = 'Ça me correspond';
    positive.querySelector('small').textContent = 'Ajouter cette proposition à mon chemin';
  }
  $('#proposal-dialog').showModal();
}

function proposalPreviewHtml(feature,payload) {
  if (feature === 'natural_intake') {
    const branch = payload.branch || {};
    const rows = [];
    if (branch.domain) rows.push(`<div class="proposal-tree-row level-0"><div class="proposal-tree-card"><strong>${esc(branch.domain.title)}</strong><small>Domaine</small></div></div>`);
    if (branch.objective) rows.push(`<div class="proposal-tree-row level-1"><span class="branch-line"></span><div class="proposal-tree-card"><strong>${esc(branch.objective.title)}</strong><small>${esc(branch.objective.success_metric || 'Objectif')}</small></div></div>`);
    (branch.axes || []).forEach(axis => {
      rows.push(`<div class="proposal-tree-row level-2"><span class="branch-line"></span><div class="proposal-tree-card"><strong>${esc(axis.title)}</strong><small>Axe</small></div></div>`);
      (axis.projects || []).forEach(project => {
        rows.push(`<div class="proposal-tree-row level-3"><span class="branch-line"></span><div class="proposal-tree-card"><strong>${esc(project.title)}</strong><small>${esc(project.outcome || 'Projet')}</small></div></div>`);
        (project.actions || []).forEach(action => rows.push(`<div class="proposal-tree-row level-4"><span class="branch-line"></span><div class="proposal-tree-card action"><strong>${esc(action.title)}</strong><small>${minuteLabel(action.estimated_minutes || 30)}${action.is_first ? ' · première action' : ''}</small></div></div>`));
      });
    });
    return `<div class="proposal-tree">${rows.join('')}</div>`;
  }
  if (feature === 'clarify_goal') {
    return `<div class="proposal-level"><strong>${esc(payload.domain?.title || 'Domaine')}</strong><small>Ce qui compte</small></div><div class="proposal-level indent-1"><strong>${esc(payload.objective?.title || 'Objectif')}</strong><small>${esc(payload.objective?.success_metric || '')}</small></div>${(payload.axes||[]).map(a=>`<div class="proposal-level indent-2"><strong>${esc(a.title)}</strong><small>${esc(a.description||'')}</small></div>`).join('')}`;
  }
  if (feature === 'organize_brain_dump') return (payload.groups||[]).map((g,i)=>`<div class="proposal-level ${i?'indent-1':''}"><strong>${esc(g.domain_title)}</strong><small>${esc((g.items||[]).join(' · '))}</small></div>`).join('');
  if (feature === 'suggest_axes') return (payload.axes||[]).map(a=>`<div class="proposal-level"><strong>${esc(a.title)}</strong><small>${esc(a.description||'')}</small></div>`).join('');
  if (feature === 'suggest_projects') return (payload.projects||[]).map(p=>`<div class="proposal-level"><strong>${esc(p.title)}</strong><small>${esc(p.outcome||p.description||'')}</small></div>`).join('');
  if (feature === 'suggest_actions' || feature === 'split_action') return (payload.actions||payload.child_actions||[]).map(a=>`<div class="proposal-level"><strong>${esc(a.title)}</strong><small>${minuteLabel(a.estimated_minutes||30)}</small></div>`).join('');
  if (feature === 'analyze_blockage') return (payload.options||[]).map(o=>`<div class="proposal-level"><strong>${esc(o.title)}</strong><small>${esc(o.reason||'')}</small></div>`).join('');
  return (payload.recommendations||payload.priorities||[]).map(r=>`<div class="proposal-level"><strong>${esc(r.title||r)}</strong><small>${esc(r.reason||'')}</small></div>`).join('');
}

function isApplicableFeature(feature) { return ['natural_intake','clarify_goal','suggest_axes','suggest_projects','suggest_actions','split_action'].includes(feature); }

async function handleProposalAction(action) {
  const proposal = state.currentProposal; if (!proposal) return;
  if (action === 'reject') {
    await db.from('ai_proposals').update({ status:'rejected',rejected_at:new Date().toISOString() }).eq('id',proposal.id);
    $('#proposal-dialog').close(); await loadAll(); renderAll(); toast('Proposition rangée sans modifier ton chemin.'); return;
  }
  if (action === 'refine') {
    $('#proposal-dialog').close();
    if (proposal.feature_code === 'natural_intake') {
      openGuide({ mode:'natural_refine', proposal, question:'Qu’est-ce qui ne te correspond pas ?', helper:'Dis-le simplement. Je reconstruirai un chemin plus juste.' });
    } else {
      openGuide({ mode:'context_text', feature:proposal.feature_code, contextType:proposal.context_type, contextId:proposal.context_id, question:'Qu’est-ce qui ne te correspond pas ?', helper:'La nouvelle proposition remplacera celle-ci.', placeholder:'Ex. Je veux moins de projets et des actions plus petites.' });
    }
    return;
  }
  if (action === 'apply') {
    if (proposal.feature_code === 'organize_brain_dump') {
      const groups = proposal.payload?.groups || [];
      const chosen = groups.find(group => group.suggested_focus) || groups[0];
      $('#proposal-dialog').close();
      state.guide = { mode:'victory', answers:{ goal_text:[chosen?.domain_title,...(chosen?.items||[])].filter(Boolean).join(' — ') } };
      renderGuide(); $('#guide-dialog').showModal();
      return;
    }
    const { data, error } = await db.rpc('apply_ai_proposal', { p_proposal:proposal.id });
    if (error) return toast(error.message);
    $('#proposal-dialog').close();
    $('#natural-intake-input').value = '';
    state.intake = { sessionId:null, rawText:'', lastProvider:null };
    await loadAll();
    if (data?.domain_id) navigateTo('domain', data.domain_id); else renderAll();
    renderAll();
    toast(`${data?.created || 0} éléments ajoutés. Ton chemin est maintenant visible.`);
  }
}

async function handleIdeaReview(ideaId) {
  const idea = state.ideas.find(i=>i.id===ideaId); if (!idea) return;
  $('#editor-overline').textContent='IDÉE RANGÉE'; $('#editor-title').textContent=idea.title; $('#editor-helper').textContent='Cette idée mérite-t-elle encore ton énergie ?';
  $('#editor-fields').innerHTML=`<div class="guide-options"><article class="guide-option" data-idea-decision="keep"><strong>La garder rangée</strong><small>Elle reviendra plus tard.</small></article><article class="guide-option" data-idea-decision="promote"><strong>En faire un objectif</strong><small>Seulement si elle remplace une vraie priorité.</small></article><article class="guide-option" data-idea-decision="reject"><strong>La laisser partir</strong><small>Elle ne te demandera plus d’attention.</small></article></div>`;
  $('#simple-editor').showModal();
  $$('[data-idea-decision]').forEach(el=>el.onclick=async()=>{
    const decision=el.dataset.ideaDecision;
    if(decision==='keep') await db.from('ideas').update({review_after:addDays(isoToday(),7)}).eq('id',idea.id);
    if(decision==='reject') await db.from('ideas').update({status:'rejected'}).eq('id',idea.id);
    if(decision==='promote'){ await db.from('ideas').update({status:'promoted'}).eq('id',idea.id); $('#simple-editor').close(); openEntityEditor('objective'); return; }
    $('#simple-editor').close(); await loadAll(); renderIdeas();
  });
}

// Delegated idea click after function definition
document.body.addEventListener('click', e => { const idea=e.target.closest('[data-idea-id]'); if(idea) handleIdeaReview(idea.dataset.ideaId); });

init().catch(error => { console.error(error); toast('Impossible de charger l’espace. Vérifie la console et les migrations Supabase.'); });

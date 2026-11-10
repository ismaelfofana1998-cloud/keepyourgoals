import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'kyg-app.js'),'utf8');
const noBootstrap=source.replace(/initialize\(\)\.catch\(error=>showAuth\(niceError\(error\)\)\);\s*$/,'');
assert.notEqual(noBootstrap,source,'Cannot remove browser bootstrap from test context');

const elements=new Map();
function element(key){
  if(!elements.has(key))elements.set(key,{
    textContent:'',innerHTML:'',value:'',disabled:false,
    classList:{toggle(){},add(){},remove(){}},
    setAttribute(){}
  });
  return elements.get(key);
}
const mockDocument={
  querySelector:element,
  querySelectorAll(){return [];}
};
const context={window:{APP_CONFIG:{}},document:mockDocument,console,Date,Intl};
const functions=vm.runInNewContext(noBootstrap+
  '\n({ state, addDaysISO, mondayISO, calendarDates, calendarPeriodLabel,'+
  ' actionCalendarDay, actionsOnCalendarDay, actionFormPayload, areaTrail, actionTrail,'+
  ' goalsForArea, milestonesForGoal, refreshActionGoalOptions, renderCalendar,'+
  ' selectCalendarDay, navigateCalendar })',context);

assert.equal(functions.mondayISO('2026-11-10'),'2026-11-09','Monday week start');
assert.equal(functions.addDaysISO('2026-12-31',1),'2027-01-01','Year rollover');
assert.equal(functions.addDaysISO('2026-03-29',1),'2026-03-30','Date shift across DST');
assert.equal(functions.calendarDates('week','2026-11-10').join(','),
  ['2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-14','2026-11-15'].join(','));
const month=functions.calendarDates('month','2026-11-10');
assert.equal(month.length,42,'Full calendar grid');
assert.equal(month[0],'2026-10-26');
assert.equal(month[41],'2026-12-06');
assert.match(functions.calendarPeriodLabel('month','2026-11-10'),/novembre 2026/);
assert.equal(functions.actionCalendarDay({planned_for:'2026-11-10',due_date:'2026-11-17'}),'2026-11-10');
assert.equal(functions.actionCalendarDay({planned_for:null,due_date:'2026-11-17'}),'2026-11-17');
assert.equal(functions.actionCalendarDay({planned_for:null,due_date:null}),null);

const st=functions.state;
st.areas=[
  {id:'personal',name:'Personnel',parent_id:null},
  {id:'learning',name:'Apprentissage',parent_id:'personal'},
  {id:'dscg',name:'DSCG',parent_id:'learning'},
  {id:'business',name:'Business',parent_id:null}
];
st.goals=[
  {id:'ue7',title:'Mémoire UE7',area_id:'dscg',status:'active'},
  {id:'ue3',title:'Réviser UE3',area_id:'dscg',status:'active'},
  {id:'sales',title:'Développer les ventes',area_id:'business',status:'paused'}
];
st.milestones=[
  {id:'m-ue7',title:'Plan agréé',goal_id:'ue7',status:'planned',horizon_months:1},
  {id:'m-ue3',title:'Premiers cas',goal_id:'ue3',status:'planned',horizon_months:1},
  {id:'m-sales',title:'Pilotes',goal_id:'sales',status:'planned',horizon_months:1}
];
assert.equal(functions.goalsForArea('learning').length,2,'Category must include descendants');
assert.equal(functions.goalsForArea('business').length,1,'Area must filter goals');
assert.equal(functions.goalsForArea('').length,3,'No filter keeps all');
assert.equal(functions.milestonesForGoal('ue7').length,1);
assert.equal(functions.areaTrail('dscg').join(' > '),'Personnel > Apprentissage > DSCG');

const valid={title:'Rédiger les résultats',goal_id:'ue7',milestone_id:'m-ue7',planned_for:'2026-11-10',due_date:'2026-11-20',status:'ready'};
const linked=functions.actionFormPayload(valid,false);
assert.equal(linked.goal_id,'ue7');
assert.equal(linked.milestone_id,'m-ue7');
assert.equal(linked.planned_for,'2026-11-10');
const independent=functions.actionFormPayload({...valid,goal_id:'',milestone_id:''},false);
assert.equal(independent.goal_id,null,'Independent task does not require a parent');
assert.equal(independent.milestone_id,null);
assert.throws(()=>functions.actionFormPayload({...valid,milestone_id:'m-ue3'},false),/n'appartient pas/,'Cross-goal milestone must be rejected');
assert.throws(()=>functions.actionFormPayload({...valid,goal_id:'',milestone_id:'m-ue7'},false),/n'appartient pas/,'Orphan milestone must be rejected');
assert.throws(()=>functions.actionFormPayload({...valid,goal_id:'sales',milestone_id:'m-sales'},true),/Activez/,'Paused objective cannot be focus');
assert.equal(functions.actionFormPayload({...valid,goal_id:'',milestone_id:''},true).is_focus,true);

element('#action-area-filter').value='learning';
functions.refreshActionGoalOptions();
assert.match(element('#action-goal').innerHTML,/ue7/);
assert.match(element('#action-goal').innerHTML,/ue3/);
assert.doesNotMatch(element('#action-goal').innerHTML,/value="sales"/);
element('#action-area-filter').value='business';
functions.refreshActionGoalOptions();
assert.match(element('#action-goal').innerHTML,/value="sales"/);
assert.doesNotMatch(element('#action-goal').innerHTML,/value="ue7"/);

st.actions=[
  {id:'a1',title:'Relire le plan',goal_id:'ue7',milestone_id:'m-ue7',planned_for:'2026-11-10',due_date:'2026-11-20',status:'ready',created_at:'2026-11-01'},
  {id:'a2',title:'Appeler le fournisseur',goal_id:null,milestone_id:null,planned_for:null,due_date:'2026-11-10',status:'done',created_at:'2026-11-02'},
  {id:'a3',title:'Préparer le dossier',goal_id:'ue3',milestone_id:null,planned_for:null,due_date:null,status:'backlog',created_at:'2026-11-03'}
];
st.calendarMode='week';
st.calendarCursor='2026-11-10';
st.selectedCalendarDate='2026-11-10';
functions.renderCalendar();
assert.equal(functions.actionsOnCalendarDay('2026-11-10').length,2,'Two tasks including due-only');
assert.equal(functions.actionsOnCalendarDay('2026-11-20').length,0,'Do not duplicate planned and deadline tasks');
assert.match(element('#calendar-grid').innerHTML,/Relire le plan/);
assert.match(element('#calendar-grid').innerHTML,/Appeler le fournisseur/);
assert.match(element('#calendar-undated-actions').innerHTML,/Préparer le dossier/);
assert.match(element('#calendar-selected-actions').innerHTML,/Relire le plan/);
functions.selectCalendarDay('2026-11-12');
assert.equal(st.selectedCalendarDate,'2026-11-12');
functions.navigateCalendar(1);
assert.equal(st.selectedCalendarDate,'2026-11-19');
st.calendarMode='month';
functions.renderCalendar();
assert.equal((element('#calendar-grid').innerHTML.match(/<div class="calendar-day(?: |")/g)||[]).length,42);
console.log('Calendrier OK — navigation, dates, 3 niveaux de cascade, tâches indépendantes et affichage partagé.');

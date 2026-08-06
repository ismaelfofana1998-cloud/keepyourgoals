import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);
const duplicates=ids.filter((x,i)=>ids.indexOf(x)!==i);
if(duplicates.length)throw new Error(`IDs dupliqués: ${[...new Set(duplicates)].join(', ')}`);
const referenced=[...js.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map(x=>x[1]);
const dynamicIds=new Set(['natural-free-answer']);
const missing=[...new Set(referenced.filter(x=>!ids.includes(x)&&!dynamicIds.has(x)))];
if(missing.length)throw new Error(`IDs absents du HTML: ${missing.join(', ')}`);
const publicText=fs.readdirSync(path.join(root,'public'),{recursive:true}).filter(x=>typeof x==='string').filter(x=>/\.(js|html|css|json|svg)$/i.test(x)).map(x=>fs.readFileSync(path.join(root,'public',x),'utf8')).join('\n');
if(/\b(sk_live_|sk_test_|sb_secret_|service_role\b|OPENAI_API_KEY\s*=|GROQ_API_KEY\s*=)/i.test(publicText))throw new Error('Clé secrète potentielle dans public/.');
if((css.match(/{/g)||[]).length!==(css.match(/}/g)||[]).length)throw new Error('Accolades CSS déséquilibrées.');
for(const file of ['sql/00_install.sql','sql/01_upgrade_from_mvp.sql','sql/02_calm_focus_ai_guardrails.sql','sql/03_natural_intake_multi_provider.sql']){
  const sql=fs.readFileSync(path.join(root,file),'utf8');
  if((sql.match(/\$\$/g)||[]).length%2)throw new Error(`Dollar quotes déséquilibrées dans ${file}`);
  if(!/commit;/i.test(sql))throw new Error(`COMMIT absent dans ${file}`);
}
for(const required of ['daily_checkins','ai_guardrail_events','apply_ai_proposal']){
  const migration=fs.readFileSync(path.join(root,'sql/02_calm_focus_ai_guardrails.sql'),'utf8');
  if(!migration.includes(required))throw new Error(`Élément de migration absent: ${required}`);
}
for(const feature of ['natural_intake','provider_status','clarify_goal','organize_brain_dump','suggest_axes','suggest_projects','suggest_actions','split_action','analyze_blockage','weekly_review']){
  const edge=fs.readFileSync(path.join(root,'supabase/functions/ai-assistant/index.ts'),'utf8');
  if(!edge.includes(feature))throw new Error(`Fonction IA absente: ${feature}`);
}
const edge=fs.readFileSync(path.join(root,'supabase/functions/ai-assistant/index.ts'),'utf8');
for(const required of ['api.groq.com/openai/v1','ai_intake_sessions','ai_provider_preference']) if(!edge.includes(required)) throw new Error(`Support multi-moteur absent: ${required}`);
console.log(`Smoke tests OK — ${ids.length} IDs, ${referenced.length} références DOM.`);

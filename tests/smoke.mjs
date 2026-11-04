import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root,file), 'utf8');
const html=read('index.html'), app=read('kyg-app.js'), css=read('kyg.css'), config=read('config.js');
const manifest=JSON.parse(read('manifest.webmanifest'));

new vm.Script(app,{filename:'kyg-app.js'});
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate HTML ids');
const references=[...app.matchAll(/\$\(["']#([A-Za-z0-9_-]+)["']\)/g)].map(match=>match[1]);
const absent=[...new Set(references.filter(id=>!ids.includes(id)))];
assert.deepEqual(absent,[],'Missing HTML selectors');
assert.match(html, /src="\.\/config\.js\?v=/);
assert.match(html, /src="\.\/kyg-app\.js\?v=/);
assert.match(html, /href="\.\/kyg\.css\?v=/);
assert.match(html, /@supabase\/supabase-js@2\.\d+\.\d+/);
assert.match(config,/mzxgpdwjklvoqsjclrtz\.supabase\.co/);
assert.match(config,/sb_publishable_/);
assert.doesNotMatch(config,/nyjgrpmpxajlgknlxykm/);
assert.doesNotMatch(config,/sb_secret_|service_role|sk_live_|OPENAI_API_KEY|GROQ_API_KEY/);
assert.doesNotMatch(app,/\btenant_members\b|\bbootstrap_personal_tenant\b/);
for(const table of ['kyg_workspaces','kyg_areas','kyg_goals','kyg_milestones','kyg_actions','kyg_ideas'])
  assert.ok(app.includes(table),table+' missing from frontend');
assert.match(app,/state\.client\.auth\.signUp\(/);
assert.match(app,/state\.client\.auth\.signInWithPassword\(/);
assert.match(app,/owner_user_id:userId/);
assert.match(app,/Failed to fetch/i);
assert.equal(manifest.name,'KeepYourGoals');
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,'Unbalanced CSS braces');
const forbidden=/\b(sb_secret_[\w-]+|service_role\s*[:=]\s*['"]|sk_live_[\w-]+|OPENAI_API_KEY\s*=|GROQ_API_KEY\s*=)/i;
for(const file of ['index.html','kyg-app.js','kyg.css','config.js'])
  assert.doesNotMatch(read(file),forbidden,file+' may expose a private credential');

// Legacy assets remain in Git history; the live entrypoint is the new model.
assert.doesNotMatch(html,/src="\.\/app\.js/);
assert.doesNotMatch(html,/public\/app\.js/);
console.log('KYG static smoke OK:',ids.length,'HTML IDs;',references.length,'selectors;',manifest.name);

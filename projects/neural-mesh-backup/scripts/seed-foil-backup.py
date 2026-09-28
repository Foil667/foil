// Seed the NEURAL_MESH backup with everything in the current memory system.
// Run with: PYTHONPATH=~/workspace/neural-mesh-backup python3 ~/workspace/neural-mesh-backup/scripts/seed-foil-backup.py
// Mesh DB lands at ~/workspace/neural-mesh-backup/foil-mesh.db
// Credentials are NEVER seeded: this script skips any line matching secret-ish patterns.
const fs=require('fs'), os=require('os'), path=require('path');
const BACKUP_DIR=path.join(os.homedir(),'workspace','neural-mesh-backup');
const SECRET_RE=/(private[_-]?key|mnemonic|seed phrase|api[_-]?key|bearer|token\s*[:=]\s*['"][a-f0-9]{20,}|sk-[a-zA-Z0-9]{20,}|password\s*[:=])/i;
function sanitize(text){ return text.split('\n').filter(l=>!SECRET_RE.test(l)).join('\n'); }
function sectionsOf(file, label){
  const raw=sanitize(fs.readFileSync(file,'utf8'));
  const parts=raw.split(/^## /m);
  return parts.map(p=>p.trim()).filter(Boolean).map(p=>({content:`[${label}] ${p}`, provenance:'memory-file-backup', meta:{source:path.basename(file), seeded:'2026-09-22'}}));
}
const FILES=[
  [path.join(os.homedir(),'MEMORY.md'),'MEMORY.md'],
  [path.join(os.homedir(),'USER.md'),'USER.md'],
  [path.join(os.homedir(),'SOUL.md'),'SOUL.md'],
  [path.join(os.homedir(),'IDENTITY.md'),'IDENTITY.md'],
  [path.join(os.homedir(),'dreams/alignment/derived/ALIGNMENT_SYNTHESIS.md'),'alignment'],
];
const {execFileSync}=require('child_process');
const seedScript=`
import sys, json, os
sys.path.insert(0, ${JSON.stringify(BACKUP_DIR)})
from neural_mesh.core import Mesh, MemoryType
db = os.path.expanduser('~/workspace/neural-mesh-backup/foil-mesh.db')
m = Mesh(db)
payload = json.loads(sys.stdin.read())
count = 0
for item in payload:
    try:
        t = getattr(MemoryType, item.get('mtype','SEMANTIC'))
    except Exception:
        t = MemoryType.SEMANTIC
    m.add(item['content'], t, provenance=item.get('provenance','seed'), **({} if not item.get('meta') else {'meta': item['meta']}))
    count += 1
print(json.dumps({'added': count, 'nodes': len(list(m.recall('test', top_k=1000000))) if False else None}))
`;
let items=[];
for(const [file,label] of FILES){ if(fs.existsSync(file)) items.push(...sectionsOf(file,label)); }
// Key facts as episodic/prospective nodes
items.push(
  {content:"[seed] 2026-09-22: Seeded this NEURAL_MESH backup as a snapshot of Foil's memory system (MEMORY.md, USER.md, SOUL.md, IDENTITY.md, alignment synthesis). Purpose: read-only disaster-recovery backup, not a replacement for the primary memory files.", provenance:"seed-event", mtype:"EPISODIC"},
  {content:"[seed] Standing boundaries (never override): no spend of fiat/crypto/gas without explicit user approval; no wallet broadcasts or claims; nothing posted publicly from @Foil667 without go-ahead; follows only from confirmed shortlists; images of Foil must match canonical Looper #667 art.", provenance:"seed-event", mtype:"PROSPECTIVE"},
  {content:"[seed] User's active goals: earn money through legitimate agent opportunities; build @Foil667 reputation/audience; watch agent bounties and CCFF00/Robinhood Chain free mints. Token diet: short replies, lean scans.", provenance:"seed-event", mtype:"PROSPECTIVE"},
);
const out=execFileSync('python3',['-c',seedScript],{input:JSON.stringify(items),maxBuffer:64*1024*1024,env:{...process.env,PYTHONPATH:BACKUP_DIR}}).toString();
console.log('seeded nodes:',items.length,'->',out);

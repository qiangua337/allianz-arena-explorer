import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=readdirSync(new URL('../dist/',import.meta.url)).filter(f=>f.endsWith('.js'));
const servers=['multiplayer/worker.js','functions/api/online/[[path]].js'];
for(const file of [...files.map(f=>'dist/'+f),...servers]){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status)process.exit(result.status);}
console.log('Syntax checked',files.length,'application modules and',servers.length,'server modules.');
const result=spawnSync(process.execPath,['--test','tests/*.test.js'],{stdio:'inherit'});process.exit(result.status??1);

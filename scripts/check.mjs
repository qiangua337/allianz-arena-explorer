import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=readdirSync(new URL('../dist/',import.meta.url)).filter(f=>f.endsWith('.js'));
for(const file of files){const result=spawnSync(process.execPath,['--check','dist/'+file],{stdio:'inherit'});if(result.status)process.exit(result.status);}
console.log('Syntax checked',files.length,'application modules.');
const result=spawnSync(process.execPath,['--test','tests/*.test.js'],{stdio:'inherit'});process.exit(result.status??1);

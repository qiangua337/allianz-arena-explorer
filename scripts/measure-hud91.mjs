import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {hudFixture} from '../tests/helpers/hud91.mjs';
const baseline=process.argv[2]||'4b8744b',output=process.argv[3];
const previous=execFileSync('git',['show',baseline+':dist/playable-match.js'],{encoding:'utf8'}).replace(/from '\.\/([^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../dist/'+path,import.meta.url).href));
const {buildPlayableMatch}=await import('data:text/javascript;base64,'+Buffer.from(previous).toString('base64'));
function measure(builder){const f=hudFixture(builder);f.game.start({training:'free'});f.game.ready();f.run(1);f.resetWrites();f.run(10);const s=f.game.state;return{writes:f.writes,byField:f.writeStats,state:{time:s.time,phase:s.phase,score:s.score,ball:s.ball,controlledId:s.controlledId}};}
const before=measure(buildPlayableMatch),after=measure();if(JSON.stringify(before.state)!==JSON.stringify(after.state))throw Error('Game state changed');
const result={baseline,frames:300,rate:30,seconds:10,before,after,stateIdentical:true,note:'Counts DOM property, attribute and dataset setter calls from the real HUD with a deterministic DOM fixture. It does not measure physical mobile FPS.'};
if(output)await fs.writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify({before:before.writes,after:after.writes,stateIdentical:true}));

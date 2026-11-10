import test from 'node:test';
import assert from 'node:assert/strict';
import {hudFixture} from './helpers/hud91.mjs';
test('an idle real training HUD avoids repeated DOM mutations while its live clock still advances',()=>{
 const f=hudFixture();f.game.start({training:'free'});f.game.ready();f.run(1);f.resetWrites();const time=f.game.state.time;f.run(10);
 assert.ok(f.writes<300,'ten seconds of unchanged controls should not rewrite the entire HUD: '+f.writes);assert.ok(f.game.state.time>time+9.9);assert.equal(f.node('training-title').textContent,'自由热身');
 f.node('training-title').textContent='外部临时修改';f.run(.2);assert.equal(f.node('training-title').textContent,'自由热身','the writer reads live DOM, so shared panels cannot leave a stale cached label');
});
test('guarded HUD writes still reflect a real pass, possession change, pause, resume and leaving',()=>{
 const f=hudFixture();f.game.start({training:'passing'});f.game.ready();assert.equal(f.game.action('pass'),true);f.run(2.5);assert.equal(f.node('training-progress').textContent,'1 / 5');assert.ok(f.node('training-feedback').textContent.includes('传接成功'));f.game.setPaused(true);assert.equal(f.node('game-overlay-title').textContent,'训练已暂停');assert.equal(f.node('game-overlay').hidden,false);f.node('game-resume').onclick();assert.equal(f.node('game-overlay').hidden,true);f.game.exit();assert.equal(f.node('game-ui').hidden,true);
});

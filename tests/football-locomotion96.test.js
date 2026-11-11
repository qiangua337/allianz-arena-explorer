import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';

registerHooks({resolve(specifier, context, next) {
  return specifier === 'three'
    ? {url: new URL('../dist/vendor/three.module.js', import.meta.url).href, shortCircuit: true}
    : next(specifier, context);
}});

const {THREE} = await import('../dist/kit.js');
const {createFootballMotion} = await import('../dist/football-motion.js');
const {applyFootballAction} = await import('../dist/football-action-pose.js');
const {createFootballSimulation} = await import('../dist/football-simulation.js');
const assets = new URL('../dist/assets/players/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('footballer-960.json', assets)));
const clips = JSON.parse(readFileSync(new URL('walk-cycle.json', assets)));
const mesh = readFileSync(new URL('footballer-960.bin', assets));
const boots = manifest.parts.filter(part => part.name.startsWith('boot')).map(part =>
  new Float32Array(mesh.buffer, mesh.byteOffset + part.offset, part.vertices * 16));
const bindInverse = manifest.bones.map(({head}) => new THREE.Matrix4().makeTranslation(-head[0], -head[1], -head[2]));
const field = {fieldLocomotion: true};

function fixture(phase = 0, height = 1.86) {
  const group = new THREE.Group();
  const bones = manifest.bones.map(() => new THREE.Bone());
  manifest.bones.forEach((bone, i) => {
    const parent = manifest.bones[bone.parent];
    (parent ? bones[bone.parent] : group).add(bones[i]);
    bones[i].position.fromArray(bone.head);
    if (parent) bones[i].position.sub(new THREE.Vector3().fromArray(parent.head));
  });
  const motion = createFootballMotion(manifest, clips, bones, group, {height, phase, role: 'player'});
  const matrices = bones.map(() => new THREE.Matrix4());
  const point = new THREE.Vector3();
  const transformed = new THREE.Vector3();
  function bootHeights() {
    bones.forEach((bone, i) => matrices[i].copy(bone.matrixWorld).multiply(bindInverse[i]));
    return boots.map(vertices => {
      let lowest = Infinity;
      for (let i = 0; i < vertices.length; i += 16) {
        point.set(0, 0, 0);
        for (let j = 0; j < 4; j++) {
          const weight = vertices[i + 12 + j];
          if (weight) point.addScaledVector(transformed.fromArray(vertices, i).applyMatrix4(matrices[vertices[i + 8 + j]]), weight);
        }
        lowest = Math.min(lowest, point.y);
      }
      return lowest;
    });
  }
  const position = i => bones[i].getWorldPosition(new THREE.Vector3());
  return {group, bones, pose: motion.pose, reset: motion.reset, bootHeights, position};
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

function steadyGait(hz, speed, phase, enhanced) {
  const actor = fixture(phase, phase ? 1.78 : 1.92);
  const slip = [];
  let previous;
  let lowest = Infinity;
  for (let frame = 0; frame < hz * 5; frame++) {
    const time = frame / hz;
    const z = time * speed;
    actor.pose(1, z, 0, time, true, 0, false, enhanced ? field : undefined);
    assert.deepEqual(actor.group.position.toArray(), [1, 0, z]);
    const row = {heights: actor.bootHeights(), feet: [actor.position(11), actor.position(17)]};
    lowest = Math.min(lowest, ...row.heights);
    if (frame > hz * 2) {
      for (const side of [0, 1]) {
        if (row.heights[side] < .045 && previous.heights[side] < .045) {
          slip.push(Math.hypot(row.feet[side].x - previous.feet[side].x, row.feet[side].z - previous.feet[side].z) * hz);
        }
      }
    }
    previous = row;
  }
  return {median: percentile(slip, .5), tail: percentile(slip, .9), count: slip.length, lowest};
}

test('field walking and jogging plant the actual skinned boots in forward and reverse travel', () => {
  const rows = [];
  for (const hz of [60, 30, 12]) for (const speed of [-3.1, -1.65, 1.65, 3.1]) for (const phase of [0, 1.9]) {
    const old = steadyGait(hz, speed, phase, false);
    const current = steadyGait(hz, speed, phase, true);
    rows.push({hz, speed, phase, old, current});
    assert.ok(current.lowest > -.001 && current.count > hz / 2, JSON.stringify(rows.at(-1)));
    assert.ok(current.median < .20, JSON.stringify(rows.at(-1)));
    assert.ok(current.tail < .30, JSON.stringify(rows.at(-1)));
  }
  assert.ok(percentile(rows.map(row => row.current.median), .5) < percentile(rows.map(row => row.old.median), .5) * .35);
  if (process.env.ARENA_LOCOMOTION_METRICS === '1') console.log(JSON.stringify(rows));
});

test('the field pose stays grounded and continuous through acceleration, direction changes and stop', () => {
  for (const hz of [60, 30, 12]) for (const turnDirection of [-1, 1]) {
    const actor = fixture(1.1);
    let x = 0;
    let z = -14;
    let previous;
    let largestFootTravel = 0;
    for (let frame = 0; frame <= hz * 7; frame++) {
      const time = frame / hz;
      const speed = time < 1 ? 6.7 * time : time < 3 ? 6.7 : Math.max(0, 6.7 * (4.25 - time) / 1.25);
      const heading = Math.min(Math.PI * .9, Math.max(0, time - 1) * 1.6) * turnDirection;
      x += Math.sin(heading) * speed / hz;
      z += Math.cos(heading) * speed / hz;
      actor.pose(x, z, heading, time, speed > .16, 0, false, field);
      const heights = actor.bootHeights();
      assert.ok(Math.min(...heights) > -.001, JSON.stringify({hz, turnDirection, time, heights}));
      const positions = [0, 5, 8, 11, 14, 17].map(actor.position);
      if (previous) {
        const displacements = positions.map((point, i) => point.distanceTo(previous[i]));
        assert.ok(Math.max(...displacements) < (hz === 12 ? 1.55 : hz === 30 ? .85 : .48), JSON.stringify({hz, turnDirection, time, displacements}));
        largestFootTravel = Math.max(largestFootTravel, displacements[3], displacements[5]);
      }
      for (const bone of actor.bones) assert.ok(Math.abs(bone.quaternion.length() - 1) < 1e-5);
      previous = positions;
    }
    actor.pose(12, 8, 0, .25, false, 0, false, field);
    assert.ok([11, 17].every(i => actor.position(i).distanceTo(actor.group.position) < .45));
    if (process.env.ARENA_LOCOMOTION_METRICS === '1') console.log(JSON.stringify({hz, turnDirection, largestFootTravel}));
  }
});

test('a field player can side-step and retreat without losing the walking sole as travel crosses the facing axis', () => {
  for (const hz of [60, 30, 12]) {
    const actor = fixture(.7);
    let x = 0;
    let z = 0;
    let previous;
    for (let frame = 0; frame <= hz * 8; frame++) {
      const time = frame / hz;
      const direction = time * Math.PI / 2;
      x += Math.sin(direction) * 2 / hz;
      z += Math.cos(direction) * 2 / hz;
      actor.pose(x, z, 0, time, true, 0, false, field);
      const feet = [actor.position(11), actor.position(17)];
      assert.ok(Math.min(...actor.bootHeights()) > -.001, JSON.stringify({hz, time}));
      if (previous) assert.ok(feet.every((foot, side) => foot.distanceTo(previous[side]) < (hz === 12 ? .80 : hz === 30 ? .40 : .23)), JSON.stringify({hz, time, step: feet.map((foot, side) => foot.distanceTo(previous[side]))}));
      previous = feet;
    }
  }
});

test('running on the ball changes the trunk and arm carriage while keeping the same actual feet', () => {
  const carrying = fixture(1.6);
  const running = fixture(1.6);
  for (let frame = 0; frame < 135; frame++) {
    const time = frame / 30;
    const x = time * 3.9;
    carrying.pose(x, 2, Math.PI / 2, time, true, 0, false, {...field, onBall: frame < 90});
    running.pose(x, 2, Math.PI / 2, time, true, 0, false, field);
    assert.deepEqual(carrying.position(11).toArray(), running.position(11).toArray());
    assert.deepEqual(carrying.position(17).toArray(), running.position(17).toArray());
    if (frame === 65) {
      assert.ok(carrying.bones[2].quaternion.angleTo(running.bones[2].quaternion) > .02);
      assert.ok(carrying.bones[7].quaternion.angleTo(running.bones[7].quaternion) > .15);
      assert.ok(carrying.bones[13].quaternion.angleTo(running.bones[13].quaternion) > .15);
    }
  }
  assert.ok(carrying.bones[7].quaternion.angleTo(running.bones[7].quaternion) < .01);
});

test('running into a low pass preserves left support and blends into the carry through the actual trap pose', () => {
  let plantedSamples = 0;
  for (const hz of [60, 30, 12]) for (const phase of [0, .7, 1.9, 3.7]) for (const heading of [0, Math.PI]) {
    const actor = fixture(phase);
    const running = fixture(phase);
    const contactTime = 1.5;
    const duration = .26;
    const travel = Math.cos(heading);
    let z = 0;
    let previous = null;
    let lowered = 0;
    for (let frame = 0; frame < hz * 3; frame++) {
      const time = frame / hz;
      const speed = time < 1.25 ? 5.1 : time < contactTime ? 5.1 - (time - 1.25) * 9.2 : Math.min(4.5, 2.8 + (time - contactTime) * 4);
      z += speed / hz * travel;
      const onBall = time >= contactTime;
      const incomingBall = !onBall ? {x: 0, y: .11, z: z + (.64 + (contactTime - time) * 9) * travel, vx: 0, vz: -4.8 * travel} : null;
      const action = onBall && time < contactTime + duration ? {type: 'trap', elapsed: time - contactTime, duration} : null;
      const options = {...field, incomingBall, action, onBall};
      actor.pose(0, z, heading, time, true, 0, true, options);
      if (action) applyFootballAction(actor.bones, action, options, actor.group);
      actor.group.updateMatrixWorld(true);
      running.pose(0, z, heading, time, true, 0, false, {...field, onBall});
      assert.deepEqual(actor.group.position.toArray(), [0, 0, z]);
      const heights = actor.bootHeights();
      assert.ok(Math.min(...heights) > -.001, JSON.stringify({hz, phase, heading, time, heights}));
      const feet = [actor.position(11), actor.position(17)];
      if (!onBall) lowered = Math.max(lowered, running.bones[0].position.y - actor.bones[0].position.y);
      if (previous && time >= contactTime && time < contactTime + duration) {
        const delta = feet.map((foot, i) => foot.distanceTo(previous[i]));
        assert.ok(Math.max(...delta) < (hz === 12 ? 1.1 : hz === 30 ? .64 : .37), JSON.stringify({hz, phase, heading, time, delta}));
        const normal = running.position(11);
        if (heights[0] < .045 && running.bootHeights()[0] < .045) {
          assert.ok(Math.hypot(feet[0].x - normal.x, feet[0].z - normal.z) < .085, JSON.stringify({hz, phase, heading, time}));
          plantedSamples++;
        }
      }
      previous = feet;
    }
    assert.ok(lowered > .01, 'an arriving pass produces a visible loaded posture before possession');
    assert.ok(actor.bones[7].quaternion.angleTo(running.bones[7].quaternion) < .01, 'same carried posture after the receive has recovered');
  }
  assert.ok(plantedSamples >= 40, 'retains the left support phase where a running stride was already planted');
});

test('a pass moving away or above boot reach does not preload the running pose', () => {
  const normal = fixture();
  const passing = fixture();
  for (let frame = 0; frame < 90; frame++) {
    const time = frame / 30;
    const z = time * 4;
    const incomingBall = {x: 0, y: frame < 45 ? 1.3 : .11, z: z + 1.1, vx: 0, vz: frame < 45 ? -6 : 7};
    normal.pose(0, z, 0, time, true, 0, false, field);
    passing.pose(0, z, 0, time, true, 0, false, {...field, incomingBall});
    assert.deepEqual(passing.bones[0].position.toArray(), normal.bones[0].position.toArray());
    assert.deepEqual(passing.bones[6].quaternion.toArray(), normal.bones[6].quaternion.toArray());
  }
});

test('a simulated pass reaches its moving receiver and leaves their next running step available', () => {
  for (const type of ['pass', 'through']) {
    const game = createFootballSimulation();
    for (let i = 0; i < 185; i++) game.update(1 / 60);
    const state = game.state;
    const passer = state.players.find(player => player.id === state.controlledId);
    const receiver = state.players.find(player => player.id === 'home-8');
    for (const player of state.players) {
      if (player !== passer && player !== receiver) Object.assign(player, {x: 29, z: 44, vx: 0, vz: 0, decisionAt: 1e9, tackleAt: 1e9});
    }
    Object.assign(receiver, {x: 1, z: -12, vx: 0, vz: -2.8, yaw: Math.PI});
    assert.equal(game.action(type, {direction: {x: 0, z: -1}}), true);
    assert.equal(state.ball.targetId, receiver.id);
    const actor = fixture(1.2);
    const natural = fixture(1.2);
    let receivedAt = null;
    let approachLowering = 0;
    let carriedDistance = 0;
    for (let i = 0; i < 210; i++) {
      game.update(1 / 60, receivedAt ? {x: 0, z: -1, sprint: true} : {});
      const onBall = state.ball.ownerId === receiver.id;
      if (onBall && receivedAt === null) {
        receivedAt = {time: state.time, z: receiver.z};
        assert.equal(receiver.motion?.type, 'trap');
        assert.equal(state.controlledId, receiver.id);
      }
      const moving = Math.hypot(receiver.vx, receiver.vz) > .16;
      const options = {...field, incomingBall: state.ball.targetId === receiver.id ? state.ball : null, action: receiver.motion, onBall};
      actor.pose(receiver.x, receiver.z, receiver.yaw, state.time, moving, 0, true, options);
      if (receiver.motion) applyFootballAction(actor.bones, receiver.motion, options, actor.group);
      actor.group.updateMatrixWorld(true);
      natural.pose(receiver.x, receiver.z, receiver.yaw, state.time, moving, 0, false, field);
      assert.deepEqual(actor.group.position.toArray(), [receiver.x, 0, receiver.z]);
      assert.ok(Math.min(...actor.bootHeights()) > -.001, JSON.stringify({type, time: state.time}));
      if (!onBall && !receivedAt) approachLowering = Math.max(approachLowering, natural.bones[0].position.y - actor.bones[0].position.y);
      if (receivedAt && state.time - receivedAt.time > .55) {
        assert.ok(onBall, 'the carried ball remains attached to the runner');
        carriedDistance = receivedAt.z - receiver.z;
        break;
      }
    }
    assert.ok(receivedAt && approachLowering > .004 && carriedDistance > 1.1, JSON.stringify({type, receivedAt, approachLowering, carriedDistance}));
  }
});

import {THREE} from './kit.js';

function smooth(start, end, value) {
 const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
 return t * t * (3 - 2 * t);
}

function bell(center, width, value) {
 const t = (value - center) / width;
 return Math.exp(-t * t);
}

// The shared head faces +Z. Move the skin, face and eye area in the same
// rest space so their seams and eyelids remain aligned through head turns.
export function sculptMusiala(x, y, z, target) {
 const neck = smooth(1.60, 1.649, y);
 if (!neck) return target.set(x, y, z);
 const side = Math.abs(x);
 const front = smooth(.054, .131, z);
 const profile = smooth(.112, .157, z);

 // Taper the jaw below the cheekbone. Keep the narrowing at the front
 // of the lower face so the masseter flows into the neck beside the ear.
 const jaw = bell(1.658, .039, y) * front;
 const chin = bell(1.641, .016, y) * bell(0, .040, x) * front;
 const chinUnderside = bell(1.626, .016, y) * bell(0, .040, x) * front;
 const cheekbone = bell(1.716, .027, y) * bell(.051, .025, side) * front;
 const buccal = bell(1.687, .023, y) * bell(.048, .019, side) * front;

 const bridge = bell(1.721, .022, y) * bell(0, .017, x) * profile;
 const noseTip = bell(1.704, .013, y) * bell(0, .012, x) * profile;
 const noseWing = bell(1.699, .010, y) * bell(.016, .009, side) * profile;

 // Use the same deformation on the eye, socket and brow meshes. Restrict
 // the lift to the inside of the eyebrow to reduce its steep inner angle.
 const socket = bell(1.743, .018, y) * bell(.034, .022, side) * front;
 const eyeOpening = bell(1.744, .014, y) * bell(.034, .020, side) * front;
 const outerLid = smooth(.036, .054, side) * socket;
 const lowerOrbit = bell(1.735, .009, y) * bell(.038, .018, side) * front;
 const medialBrow = bell(1.752, .009, y) * bell(.016, .011, side) * front;
 const browArch = bell(1.761, .010, y) * bell(.043, .022, side) * front;

 const lips = bell(1.672, .013, y) * profile;
 const lowerLip = bell(1.667, .006, y) * bell(0, .027, x) * profile;
 const upperLip = bell(1.677, .008, y) * bell(0, .023, x) * profile;
 const mouthCorner = lips * bell(.028, .010, side);
 const ear = smooth(.076, .092, side) * bell(1.726, .039, y);

 const width = 1 - .186 * jaw - .07 * chin + .044 * cheekbone
  + .164 * noseWing - .072 * lips - .042 * ear;
 return target.set(
  x * (1 + neck * (width - 1)) - .11 * neck * Math.sign(x) * (side - .034) * eyeOpening,
  y + neck * (.0085 * chinUnderside + .0024 * chin - .0016 * bridge + .0017 * noseTip
   - .0036 * outerLid + .0037 * medialBrow - .0036 * browArch
   - .065 * (y - 1.744) * eyeOpening + .0017 * mouthCorner),
  z + neck * (.0034 * cheekbone + .0015 * buccal - .0058 * chin - .0026 * bridge
   - .0023 * noseTip + .002 * noseWing + .0018 * medialBrow - .0017 * browArch
   - .0017 * lowerOrbit + .0039 * lowerLip - .0015 * upperLip + .0015 * ear)
 );
}

export function musialaHairline(x, z) {
 const side = Math.abs(x);
 const browFront = smooth(.084, .152, z);
 const nape = 1 - smooth(-.044, .021, z);
 const temple = smooth(.058, .083, side) * smooth(.023, .065, z)
  * (1 - smooth(.106, .139, z));
 const edge = .0022 * Math.sin(x * 186 + .4) + .0015 * Math.cos(x * 430 + .5);
 const frontShape = .042 + .006 * bell(.063, .019, side) - .004 * bell(.014, .029, x);
 return 1.755 + browFront * (frontShape + edge) - .022 * nape + .016 * temple;
}

export function musialaHairOffset(x, y, z, depth, normalX, normalY, normalZ, target) {
 const bulk = smooth(1.771, 1.851, y);
 const root = smooth(0, .023, depth);
 const side = smooth(.047, .082, Math.abs(x));
 const front = smooth(.090, .157, z);
 const curls = Math.sin(x * 310 + z * 217) * Math.sin(z * 410 - y * 460)
  + .57 * Math.sin(x * 278 - z * 349 + y * 490);
 const thickness = .00055 + root * (.0015 + .0155 * bulk + .0042 * front
  - .0011 * side + (.0008 + .0021 * bulk) * curls);
 return target.set(x + normalX * thickness, y + normalY * thickness,
  z + normalZ * thickness);
}

export function musialaHairUV(x, y, z, depth) {
 const side = Math.abs(x);
 const temple = smooth(.052, .080, side) * (1 - smooth(.092, .148, z));
 // Follow the scalp from the forehead to the nape. Mirroring at the front
 // and back removes a wrap seam without stretching the curls across the side.
 const arc = Math.atan2(side, z - .058) / Math.PI;
 const u = arc + .052 * Math.sign(x) * Math.sin(Math.PI * arc) * Math.sin(52 * y);
 const v = .008 + depth / (.091 + .029 * temple);
 return [Math.min(.993, Math.max(.007, u)), Math.min(.994, Math.max(.006, v))];
}

// A few shallow curl clusters interrupt the fringe and crown outline. Their
// roots sit below the scalp shell and every vertex shares the head bone.
export function addMusialaCurls(positions, indices, uv, skinIndex, skinWeight, head) {
 const geometry = new THREE.BufferGeometry();
 geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
 geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 const surface = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
 const ray = new THREE.Raycaster();
 const origin = new THREE.Vector3(), forward = new THREE.Vector3(0, 0, -1);
 const down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(0, 1, 0);
 const rotation = new THREE.Quaternion(), point = new THREE.Vector3();

 function plant(index, direction, radius) {
  ray.set(origin, direction);
  const hit = ray.intersectObject(surface, false)[0];
  if (!hit) return;
  const normal = hit.normal.normalize();
  rotation.setFromUnitVectors(up, normal);
  const offset = positions.length / 3, angle = index * 2.37;
  const base = hit.point.addScaledVector(normal, -.0025);
  const sampleU = hit.uv.x, sampleV = Math.max(.090, hit.uv.y);
  const sides = 5;
  for (let ring = 0; ring < 2; ring++) {
   for (let side = 0; side < sides; side++) {
    const a = angle + side * Math.PI * 2 / sides + .27 * ring;
    const size = radius * (1 - .29 * ring) * (1 + .14 * Math.sin(a * 4.2));
    const x = Math.cos(a), z = Math.sin(a);
    point.set(x * size + .0011 * ring, .0033 * ring, z * size * .82)
     .applyQuaternion(rotation).add(base);
    positions.push(point.x, point.y, point.z);
    uv.push(Math.min(.99, Math.max(.01, sampleU + x * .016)),
     Math.min(.99, sampleV + .017 * ring + z * .008));
    skinIndex.push(head, 0, 0, 0);
    skinWeight.push(1, 0, 0, 0);
   }
  }
  point.set(.0011, .0048, 0).applyQuaternion(rotation).add(base);
  positions.push(point.x, point.y, point.z);
  uv.push(sampleU, Math.min(.99, sampleV + .041));
  skinIndex.push(head, 0, 0, 0);
  skinWeight.push(1, 0, 0, 0);
  const cap = offset + sides * 2;
  for (let side = 0; side < sides; side++) {
   const next = (side + 1) % sides, lower = offset + side, upper = lower + sides;
   indices.push(lower, upper, offset + next, upper, offset + next + sides,
    offset + next, upper, cap, offset + next + sides);
  }
 }

 for (let index = 0; index < 6; index++) {
  const x = (index - 2.5) * .020;
  origin.set(x, musialaHairline(x, .152) + .0064 + .0025 * Math.cos(index * 1.7), .245);
  plant(index, forward, .0055 + .0013 * Math.sin(index * 2.4));
 }
 for (let index = 0; index < 6; index++) {
  const a = index * Math.PI / 3;
  origin.set(Math.sin(a) * .044, 1.95, .057 + Math.cos(a) * .045);
  plant(index + 6, down, .0061 + .0014 * Math.cos(index * 3.3));
 }
 geometry.dispose();
 surface.material.dispose();
}

// Original curl texture. At the temples and nape, small dots dissolve the
// hairline into the skin under the same alpha test used by every athlete.
export function paintMusialaHair(c) {
 const ground = c.createLinearGradient(0, 0, 0, 1);
 ground.addColorStop(0, '#3a2b23');
 ground.addColorStop(.55, '#30251f');
 ground.addColorStop(.86, '#2f241e');
 ground.addColorStop(.925, '#433126');
 ground.addColorStop(.968, 'rgba(81,58,44,.63)');
 ground.addColorStop(1, 'rgba(102,74,56,.03)');
 c.fillStyle = ground;
 c.fillRect(0, 0, 1, 1);
 c.globalCompositeOperation = 'source-atop';

 for (let row = 0; row < 15; row++) {
  for (let column = 0; column < 35; column++) {
   const seed = (row * 35 + column) * 17.739;
   const y = (row + .55 + .4 * Math.sin(seed * 3.1)) / 15;
   const x = (column + .4 + .55 * Math.sin(seed)) / 35;
   const width = (.009 + .0042 * Math.cos(seed * 2.7)) * (1 - .47 * y);
   const height = width * (1.5 + .51 * Math.cos(seed));
   const start = seed % (Math.PI * 2);
   const lift = .0026 + .0024 * (1 - y);
   c.strokeStyle = 'rgba(7,4,4,.62)';
   c.lineWidth = .006;
   c.beginPath();
   c.ellipse(x, y, width, height, start, 0, Math.PI * 2);
   c.stroke();
   c.strokeStyle = column % 5 === 1 ? 'rgba(158,117,84,.57)' : 'rgba(136,106,86,.40)';
   c.lineWidth = lift * 1.35;
   c.beginPath();
   c.ellipse(x, y - lift, width, height, start, .45, 4.5);
   c.stroke();
  }
 }

 c.globalCompositeOperation = 'source-over';
 c.fillStyle = 'rgba(71,47,34,.52)';
 for (let index = 0; index < 110; index++) {
  const x = (index + .47) / 110;
  const y = .962 + .026 * Math.sin(index * 26.2);
  const radius = .0013 + .00095 * Math.cos(index * 12.5);
  c.beginPath();
  c.ellipse(x, y, radius, radius * 2, 0, 0, Math.PI * 2);
  c.fill();
 }
}

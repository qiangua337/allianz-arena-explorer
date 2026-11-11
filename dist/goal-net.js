import {THREE} from './kit.js';

// Build four joined faces from the same lattice. The top bows under its own
// weight and the back tucks in slightly above the ground anchors.
export function buildGoalNetGeometry() {
 const halfWidth = 3.66;
 const mouthHeight = 2.44;
 const floor = .018;
 const positions = [];

 function point(width, height, depth) {
  const center = Math.sin(Math.PI * width);
  const upperSag = (.065 * Math.sin(Math.PI * depth) + .025 * depth) * center;
  const sideBow = .018 * Math.sin(Math.PI * depth) * Math.sin(Math.PI * height);
  return [
   (width * 2 - 1) * (halfWidth - .065 * depth + sideBow),
   floor + height * (mouthHeight - floor) - upperSag * height * height,
   depth * (2.1 - .17 * height - .068 * Math.sin(Math.PI * height) * center)
  ];
 }

 function curve(sample, pieces) {
  let previous = sample(0);
  for (let step = 1; step <= pieces; step++) {
   const next = sample(step / pieces);
   positions.push(...previous, ...next);
   previous = next;
  }
 }

 for (let column = 0; column <= 46; column++) {
  const width = column / 46;
  curve(height => point(width, height, 1), 3);
  curve(depth => point(width, 1, depth), 3);
 }
 for (let row = 0; row < 16; row++) {
  const height = row / 16;
  curve(width => point(width, height, 1), 4);
  for (const side of [0, 1]) curve(depth => point(side, height, depth), 3);
 }
 for (let step = 1; step <= 12; step++) {
  const depth = step / 12;
  curve(width => point(width, 1, depth), 4);
  if (step < 12) {
   for (const side of [0, 1]) curve(height => point(side, height, depth), 3);
  }
 }

 const geometry = new THREE.BufferGeometry();
 geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
 geometry.computeBoundingSphere();
 return geometry;
}

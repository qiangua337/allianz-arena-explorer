// Roof luminaires light the full field, with less reflected light reaching the
// higher rows. Model that contrast inside the existing material programs.
export function buildBowlLighting(root) {
 const intensity = { value: 0 };
 const materials = new Set();
 root.traverse(object => {
  if (!object.isMesh) return;
  const slots = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of slots) {
   if (material?.isMeshStandardMaterial) materials.add(material);
  }
 });

 for (const material of materials) {
  const pitch = material.userData.arenaPitch === true;
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, ...args) {
   before.call(this, shader, ...args);
   shader.uniforms.arenaFloodFill = intensity;
   shader.fragmentShader = 'uniform float arenaFloodFill;\n' + shader.fragmentShader;
   if (!pitch) {
    shader.vertexShader = 'varying float vArenaSpill;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
// mvPosition already contains batching and instancing. Recover only world Y.
float arenaHeight = dot(mvPosition.xyz, viewMatrix[1].xyz) + cameraPosition.y;
vArenaSpill = clamp(1.0 - arenaHeight / 46.0, 0.24, 1.0);`);
    shader.fragmentShader = 'varying float vArenaSpill;\n' + shader.fragmentShader;
   }
   const spill = pitch ? 'vec3(2.06, 2.13, 2.25)' : 'vec3(vArenaSpill)';
   shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
float arenaNormalY = dot(normal, viewMatrix[1].xyz);
float arenaFacing = clamp(arenaNormalY * 0.58 + 0.42, 0.18, 1.0);
reflectedLight.indirectDiffuse += diffuseColor.rgb * arenaFloodFill * arenaFacing * ${spill};`);
  };
  material.customProgramCacheKey = () => key + (pitch ? '|arena-pitch-flood-v3' : '|arena-bowl-spill-v3');
  material.needsUpdate = true;
 }

 return { night(value) { intensity.value = value ? 0.12 : 0; } };
}

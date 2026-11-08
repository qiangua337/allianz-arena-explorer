import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE}=await import('../dist/kit.js');
const {subtractFootprints}=await import('../dist/architecture-clip.js');
const area=g=>{const p=g.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let sum=0;for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);sum+=b.sub(a).cross(c.sub(a)).length()/2;}return sum;};
const ray=(g,origin,direction)=>new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction).normalize(),.001,30).intersectObject(new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),false)[0];

test('triangles away from room footprints keep their topology, UVs, colours and surface area',()=>{
 const g=new THREE.PlaneGeometry(10,4).rotateX(-Math.PI/2).translate(0,0,20),p=g.attributes.position,colours=new Float32Array(p.count*3);for(let i=0;i<colours.length;i++)colours[i]=(i%5)/4;g.setAttribute('color',new THREE.BufferAttribute(colours,3));
 const result=subtractFootprints(g,[{minX:-2,maxX:2,minZ:-2,maxZ:2}]),expanded=g.toNonIndexed();assert.equal(result.attributes.position.count,6,'a remote doorway must not subdivide an unrelated floor');assert.ok(Math.abs(area(result)-40)<1e-6);for(const key of ['position','uv','color'])assert.deepEqual(result.attributes[key].array,expanded.attributes[key].array);
});

test('two real holes retain their exact floor area and remain open from every viewing direction',()=>{
 const g=new THREE.PlaneGeometry(20,16,4,4).rotateX(-Math.PI/2),cuts=[{minX:-6,maxX:-2,minZ:-3,maxZ:2},{minX:2,maxX:6,minZ:-1,maxZ:4}],result=subtractFootprints(g,cuts);assert.ok(Math.abs(area(result)-(320-40))<1e-5);
 for(let x=-9.7;x<10;x+=.5)for(let z=-7.7;z<8;z+=.5){const hole=cuts.some(r=>x>r.minX&&x<r.maxX&&z>r.minZ&&z<r.maxZ);for(const direction of [[0,-1,0],[0,1,0],[.25,-1,.18],[-.2,-1,-.3]]){const sign=direction[1]>0?-1:1,origin=[x-direction[0]*2/Math.abs(direction[1]),2*sign,z-direction[2]*2/Math.abs(direction[1])],hit=ray(result,origin,direction);assert.equal(!!hit,!hole,`floor at ${x},${z}, ray ${direction}`);if(hit)assert.ok(Math.abs(hit.point.y)<1e-6);}}
});

test('vertical circulation walls keep an open room cut and retain the walls beside it',()=>{
 const g=new THREE.PlaneGeometry(12,4).translate(0,2,0),result=subtractFootprints(g,[{minX:-1,maxX:1,minZ:-.5,maxZ:.5}]);assert.ok(Math.abs(area(result)-40)<1e-5);
 for(const x of [-5,-2,-.5,0,.5,2,5])for(const y of [.2,1.7,3.8])for(const direction of [[0,0,-1],[0,0,1],[.2,.1,-1],[-.2,-.1,-1]]){const distance=3/Math.abs(direction[2]),origin=[x-direction[0]*distance,y-direction[1]*distance,-direction[2]*distance],hit=ray(result,origin,direction);assert.equal(!!hit,Math.abs(x)>1,`wall at ${x},${y}, ray ${direction}`);}
 for(const value of result.attributes.normal.array)assert.ok(Number.isFinite(value));
});

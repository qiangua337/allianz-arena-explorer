"""Bake the CC0 MakeHuman mesh into a small, shared football character asset.

Run with Python + numpy + Pillow, passing the source cache described in
docs/PLAYER-ASSETS.md. Only asset data is used; no MakeHuman program code runs.
The shipped skin mesh excludes the body hidden by the kit.
"""
import json, pathlib, sys
import numpy as np
from PIL import Image

CACHE = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(__file__).resolve().parents[1] / 'dist/assets/players'
OUT.mkdir(parents=True, exist_ok=True)

def obj(path):
    vertices, uvs, faces, group = [], [], [], 'body'
    for line in path.read_text(encoding='utf-8').splitlines():
        a = line.split()
        if not a: continue
        if a[0] == 'v': vertices.append([float(x) for x in a[1:4]])
        elif a[0] == 'vt': uvs.append([float(x) for x in a[1:3]])
        elif a[0] == 'g': group = a[1]
        elif a[0] == 'f':
            face = []
            for word in a[1:]:
                p = word.split('/')
                face.append((int(p[0])-1, int(p[1])-1 if len(p)>1 and p[1] else 0))
            faces.append((group, face))
    return np.array(vertices), np.array(uvs), faces

base, base_uv, base_faces = obj(CACHE / 'base.obj')
body = base.copy()
for name, strength in [('male.target', 1), ('average.target', .35), ('muscle.target', .65)]:
    for line in (CACHE/name).read_text(encoding='utf-8').splitlines():
        a = line.split()
        if len(a)==4 and not a[0].startswith('#'):
            body[int(a[0])] += np.array([float(x) for x in a[1:]])*strength

body_ids = sorted({vi for name, face in base_faces if name=='body' for vi, ti in face})
ground = body[body_ids, 1].min()
scale = 1.86 / (body[body_ids, 1].max()-ground)
def metres(points):
    a = points.copy(); a[...,1] -= ground
    return a*scale

rig = json.loads((CACHE/'default.mhskel').read_text(encoding='utf-8'))
kept = ['root','spine05','spine03','spine01','neck01','head']
for side in ['L','R']:
    kept += [x+'.'+side for x in ['upperarm01','lowerarm01','wrist','upperleg01','lowerleg01','foot']]

def remap(name):
    if name in kept: return name
    if name.startswith(('special','eye','jaw','levator','oculi','orbicular','oris','risorius','temporalis','tongue')): return 'head'
    if name.startswith('neck'): return 'neck01'
    if name.startswith(('finger','metacarpal')): return 'wrist.'+name[-1]
    if name.startswith('toe'): return 'foot.'+name[-1]
    if name.startswith('upperarm'): return 'upperarm01.'+name[-1]
    if name.startswith('lowerarm'): return 'lowerarm01.'+name[-1]
    if name.startswith('upperleg'): return 'upperleg01.'+name[-1]
    if name.startswith('lowerleg'): return 'lowerleg01.'+name[-1]
    if name.startswith(('clavicle','shoulder')): return 'spine01'
    if name.startswith('breast'): return 'spine03'
    if name=='spine04': return 'spine05'
    if name=='spine02': return 'spine03'
    return 'root'

weights = np.zeros((len(body), len(kept)))
for name, pairs in json.loads((CACHE/'default_weights.mhw').read_text(encoding='utf-8'))['weights'].items():
    col = kept.index(remap(name))
    for vi, weight in pairs: weights[vi,col] += weight
weights /= np.maximum(1e-8, weights.sum(1, keepdims=True))
bones = []
for name in kept:
    b = rig['bones'][name]
    parent = b['parent']
    while parent and parent not in kept: parent = rig['bones'][parent]['parent']
    head = metres(body[rig['joints'][b['head']]].mean(0))
    tail = metres(body[rig['joints'][b['tail']]].mean(0))
    bones.append(dict(name=name, parent=kept.index(parent) if parent else -1,
                      head=head.round(7).tolist(), tail=tail.round(7).tolist()))
bone_positions = {b['name']:np.array(b['head']) for b in bones}

def normals(points, faces):
    result = np.zeros_like(points)
    for name, face in faces:
        ids = [a[0] for a in face]
        n = np.cross(points[ids[1]]-points[ids[0]], points[ids[2]]-points[ids[0]])
        for i in ids: result[i] += n
    result /= np.maximum(1e-10, np.linalg.norm(result, axis=1, keepdims=True))
    return result

def fitted(folder, name):
    path = CACHE/folder
    points, uvs, faces = obj(path/(name+'.obj'))
    clo = next(path.glob('*.mhclo')).read_text(encoding='utf-8').splitlines()
    in_verts, refs, sizing = False, [], np.ones(3)
    for line in clo:
        a = line.split()
        if not a or a[0].startswith('#'): continue
        if a[0] in ['x_scale','y_scale','z_scale']:
            axis=['x_scale','y_scale','z_scale'].index(a[0])
            sizing[axis]=abs(body[int(a[1]),axis]-body[int(a[2]),axis])/float(a[3])
        if a[0]=='verts': in_verts=True; continue
        if in_verts:
            if a[0] in ['delete_verts','weights','vertexboneweights_file']: break
            if len(a)==9:
                ids = np.array([int(x) for x in a[:3]])
                blend = np.array([float(x) for x in a[3:6]])
                refs.append((ids, blend, np.array([float(x) for x in a[6:9]])))
            elif len(a)==1 and a[0].isdigit(): refs.append((np.array([int(a[0])]), np.array([1.]), np.zeros(3)))
    fitted_points, fitted_weights = [], []
    # Fit to the current human, not to the author's differently shaped avatar.
    # MHCLO stores a barycentric surface anchor plus a body-relative offset.
    for i,(ids, blend, offset) in enumerate(refs[:len(points)]):
        fitted_points.append((body[ids]*blend[:,None]).sum(0)+offset*sizing)
        fitted_weights.append((weights[ids]*blend[:,None]).sum(0))
    assert len(fitted_points)==len(points), (name,len(fitted_points),len(points))
    return metres(np.array(fitted_points)), uvs, faces, np.array(fitted_weights)

parts, payload = [], bytearray()
def add_part(name, points, uvs, faces, influence, *, select=lambda c,w:True,
             yclip=None, expand=0, projection=None):
    ns = normals(points, faces)
    points = points + ns*expand
    data, indices, unique = [], [], {}
    def store(row):
        w = row[8:]; order = np.argsort(w)[-4:][::-1]
        ww = np.maximum(0,w[order]); ww /= max(1e-8,ww.sum())
        record = np.concatenate((row[:8],order,ww)).astype('<f4')
        key = record.tobytes()
        if key not in unique: unique[key]=len(data); data.append(record)
        return unique[key]
    for group, face in faces:
        ids = [i for i,j in face]
        c, w = points[ids].mean(0), influence[ids].mean(0)
        if not select(c,w): continue
        polygon = [np.concatenate((points[i], ns[i], uvs[j] if len(uvs) else [0,0], influence[i])) for i,j in face]
        if yclip:
            for cut, direction in [(yclip[0],1),(yclip[1],-1)]:
                clipped=[]
                for i,a in enumerate(polygon):
                    b=polygon[(i+1)%len(polygon)]; da=(a[1]-cut)*direction; db=(b[1]-cut)*direction
                    if da>=0: clipped.append(a)
                    if (da>=0)!=(db>=0): clipped.append(a+(b-a)*da/(da-db))
                polygon=clipped
                if not polygon: break
        if projection:
            for row in polygon: row[6:8]=projection(row[:3], c)
        for i in range(1,len(polygon)-1):
            indices += [store(polygon[j]) for j in [0,i,i+1]]
    a=np.array(data,dtype='<f4'); ix=np.array(indices,dtype='<u2')
    assert len(data)<65536
    while len(payload)%4: payload.append(0)
    offset=len(payload); payload.extend(a.tobytes()); io=len(payload); payload.extend(ix.tobytes())
    parts.append(dict(name=name,vertices=len(data),triangles=len(indices)//3,offset=offset,indexOffset=io,indexCount=len(indices)))
    print(name, len(data), len(indices)//3)

P=metres(body)
body_faces=[f for f in base_faces if f[0]=='body']
arm_cols=[kept.index(n) for n in kept if n.startswith(('upperarm','lowerarm','wrist'))]
def visible_skin(c,w):
    if c[1]>1.52: return True
    if .455<c[1]<.745: return True
    if w[arm_cols].sum()>.6:
        shoulder=bone_positions['upperarm01.L' if c[0]>0 else 'upperarm01.R']
        return np.linalg.norm(c-shoulder)>.16
    return False
add_part('skin',P,base_uv,body_faces,weights,select=visible_skin)

shirt = fitted('clothes/toigo_basic_tucked_t-shirt','t_shirt_basic_tucked')
# The source is a high tucked tee. Extend its lower panels to overlap the shorts
# through torso twist instead of exposing a gap at the belt line.
print('Fitted shirt bounds',shirt[0].min(0),shirt[0].max(0))
# Lower the actual open hem as a continuous loop, leaving collar and shoulder
# seams at their anatomical anchors.
from collections import Counter
edges=Counter(tuple(sorted((face[j][0],face[(j+1)%len(face)][0]))) for group,face in shirt[2] for j in range(len(face)))
hem={vi for (a,b),count in edges.items() if count==1 for vi in [a,b] if shirt[0][vi,1]<1.23}
for vi in hem: shirt[0][vi,1]=min(shirt[0][vi,1],1.015)
def shirt_uv(p,c):
    back = c[2]<.015
    u = .5 + (-p[0] if back else p[0])/.66
    return [(.5 if back else 0)+np.clip(u,.012,.988)*.5, np.clip((p[1]-.965)/.69,.008,.992)]
add_part('shirt',*shirt,expand=.004,projection=shirt_uv)

tights=[f for f in base_faces if f[0]=='helper-tights']
def cloth_uv(p,c): return [(.5 if p[0]<0 else 0)+np.clip(abs(p[0])/.4,0,1)*.5,p[1]*2]
add_part('shorts',P,base_uv,tights,weights,select=lambda c,w:.69<c[1]<1.10,
         yclip=(.715,1.065),expand=.021,projection=cloth_uv)
add_part('socks',P,base_uv,body_faces,weights,select=lambda c,w:.055<c[1]<.49,
         yclip=(.075,.48),expand=.002,projection=lambda p,c:[p[0]*10,p[1]*3])

# A low boot last is independent of the anatomical toes, with a continuous sole.
for side in ['L','R']:
    ankle=bone_positions['foot.'+side]
    pts,uv,faces=[],[],[]
    sections=[(-.105,.026,.062),(-.085,.046,.104),(-.025,.052,.115),(.045,.054,.099),(.115,.054,.075),(.18,.043,.051),(.205,.005,.035)]
    N=24
    for j,(z,r,h) in enumerate(sections):
        for k in range(N):
            t=k/N*np.pi*2
            pts.append([ankle[0]+np.cos(t)*r,.027+max(0,np.sin(t))*h+min(0,np.sin(t))*.006,ankle[2]+z])
            uv.append([k/N,j/(len(sections)-1)])
    for j in range(len(sections)-1):
        for k in range(N):
            a=j*N+k;b=j*N+(k+1)%N
            faces.append(('boot',[(a,a),(b,b),(b+N,b+N),(a+N,a+N)]))
    # Close both ends: the open source of the earlier split-heel silhouette.
    for j, reverse in [(0,False),(len(sections)-1,True)]:
        center=len(pts);pts.append([ankle[0],.045,ankle[2]+sections[j][0]]);uv.append([.5,j/(len(sections)-1)])
        for k in range(N):
            a=j*N+k;b=j*N+(k+1)%N
            ids=[center,a,b] if reverse else [center,b,a]
            faces.append(('cap',[(i,i) for i in ids]))
    wi=np.zeros((len(pts),len(kept)));wi[:,kept.index('foot.'+side)]=1
    add_part('boot'+side,np.array(pts),np.array(uv),faces,wi)

for name in ['short02']:
    add_part(name,*fitted('hair/'+name,name))

# A close crop follows the actual skull and exposes the ears and nape. This
# avoids using the longer stock hair, whose back silhouette looked like a helmet.
hair_points=P.copy();hair_normals=normals(P,body_faces)
for i,p in enumerate(hair_points):
    if p[1]>1.735:
        top=np.clip((p[1]-1.75)/.10,0,1)
        curl=(np.sin(p[0]*597+p[1]*473)*np.sin(p[2]*683-p[1]*311)+1)*.0015
        hair_points[i]+=hair_normals[i]*(.001+top*(.006+curl))
add_part('crop',hair_points,base_uv,body_faces,weights,
         select=lambda c,w:c[1]>1.765+max(-.01,(c[2]-.015)*.25) and c[2]<.15)
add_part('eyes',*fitted('eyes/low-poly','low-poly'))
add_part('eyebrows',*fitted('eyebrows/eyebrow002','eyebrow002'))

(OUT/'footballer.bin').write_bytes(payload)
manifest=dict(version=1,stride=16,height=1.86,bones=bones,parts=parts,
              eyes={side:metres(body[rig['joints'][rig['bones']['eye.'+side]['head']]].mean(0)).tolist() for side in ['L','R']})
(OUT/'footballer.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
textures={
    'skin-light.webp':('skins/young_caucasian_male/young_lightskinned_male_diffuse.png',1024),
    'skin-dark.webp':('skins/young_african_male/young_darkskinned_male_diffuse.png',1024),
    'hair-short02.webp':('hair/short02/short02_diffuse.png',512),
    'eyes.webp':('eyes/materials/brown_eye.png',256),
    'brows.webp':('eyebrows/eyebrow002/eyebrow002.png',256),
}
for dst,(src,size) in textures.items():
    img=Image.open(CACHE/src);img.thumbnail((size,size),Image.Resampling.LANCZOS)
    img.save(OUT/dst,format='WEBP',quality=88,method=6)
print('Geometry bytes',len(payload))

"""Bake the CC0 MakeHuman mesh into a small, shared football character asset.

Run with Python + numpy + Pillow, passing the source cache described in
docs/PLAYER-ASSETS.md. Only asset data is used; no MakeHuman program code runs.
The shipped skin mesh excludes the body hidden by the kit.
"""
import json, pathlib, sys
sys.dont_write_bytecode = True
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
source_weights=json.loads((CACHE/'default_weights.mhw').read_text(encoding='utf-8'))['weights']
# Bake a relaxed hand before collapsing the finger bones to the wrist. The
# original authoring pose spreads every finger; it is unsuitable for walking.
open_body=body.copy()
def joint_point(name): return open_body[rig['joints'][name]].mean(0)
def pose_hands(thumb, fingers):
    delta=np.zeros_like(body)
    for side in ['L','R']:
        index=joint_point(rig['bones']['finger2-1.'+side]['head'])
        pinky=joint_point(rig['bones']['finger5-1.'+side]['head'])
        middle=rig['bones']['finger3-1.'+side]
        direction=joint_point(middle['tail'])-joint_point(middle['head'])
        palm=np.cross(pinky-index,direction);palm/=np.linalg.norm(palm)
        if palm[2]>0: palm=-palm
        for finger in range(1,6):
            parent_rotation=np.eye(3);previous_tail=None
            for segment in range(1,4):
                name=f'finger{finger}-{segment}.{side}';bone=rig['bones'][name]
                head=joint_point(bone['head']);tail=joint_point(bone['tail'])
                vector=tail-head;vector/=np.linalg.norm(vector)
                axis=np.cross(vector,palm);axis/=np.linalg.norm(axis)
                angle=np.deg2rad((thumb if finger==1 else fingers)[segment-1])
                x,y,z=axis;K=np.array([[0,-z,y],[z,0,-x],[-y,x,0]])
                rotation=parent_rotation@(np.eye(3)+np.sin(angle)*K+(1-np.cos(angle))*(K@K))
                new_head=head if previous_tail is None else previous_tail
                for vi,weight in source_weights.get(name,[]):
                    posed=new_head+rotation@(open_body[vi]-head)
                    delta[vi]+=(posed-open_body[vi])*weight
                previous_tail=new_head+rotation@(tail-head);parent_rotation=rotation
    return delta
# Preserve the exact shipped bind rig, while relaxing the visible fingers.
rig_body=open_body+pose_hands([18,25,17],[18,42,27])
body+=pose_hands([14,18,14],[12,30,20])
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
for name, pairs in source_weights.items():
    col = kept.index(remap(name))
    for vi, weight in pairs: weights[vi,col] += weight
weights /= np.maximum(1e-8, weights.sum(1, keepdims=True))
bones = []
for name in kept:
    b = rig['bones'][name]
    parent = b['parent']
    while parent and parent not in kept: parent = rig['bones'][parent]['parent']
    head = metres(rig_body[rig['joints'][b['head']]].mean(0))
    tail = metres(rig_body[rig['joints'][b['tail']]].mean(0))
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
             select_face=lambda face:True, yclip=None, expand=0, projection=None,
             close_waist=False, surface_normals=None, clipper=None):
    ns = normals(points, faces) if surface_normals is None else surface_normals
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
        if not select_face(face): continue
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
        if clipper:polygon=clipper(polygon,c,w)
        if projection:
            for row in polygon: row[6:8]=projection(row[:3], c)
        for i in range(1,len(polygon)-1):
            indices += [store(polygon[j]) for j in [0,i,i+1]]
    closure=None
    if close_waist:
        # The clipped helper-tights have a real open waist. The tucked shirt
        # is narrower and uses different spine weights, so mere height overlap
        # still exposes the hollow interior when leaning or seen from above.
        # Close the actual emitted boundary, sharing its exact skinning.
        def point_key(i): return tuple(np.round(data[i][:3],6))
        edges={}
        for j in range(0,len(indices),3):
            face=indices[j:j+3]
            for k in range(3):
                a,b=face[k],face[(k+1)%3]
                key=tuple(sorted((point_key(a),point_key(b))))
                count,_,_=edges.get(key,(0,a,b));edges[key]=(count+1,a,b)
        rim=[(a,b) for count,a,b in edges.values() if count==1 and
             abs(data[a][1]-yclip[1])<1e-5 and abs(data[b][1]-yclip[1])<1e-5]
        assert len(rim)>=16, ('shorts waist boundary',len(rim))
        unique_rim={point_key(i):i for edge in rim for i in edge}
        center=np.zeros(16,dtype='<f4')
        center[:3]=np.mean([data[i][:3] for i in unique_rim.values()],axis=0)
        center[3:6]=[0,1,0];center[6:8]=cloth_uv(center[:3],center[:3])
        mean_weights=np.zeros(len(kept))
        for i in unique_rim.values():
            for j in range(4): mean_weights[int(data[i][8+j])]+=data[i][12+j]/len(unique_rim)
        order=np.argsort(mean_weights)[-4:][::-1]
        center[8:12]=order;center[12:16]=mean_weights[order]/mean_weights[order].sum()
        first_vertex=len(data);first_index=len(indices);center_index=len(data);data.append(center)
        cap_vertices={}
        def cap_vertex(i):
            key=point_key(i)
            if key not in cap_vertices:
                row=data[i].copy();row[3:6]=[0,1,0]
                cap_vertices[key]=len(data);data.append(row)
            return cap_vertices[key]
        for a,b in rim: indices += [cap_vertex(b),cap_vertex(a),center_index]
        closure=dict(firstVertex=first_vertex,vertices=len(data)-first_vertex,
                     firstIndex=first_index,indexCount=len(indices)-first_index)
    a=np.array(data,dtype='<f4'); ix=np.array(indices,dtype='<u2')
    assert len(data)<65536
    while len(payload)%4: payload.append(0)
    offset=len(payload); payload.extend(a.tobytes()); io=len(payload); payload.extend(ix.tobytes())
    entry=dict(name=name,vertices=len(data),triangles=len(indices)//3,offset=offset,indexOffset=io,indexCount=len(indices))
    if closure: entry['waistClosure']=closure
    parts.append(entry)
    print(name, len(data), len(indices)//3)
    return a,ix

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
# Allocate facial skin its own atlas patch, keeping the original surface,
# weights and normals. Hidden torso pixels no longer consume most face detail.
FACE_UV=(.60,.15,1.,.87)
def facial_patch(face):
    return P[[vi for vi,ti in face],1].mean()>1.60 and all(
        FACE_UV[0]<=base_uv[ti,0]<=FACE_UV[2] and
        FACE_UV[1]<=base_uv[ti,1]<=FACE_UV[3] for vi,ti in face)
hand_axes={}
for side in ['L','R']:
    wrist=bone_positions['wrist.'+side]
    direction=np.array(bones[kept.index('wrist.'+side)]['tail'])-wrist;direction/=np.linalg.norm(direction)
    across=metres(joint_point(rig['bones']['finger5-1.'+side]['head']))-metres(joint_point(rig['bones']['finger2-1.'+side]['head']))
    across-=direction*np.dot(across,direction);across/=np.linalg.norm(across)
    palm=np.cross(across,direction);palm/=np.linalg.norm(palm)
    if palm[2]>0: palm=-palm
    hand_axes[side]=(wrist,direction,across,palm)
def hand_face(face):
    ids=[vi for vi,ti in face];c=P[ids].mean(0)
    side='L' if c[0]>0 else 'R';wrist,direction,across,palm=hand_axes[side]
    return weights[ids,kept.index('wrist.'+side)].mean()>.65 and np.dot(c-wrist,direction)>-.028
def wrist_patch(face):
    ids=[vi for vi,ti in face];c=P[ids].mean(0);side='L' if c[0]>0 else 'R';wrist,direction,across,palm=hand_axes[side]
    return weights[ids][:,arm_cols].sum(1).mean()>.6 and np.dot(c-wrist,direction)>-.18
WRIST_CUT=-.043
def covered_wrist(polygon,c,w):
    side='L' if c[0]>0 else 'R';wrist,direction,across,palm=hand_axes[side];clipped=[]
    for i,a in enumerate(polygon):
        b=polygon[(i+1)%len(polygon)];da=WRIST_CUT-np.dot(a[:3]-wrist,direction);db=WRIST_CUT-np.dot(b[:3]-wrist,direction)
        if da>=0:clipped.append(a)
        if (da>=0)!=(db>=0):clipped.append(a+(b-a)*da/(da-db))
    return clipped
add_part('skin',P,base_uv,body_faces,weights,select=visible_skin,select_face=lambda f:not facial_patch(f) and not hand_face(f) and not wrist_patch(f))
add_part('face',P,base_uv,body_faces,weights,select=visible_skin,select_face=facial_patch)
add_part('hands',P,base_uv,body_faces,weights,select_face=hand_face)
add_part('wrists',P,base_uv,body_faces,weights,select=visible_skin,select_face=lambda f:wrist_patch(f) and not hand_face(f))
keeper_wrists,_=add_part('keeperWrists',P,base_uv,body_faces,weights,select=visible_skin,select_face=lambda f:wrist_patch(f) and not hand_face(f),clipper=covered_wrist)
cuff_fits={}
for side in ['L','R']:
    wrist,direction,across,palm=hand_axes[side];rim={}
    for row in keeper_wrists:
        delta=row[:3]-wrist
        if row[0]*(1 if side=='L' else -1)>0 and abs(np.dot(delta,direction)-WRIST_CUT)<1e-5:rim[tuple(row[:3])]=row
    assert len(rim)>=8,('actual keeper wrist cut',side,len(rim))
    rim=np.array(list(rim.values()));offset=rim[:,:3]-wrist;xy=np.column_stack([offset@across,offset@palm]);center=xy.mean(0);radii=np.max(np.abs(xy-center),axis=0)+.004
    radii*=max(1,np.max(np.linalg.norm((xy-center)/radii,axis=1)))*1.035
    wrist_weights=np.sum(np.where(rim[:,8:12]==kept.index('wrist.'+side),rim[:,12:16],0),axis=1)
    cuff_fits[side]={'center':center,'radii':radii,'rim':xy,'weights':wrist_weights}

# Original equipment is a closed, padded palm with five gently flexed fingers.
# Stretching the old skin weights into an open glove pulled the palm into thin
# triangles, so the glove volume is authored independently at the real wrist.
from keeper_glove import build_glove_surface
local_points,local_triangles,local_normals=build_glove_surface()
glove_points,glove_normals,glove_faces,glove_weights=[],[],[],[]
for side in ['L','R']:
    wrist,direction,across,palm=hand_axes[side];basis=np.column_stack([across,palm,direction]);start=len(glove_points)
    glove_points.extend(wrist+local_points@basis.T);glove_normals.extend(local_normals@basis.T)
    for tri in local_triangles:
        if np.linalg.det(basis)<0:tri=tri[[0,2,1]]
        glove_faces.append(('glove',[(start+i,start+i) for i in tri]))
    rear_weight=cuff_fits[side]['weights'].mean()
    for p in local_points:
        blend=rear_weight+(1-rear_weight)*np.clip((p[2]+.048)/.066,0,1);w=np.zeros(len(kept));w[kept.index('wrist.'+side)]=blend;w[kept.index('lowerarm01.'+side)]=1-blend;glove_weights.append(w)
def glove_uv(p,c):
    side='L' if c[0]>0 else 'R';wrist,direction,across,palm=hand_axes[side]
    across_u=np.clip(.5+np.dot(p-wrist,across)/.135,.015,.985)
    palm_side=np.dot(c-wrist,palm)>0
    return [(.5 if palm_side else 0)+across_u*.5,np.clip((np.dot(p-wrist,direction)+.05)/.245,.01,.99)]
add_part('gloves',np.array(glove_points),np.zeros((len(glove_points),2)),glove_faces,np.array(glove_weights),projection=glove_uv,surface_normals=np.array(glove_normals))
cuff_points,cuff_uvs,cuff_faces,cuff_weights=[],[],[],[]
for side in ['L','R']:
    wrist,direction,across,palm=hand_axes[side];start=len(cuff_points);N=16
    for along,outer in [(-.048,True),(.018,True),(-.048,False),(.018,False)]:
        for k in range(N):
            angle=k/N*np.pi*2;fit=cuff_fits[side];center=fit['center'] if along<0 else np.zeros(2);radii=fit['radii'] if along<0 else np.array([.034,.024]);radii=radii if outer else radii-.004;xy=center+np.array([np.cos(angle),np.sin(angle)])*radii
            cuff_points.append(wrist+direction*along+across*xy[0]+palm*xy[1])
            cuff_uvs.append([k/N,.04 if along<0 else .19]);blend=fit['weights'][np.argmin(np.linalg.norm(fit['rim']-xy,axis=1))] if along<0 else 1;w=np.zeros(len(kept));w[kept.index('wrist.'+side)]=blend;w[kept.index('lowerarm01.'+side)]=1-blend;cuff_weights.append(w)
    for k in range(N):
        j=(k+1)%N
        for ids in [[k,j,N+j,N+k],[2*N+k,3*N+k,3*N+j,2*N+j],[k,2*N+k,2*N+j,j],[N+k,N+j,3*N+j,3*N+k]]:
            cuff_faces.append(('cuff',[(start+i,start+i) for i in ids]))
add_part('gloveCuffs',np.array(cuff_points),np.array(cuff_uvs),cuff_faces,np.array(cuff_weights))

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
         yclip=(.715,1.065),expand=.021,projection=cloth_uv,close_waist=True)
add_part('socks',P,base_uv,body_faces,weights,select=lambda c,w:.055<c[1]<.49,
         yclip=(.075,.48),expand=.002,projection=lambda p,c:[p[0]*10,p[1]*3])

# Left and right uppers follow the foot's inward toe and lower outer forefoot.
# Keep the continuous outsole and studs fixed to the motion rig's contact points.
boot_bounds=None
for side in ['L','R']:
    ankle=bone_positions['foot.'+side]
    inward=-np.sign(ankle[0])
    pts,uv,faces=[],[],[]
    sections=[(-.105,.026,.062),(-.085,.046,.104),(-.025,.052,.115),(.045,.054,.099),(.115,.054,.075),(.18,.043,.051),(.205,.024,.035)]
    toe_offset=[0,0,0,.003,.008,.012,.011]
    outer_drop=[0,0,0,.004,.011,.013,.008]
    N=24
    for j,(z,r,h) in enumerate(sections):
        for k in range(N):
            t=k/N*np.pi*2
            lateral,vertical=np.cos(t),np.sin(t)
            rise=max(0,vertical)
            toe_shift=inward*toe_offset[j]*rise**2
            outer=(1-inward*lateral)*.5
            height=.027+rise*(h-outer_drop[j]*outer)+min(0,vertical)*.006
            pts.append([ankle[0]+lateral*r+toe_shift,height,ankle[2]+z])
            # Put the wrap on the underside so laces cannot smear across the instep.
            uv.append([((k+N//4)%N)/N*.78,j/(len(sections)-1)])
    for j in range(len(sections)-1):
        for k in range(N):
            a=j*N+k;b=j*N+(k+1)%N
            faces.append(('boot',[(a,a),(b,b),(b+N,b+N),(a+N,a+N)]))
    # Close both ends: the open source of the earlier split-heel silhouette.
    for j, reverse in [(0,False),(len(sections)-1,True)]:
        center=len(pts);pts.append([ankle[0],.045,ankle[2]+sections[j][0]]);uv.append([.39,j/(len(sections)-1)])
        for k in range(N):
            a=j*N+k;b=j*N+(k+1)%N
            ids=[center,a,b] if reverse else [center,b,a]
            faces.append(('cap',[(i,i) for i in ids]))
    # A continuous low outsole and six closed studs distinguish football boots
    # from the old smooth, pointed slippers. They keep the foot's single draw.
    outline=[(ankle[0]+r,ankle[2]+z) for z,r,h in sections[:-1]]
    outline += [(ankle[0]+.022,ankle[2]+.203),(ankle[0]-.022,ankle[2]+.203)]
    outline += [(ankle[0]-r,ankle[2]+z) for z,r,h in reversed(sections[:-1])]
    start=len(pts);count=len(outline)
    for yy in [.014,.026]:
        for xx,zz in outline: pts.append([xx,yy,zz]);uv.append([.90,.5])
    for i in range(count):
        j=(i+1)%count
        faces.append(('sole',[(start+i,start+i),(start+count+i,start+count+i),(start+count+j,start+count+j),(start+j,start+j)]))
    for layer,reverse in [(0,True),(1,False)]:
        center=len(pts);pts.append([ankle[0],.014 if layer==0 else .026,ankle[2]+.04]);uv.append([.90,.5])
        for i in range(count):
            a=start+layer*count+i;b=start+layer*count+(i+1)%count
            ids=[center,a,b] if reverse else [center,b,a]
            faces.append(('sole',[(v,v) for v in ids]))
    for xx,zz in [(-.026,-.065),(.026,-.065),(-.032,.035),(.032,.035),(-.025,.135),(.025,.135)]:
        start=len(pts);n=8
        for yy,rr in [(.003,.008),(.017,.011)]:
            for i in range(n):
                angle=i/n*np.pi*2;pts.append([ankle[0]+xx+np.cos(angle)*rr,yy,ankle[2]+zz+np.sin(angle)*rr]);uv.append([.97,.5])
        for i in range(n):
            j=(i+1)%n;ids=[start+i,start+n+i,start+n+j,start+j];faces.append(('stud',[(v,v) for v in ids]))
        for layer,reverse in [(0,True),(1,False)]:
            center=len(pts);pts.append([ankle[0]+xx,.003 if layer==0 else .017,ankle[2]+zz]);uv.append([.97,.5])
            for i in range(n):
                a=start+layer*n+i;b=start+layer*n+(i+1)%n;ids=[center,a,b] if reverse else [center,b,a];faces.append(('stud',[(v,v) for v in ids]))
    wi=np.zeros((len(pts),len(kept)));wi[:,kept.index('foot.'+side)]=1
    local=np.array(pts)-ankle
    if boot_bounds is None: boot_bounds={'min':local.min(0),'max':local.max(0)}
    else:
        boot_bounds['min']=np.minimum(boot_bounds['min'],local.min(0));boot_bounds['max']=np.maximum(boot_bounds['max'],local.max(0))
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

(OUT/'footballer-960.bin').write_bytes(payload)
manifest=dict(version=2,stride=16,height=1.86,bones=bones,parts=parts,faceUV=list(FACE_UV),bootBounds={k:v.round(7).tolist() for k,v in boot_bounds.items()},
              gloveFrames={side:{name:v.round(7).tolist() for name,v in zip(['wrist','forward','across','palm'],frame)} for side,frame in hand_axes.items()},
              keeperWristCut=WRIST_CUT,
              eyes={side:metres(body[rig['joints'][rig['bones']['eye.'+side]['head']]].mean(0)).tolist() for side in ['L','R']})
(OUT/'footballer-960.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
textures={
    'skin-light.webp':('skins/young_caucasian_male/young_lightskinned_male_diffuse.png',1024),
    'skin-dark.webp':('skins/young_african_male/young_darkskinned_male_diffuse.png',1024),
    'hair-short02.webp':('hair/short02/short02_diffuse.png',512),
    'eyes.webp':('eyes/materials/brown_eye.png',256),
    'brows.webp':('eyebrows/eyebrow002/eyebrow002.png',256),
}
for dst,(src,size) in ({} if '--geometry-only' in sys.argv[2:] else textures).items():
    img=Image.open(CACHE/src);img.thumbnail((size,size),Image.Resampling.LANCZOS)
    img.save(OUT/dst,format='WEBP',quality=88,method=6)
print('Geometry bytes',len(payload))

"""Original generic padded glove, built as one closed smooth five-finger volume.

Only numpy is required. The baked surface uses the existing wrist bone; the
rounded palm/finger junctions are geometry, not stretched finger skin weights.
Coordinates are metres in (across palm, palm normal, forward from wrist).
"""
import numpy as np
import heapq
import itertools


def _smooth_union(a, b, radius=.003):
    h=np.clip(.5+.5*(b-a)/radius,0,1)
    return b*(1-h)+a*h-radius*h*(1-h)


def _ellipsoid(p, center, radii):
    q=p-np.array(center);r=np.array(radii)
    k0=np.linalg.norm(q/r,axis=-1);k1=np.linalg.norm(q/(r*r),axis=-1)
    return np.where(k1>1e-9,k0*(k0-1)/np.maximum(k1,1e-9),-np.min(r))


def glove_distance(p):
    value=_ellipsoid(p,[0,0,.065],[.046,.018,.066])
    value=_smooth_union(value,_ellipsoid(p,[0,0,.008],[.028,.019,.040]))
    # Natural finger spread and shallow flexion, not a splayed authoring hand.
    for across,start,length,radius,spread in [(-.032,.112,.078,.009,-.004),(-.008,.121,.084,.0096,-.001),(.016,.114,.079,.009,.002),(.038,.100,.064,.008,.004)]:
        joints=np.array([[across,0,start],[across+spread*.25,.0015,start+length*.43],[across+spread*.65,.0075,start+length*.78],[across+spread,.015,start+length]])
        for i in range(3):
            a,b=joints[i:i+2];axis=b-a;t=np.clip(np.sum((p-a)*axis,axis=-1)/np.dot(axis,axis),0,1)
            r=radius*(1-.14*(i+t)/3);distance=np.linalg.norm(p-a-t[...,None]*axis,axis=-1)-r
            value=_smooth_union(value,distance,.0025)
    thumb=np.array([[-.036,.002,.043],[-.059,.002,.062],[-.073,.006,.086],[-.078,.011,.107]])
    for i in range(3):
        a,b=thumb[i:i+2];axis=b-a;t=np.clip(np.sum((p-a)*axis,axis=-1)/np.dot(axis,axis),0,1)
        distance=np.linalg.norm(p-a-t[...,None]*axis,axis=-1)-(.012-.0015*(i+t)/3)
        value=_smooth_union(value,distance,.004)
    return value


def _simplify_closed_surface(vertices, triangles, target):
    """Small deterministic quadric decimator; preserve closed manifold links."""
    vertices=vertices.copy();triangles=triangles.copy();count=len(vertices)
    quadrics=np.zeros((count,4,4));neighbors=[set() for _ in range(count)];faces=[set() for _ in range(count)]
    a,b,c=vertices[triangles[:,0]],vertices[triangles[:,1]],vertices[triangles[:,2]]
    normal=np.cross(b-a,c-a);normal/=np.maximum(1e-12,np.linalg.norm(normal,axis=1,keepdims=True))
    plane=np.column_stack([normal,-np.sum(normal*a,axis=1)]);q=plane[:,:,None]*plane[:,None,:]
    for i,tri in enumerate(triangles):
        for v in tri:quadrics[v]+=q[i];faces[v].add(i);neighbors[v].update(tri)
    for i,n in enumerate(neighbors):n.discard(i)
    live=np.ones(len(triangles),bool);versions=np.zeros(count,int);queue=[];serial=itertools.count()
    def push(a,b):
        if a>b:a,b=b,a
        q=quadrics[a]+quadrics[b];mid=(vertices[a]+vertices[b])*.5;candidates=[mid,vertices[a],vertices[b]]
        try:
            optimum=np.linalg.solve(q[:3,:3],-q[:3,3])
            if np.linalg.norm(optimum-mid)<np.linalg.norm(vertices[a]-vertices[b])*1.5:candidates.append(optimum)
        except np.linalg.LinAlgError:pass
        cost,point=min(((np.r_[p,1]@q@np.r_[p,1],p) for p in candidates),key=lambda pair:pair[0])
        heapq.heappush(queue,(cost,next(serial),a,b,versions[a],versions[b],point.copy()))
    for a,n in enumerate(neighbors):
        for b in n:
            if a<b:push(a,b)
    remaining=len(triangles)
    while remaining>target and queue:
        cost,_,a,b,va,vb,point=heapq.heappop(queue)
        if versions[a]!=va or versions[b]!=vb or b not in neighbors[a]:continue
        if len(neighbors[a]&neighbors[b])!=2:continue
        affected=faces[a]|faces[b];valid=True
        for i in affected:
            tri=triangles[i]
            if a in tri and b in tri:continue
            old=vertices[tri];new=old.copy();new[(tri==a)|(tri==b)]=point
            before=np.cross(old[1]-old[0],old[2]-old[0]);after=np.cross(new[1]-new[0],new[2]-new[0])
            if np.dot(before,after)<.25*np.linalg.norm(before)*np.linalg.norm(after) or np.linalg.norm(after)<1e-11:valid=False;break
        if not valid:continue
        vertices[a]=point;quadrics[a]+=quadrics[b];versions[a]+=1;versions[b]+=1
        for i in affected:
            tri=triangles[i];tri[tri==b]=a
            if len(set(tri))<3:
                live[i]=False;remaining-=1
                for v in set(tri):faces[v].discard(i)
            else:faces[a].add(i)
        faces[b].clear();neighbors[a].update(neighbors[b]);neighbors[a].discard(a);neighbors[a].discard(b)
        for n in neighbors[b]:
            neighbors[n].discard(b)
            if n!=a:neighbors[n].add(a)
        neighbors[b].clear()
        for n in neighbors[a]:push(a,n)
    triangles=triangles[live];assert len(triangles)<=target+2,('glove triangle budget',len(triangles),target)
    used=np.unique(triangles);remap=np.full(count,-1,int);remap[used]=np.arange(len(used))
    return vertices[used],remap[triangles]


def build_glove_surface(spacing=.0055, target_triangles=3150):
    axes=[np.arange(lo,hi+spacing*.5,spacing) for lo,hi in [(-.098,.061),(-.030,.037),(-.040,.219)]]
    grid=np.stack(np.meshgrid(*axes,indexing='ij'),axis=-1);field=glove_distance(grid)
    nx,ny,nz=field.shape;points=grid.reshape(-1,3);values=field.reshape(-1)
    corner=np.array([[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]])
    offsets=corner[:,0]*ny*nz+corner[:,1]*nz+corner[:,2]
    tetrahedra=[(0,5,1,6),(0,1,2,6),(0,2,3,6),(0,3,7,6),(0,7,4,6),(0,4,5,6)]
    vertices,triangles,edges=[],[],{}
    def crossing(a,b):
        key=(min(a,b),max(a,b))
        if key not in edges:
            f=values[a]/(values[a]-values[b]);edges[key]=len(vertices);vertices.append(points[a]+(points[b]-points[a])*f)
        return edges[key]
    for x in range(nx-1):
        for y in range(ny-1):
            for z in range(nz-1):
                ids=(x*ny*nz+y*nz+z)+offsets;inside=values[ids]<0
                if inside.all() or not inside.any():continue
                for tet in tetrahedra:
                    ins=[ids[i] for i in tet if inside[i]];out=[ids[i] for i in tet if not inside[i]]
                    if len(ins) in [1,3]:
                        a,b=(ins,out) if len(ins)==1 else (out,ins)
                        triangles.append([crossing(a[0],j) for j in b])
                    elif len(ins)==2:
                        a,b,c,d=crossing(ins[0],out[0]),crossing(ins[0],out[1]),crossing(ins[1],out[0]),crossing(ins[1],out[1])
                        triangles.extend([[a,b,c],[b,d,c]])
    vertices=np.array(vertices);triangles=np.array(triangles)
    vertices,triangles=_simplify_closed_surface(vertices,triangles,target_triangles)
    h=.0005;gradient=np.column_stack([(glove_distance(vertices+np.eye(3)[i]*h)-glove_distance(vertices-np.eye(3)[i]*h))/(2*h) for i in range(3)])
    gradient/=np.maximum(1e-9,np.linalg.norm(gradient,axis=1,keepdims=True))
    a,b,c=vertices[triangles[:,0]],vertices[triangles[:,1]],vertices[triangles[:,2]]
    normal=np.cross(b-a,c-a);flip=np.sum(normal*gradient[triangles].mean(1),axis=1)<0
    triangles[flip]=triangles[flip][:,[0,2,1]]
    triangles=triangles[np.linalg.norm(normal,axis=1)>1e-12]
    return vertices,triangles,gradient

"""Paint original facial details onto the shared CC0 skin in its existing UV layout."""
import json
from pathlib import Path

import numpy as np
from PIL import Image


ASSETS = Path(__file__).resolve().parents[1] / 'dist/assets/players'
WIDTH, HEIGHT = 328, 590
MUSIALA_SKIN_BLEND = .56


def smoothstep(lo, hi, value):
    t = np.clip((value-lo)/(hi-lo), 0, 1)
    return t*t*(3-2*t)


def face_space(manifest, binary):
    """Use the shipped triangles to interpolate head-space metres at each texel."""
    face = next(part for part in manifest['parts'] if part['name'] == 'face')
    rows = np.frombuffer(binary, '<f4', face['vertices']*16, face['offset']).reshape(-1, 16)
    triangles = np.frombuffer(binary, '<u2', face['indexCount'], face['indexOffset']).reshape(-1, 3)
    u0,v0,u1,v1 = manifest['faceUV']
    uv = (rows[:,6:8]-[u0,v0])/[u1-u0,v1-v0]
    uv[:,1] = 1-uv[:,1]
    uv *= [WIDTH,HEIGHT]
    coordinates = np.zeros((HEIGHT, WIDTH, 3), dtype=np.float32)
    covered = np.zeros((HEIGHT, WIDTH), dtype=bool)
    for triangle in triangles:
        a,b,c = uv[triangle]
        ab,ac = b-a,c-a
        determinant = ab[0]*ac[1]-ab[1]*ac[0]
        if abs(determinant) < 1e-8:
            continue
        x0,y0 = np.maximum(np.floor(np.min([a,b,c], axis=0)).astype(int), 0)
        x1,y1 = np.minimum(np.ceil(np.max([a,b,c], axis=0)).astype(int), [WIDTH,HEIGHT])
        dy,dx = np.mgrid[y0:y1,x0:x1] + .5
        dx,dy = dx-a[0],dy-a[1]
        wb = (dx*ac[1]-dy*ac[0])/determinant
        wc = (dy*ab[0]-dx*ab[1])/determinant
        wa = 1-wb-wc
        inside = (wa>=0) & (wb>=0) & (wc>=0)
        coordinates[y0:y1,x0:x1][inside] = np.stack((wa,wb,wc),axis=-1)[inside] @ rows[triangle,:3]
        covered[y0:y1,x0:x1] |= inside
    return coordinates.transpose(2,0,1), covered


def original_stubble(coordinates, covered, identity):
    x,y,z = coordinates
    width = np.abs(x)
    front = smoothstep(.084,.135,z)
    rng = np.random.default_rng(2026)
    density = .56+.44*rng.random(y.shape)
    if identity == 'kane':
        cheek_y = 1.674+.061*smoothstep(.017,.073,width)
        lower_jaw = smoothstep(1.623,1.651,y)*smoothstep(.066,.113,z)
        beard = lower_jaw*(1-smoothstep(cheek_y-.010,cheek_y+.014,y))
        beard *= .84+.10*np.sin(x*327+y*251)+.06*np.cos(z*389-y*557)
        lip_clearance = smoothstep(1.661,1.674,y)*(1-smoothstep(1.679,1.686,y))*(1-smoothstep(.019,.036,width))*front
        beard *= 1-.91*lip_clearance
        mustache_y = 1.687+.004*(1-smoothstep(0,.030,width))
        mustache = np.exp(-((y-mustache_y)/.006)**2)*(1-smoothstep(.023,.038,width))*front
        sideburn = smoothstep(1.720,1.743,y)*(1-smoothstep(1.763,1.780,y))*smoothstep(.062,.079,width)*smoothstep(.060,.088,z)*(1-smoothstep(.103,.132,z))
        return np.maximum.reduce([beard*.66,mustache*.56,sideburn*.51])*density*covered, [72,56,44]

    mustache_y = 1.688+.002*(1-smoothstep(0,.027,width))
    mustache = np.exp(-((y-mustache_y)/.004)**2)*(1-smoothstep(.022,.035,width))*smoothstep(.001,.006,width)*front
    chin = np.exp(-((y-1.643)/.008)**2)*(1-smoothstep(.013,.025,width))*front
    return np.maximum(mustache*.34,chin*.42)*density*covered, [59,44,37]


def source_skin(name, window):
    image = Image.open(ASSETS / name).convert('RGB')
    u0,v0,u1,v1 = window
    crop = (u0*image.width, (1-v1)*image.height, u1*image.width, (1-v0)*image.height)
    return np.asarray(image.transform((WIDTH,HEIGHT),Image.Transform.EXTENT,crop,Image.Resampling.BICUBIC),dtype=float)


def main():
    manifest = json.loads((ASSETS/'footballer-960.json').read_text())
    coordinates,covered = face_space(manifest,(ASSETS/'footballer-960.bin').read_bytes())
    light = source_skin('skin-light.webp',manifest['faceUV'])
    dark = source_skin('skin-dark.webp',manifest['faceUV'])
    for identity,skin in [('kane',light),('musiala',light*(1-MUSIALA_SKIN_BLEND)+dark*MUSIALA_SKIN_BLEND)]:
        opacity,color = original_stubble(coordinates,covered,identity)
        opacity = opacity[...,None]
        painted = skin*(1-opacity)+np.asarray(color)*opacity
        path = ASSETS/f'face-{identity}.webp'
        Image.fromarray(np.clip(painted,0,255).astype('uint8'),'RGB').save(path,quality=86,method=6)
        print(path.name,path.stat().st_size,'bytes')


if __name__ == '__main__':
    main()

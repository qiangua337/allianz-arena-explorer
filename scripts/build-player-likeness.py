"""Paint original facial details onto the shared CC0 skin in its existing UV layout."""
import argparse
import json
import runpy
from pathlib import Path

import numpy as np
from PIL import Image
from likeness_musiala import paint_musiala


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


def source_skin(name, window):
    image = Image.open(ASSETS / name).convert('RGB')
    u0,v0,u1,v1 = window
    crop = (u0*image.width, (1-v1)*image.height, u1*image.width, (1-v0)*image.height)
    return np.asarray(image.transform((WIDTH,HEIGHT),Image.Transform.EXTENT,crop,Image.Resampling.BICUBIC),dtype=float)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--player', choices=['kane', 'musiala'])
    player = parser.parse_args().player
    if player != 'musiala':
        kane_path = Path(__file__).with_name('build-kane-complexion.py')
        runpy.run_path(kane_path)['main']()
    if player == 'kane':
        return

    manifest = json.loads((ASSETS/'footballer-960.json').read_text())
    coordinates,covered = face_space(manifest,(ASSETS/'footballer-960.bin').read_bytes())
    light = source_skin('skin-light.webp',manifest['faceUV'])
    dark = source_skin('skin-dark.webp',manifest['faceUV'])
    skin = light*(1-MUSIALA_SKIN_BLEND)+dark*MUSIALA_SKIN_BLEND
    painted = paint_musiala(skin, coordinates, covered, smoothstep)
    path = ASSETS/'face-musiala.webp'
    Image.fromarray(np.clip(painted,0,255).astype('uint8'),'RGB').save(path,quality=83,method=6)
    print(path.name,path.stat().st_size,'bytes')


if __name__ == '__main__':
    main()

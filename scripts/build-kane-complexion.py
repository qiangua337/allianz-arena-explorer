"""Bake Kane's hand-painted complexion into the existing CC0 head UV layout."""
import json
import runpy
from pathlib import Path

import numpy as np
from PIL import Image


COMMON = runpy.run_path(Path(__file__).with_name('build-player-likeness.py'))
ASSETS = COMMON['ASSETS']
smoothstep = COMMON['smoothstep']


def bell(center, radius, value):
    return np.exp(-((value-center)/radius)**2)


def tint(skin, color, opacity):
    opacity = np.clip(opacity, 0, 1)[..., None]
    return skin*(1-opacity)+np.asarray(color)*opacity


def complexion(skin, coordinates, covered):
    x, y, z = coordinates
    side = np.abs(x)
    front = smoothstep(.090, .145, z)
    temple = bell(1.763, .021, y)*bell(.068, .020, side)*smoothstep(.042, .112, z)
    cheek = bell(1.709, .023, y)*bell(.045, .024, side)*front
    nose = bell(1.707, .016, y)*bell(0, .018, x)*smoothstep(.155, .182, z)
    skin = tint(skin, [204, 147, 126], covered*(.13*cheek+.08*nose+.12*temple))
    side_fade = bell(.070, .019, side)*(1-smoothstep(.107, .137, z))
    fade_edge = 1.738-.026*(1-smoothstep(-.013, .041, z))
    side_fade *= smoothstep(fade_edge-.016, fade_edge+.012, y)
    side_fade *= 1-smoothstep(.075, .091, side)
    skin = tint(skin, [116, 93, 78], side_fade*covered*.46)

    # The cheeks are trimmed high toward the sideburns. The darkest
    # stubble runs along the jaw and below the lower lip.
    edge = 1.663+.051*smoothstep(.015, .076, side)
    edge += .0014*np.sin(196*x+87*z)+.0007*np.cos(459*z)
    side_depth = smoothstep(.048, .119, z)
    beard = (1-smoothstep(edge-.006, edge+.005, y))*side_depth
    beard *= smoothstep(1.617, 1.638, y)
    beard *= .64+.36*bell(1.648, .022, y)

    mustache_arc = 1.689-.010*smoothstep(.006, .034, side)
    mustache = bell(mustache_arc, .0049, y)*(1-smoothstep(.025, .037, side))*front
    mustache *= .76+.24*smoothstep(.001, .008, side)
    under_lip = bell(1.656, .0056, y)*bell(0, .011, x)*front
    burn = bell(.080, .012, side)*smoothstep(.044, .086, z)
    burn *= (1-smoothstep(.108, .134, z))*smoothstep(1.701, 1.730, y)
    burn *= 1-smoothstep(1.758, 1.780, y)

    clear_lips = bell(1.673, .0066, y)*(1-smoothstep(.019, .035, side))*front
    beard *= 1-.92*clear_lips
    mustache *= 1-.84*clear_lips
    mask = np.maximum.reduce([beard, mustache*.90, under_lip*.82, burn*.71])*covered

    # Thin beard marks and broad colour variation are both baked into the
    # one diffuse image, so they work in the small mobile atlas too.
    mottling = .90+.05*np.sin(x*247+y*383)+.05*np.cos(z*451-y*271)
    rng = np.random.default_rng(1973)
    roots = rng.random(y.shape)>.84
    hair = (.48*roots+.30*np.roll(roots, 1, axis=0)
            +.22*np.roll(roots, (2, 1), axis=(0, 1)))
    skin = tint(skin, [99, 77, 65], mask*mottling*.53)
    return tint(skin, [76, 59, 49], mask*hair*.58)


def main():
    manifest = json.loads((ASSETS/'footballer-960.json').read_text())
    coordinates, covered = COMMON['face_space'](manifest, (ASSETS/'footballer-960.bin').read_bytes())
    skin = COMMON['source_skin']('skin-light.webp', manifest['faceUV'])
    painted = complexion(skin, coordinates, covered)
    path = ASSETS/'face-kane.webp'
    image = Image.fromarray(np.clip(painted, 0, 255).astype('uint8'))
    image.save(path, quality=81, method=6)
    print(path.name, path.stat().st_size, 'bytes')


if __name__ == '__main__':
    main()

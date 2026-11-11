"""Paint subtle complexion landmarks in the shared CC0 face UV layout."""
import numpy as np


def paint_musiala(skin, coordinates, covered, smoothstep):
    x, y, z = coordinates
    side = np.abs(x)
    front = smoothstep(.094, .150, z)

    def bell(center, width, value):
        return np.exp(-((value-center)/width)**2)

    def tint(base, color, weight):
        alpha = (np.clip(weight, 0, 1)*covered)[..., None]
        return base*(1-alpha)+np.asarray(color)*alpha

    # Keep the neck's skin mix at the UV boundary. Soft cheek warmth and the
    # lighter nose ridge read under match lighting at either atlas resolution.
    cheek = bell(.046, .029, side)*bell(1.707, .025, y)*front
    brow_plane = bell(1.769, .038, y)*bell(0, .061, x)*front
    nose = bell(0, .016, x)*bell(1.719, .021, y)*smoothstep(.143, .184, z)
    result = tint(skin, [183, 131, 106], .17*cheek+.15*brow_plane+.23*nose)
    lower_lip = bell(1.670, .0049, y)*bell(0, .023, x)*smoothstep(.157, .171, z)
    upper_lip = bell(1.676, .0036, y)*bell(0, .023, x)*smoothstep(.157, .169, z)
    result = tint(result, [158, 105, 99], .33*lower_lip+.21*upper_lip)

    mustache_y = 1.689+.002*(1-smoothstep(0, .027, side))
    mustache = bell(mustache_y, .0039, y)*bell(.013, .013, side)*front
    mustache *= smoothstep(.002, .006, side)
    chin = bell(1.644, .006, y)*bell(0, .021, x)*front
    mask = np.maximum(.25*mustache, .43*chin)
    mottled = .65+.35*np.sin(x*329+y*414+z*713)**2
    result = tint(result, [64, 44, 38], mask*mottled)

    # A few small, asymmetrical pigmentation marks keep the two profiles
    # distinct without adding geometry or photographic pixels.
    cheek_mark = bell(-.048, .0017, x)*bell(1.699, .0019, y)*front
    temple_mark = bell(.055, .0014, x)*bell(1.763, .0017, y)*front
    return tint(result, [98, 62, 49], .32*cheek_mark+.22*temple_mark)

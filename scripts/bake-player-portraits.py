"""Bake masked detail from attributed portraits into the existing athlete atlas.

The reference image never ships with the game. A source is sampled only over
the facial regions it sees clearly. This build-time transfer keeps the same
face UVs and runtime GPU cost as the original hand-painted head.
"""
import argparse
import json
import runpy
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

COMMON = runpy.run_path(Path(__file__).with_name('build-player-likeness.py'))
ASSETS = COMMON['ASSETS']
smoothstep = COMMON['smoothstep']

# Each row aligns a mesh height with the corresponding left, centre and right
# points in the licensed reference. Reference pixel positions are measured in
# a 1279×1919 view for Kane and the existing 800×1200 WebP for Musiala.
KANE_ROWS = np.array([
    [1.627, 595, 668, 741, 837, .021],
    [1.644, 504, 669, 809, 790, .050],
    [1.662, 476, 667, 826, 708, .059],
    [1.673, 462, 663, 841, 666, .064],
    [1.683, 449, 662, 846, 617, .066],
    [1.696, 437, 661, 853, 580, .068],
    [1.704, 430, 667, 859, 556, .072],
    [1.727, 432, 657, 870, 478, .073],
    [1.744, 431, 654, 862, 434, .075],
    [1.759, 442, 656, 852, 398, .074],
    [1.777, 472, 658, 834, 319, .068],
    [1.796, 475, 660, 816, 225, .066],
    [1.816, 515, 654, 790, 205, .061],
])
MUSIALA_ROWS = np.array([
    [1.628, 378, 398, 418, 254, .021],
    [1.644, 371, 399, 427, 247, .048],
    [1.661, 361, 397, 434, 229, .060],
    [1.673, 355, 395, 438, 215, .066],
    [1.684, 351, 394, 445, 207, .067],
    [1.696, 350, 393, 446, 199, .069],
    [1.704, 348, 393, 448, 194, .070],
    [1.727, 346, 393, 452, 182, .074],
    [1.744, 346, 393, 451, 179, .075],
    [1.759, 346, 395, 451, 169, .075],
    [1.777, 347, 397, 445, 156, .069],
    [1.793, 348, 398, 443, 140, .067],
    [1.815, 350, 400, 441, 134, .062],
])


def bell(value, centre, radius):
    return np.exp(-((value-centre)/radius)**2)


def sample_rgb(image, sample_x, sample_y):
    pixels = np.asarray(image, dtype=np.float32)
    x = np.clip(sample_x, 0, image.width-1.001)
    y = np.clip(sample_y, 0, image.height-1.001)
    left, top = x.astype(np.int32), y.astype(np.int32)
    dx, dy = (x-left)[..., None], (y-top)[..., None]
    upper = pixels[top,left]*(1-dx)+pixels[top,left+1]*dx
    lower = pixels[top+1,left]*(1-dx)+pixels[top+1,left+1]*dx
    return upper*(1-dy)+lower*dy


def photo_layer(identity, base, photo, coordinates, covered):
    x, y, z = coordinates
    kane = identity == 'kane'
    rows = KANE_ROWS if kane else MUSIALA_ROWS
    reference_size = (1279, 1919) if kane else (800, 1200)
    left, centre, right, photo_y, halfwidth = [
        np.interp(y, rows[:,0], rows[:,column]) for column in range(1, 6)
    ]
    signed_width = x / halfwidth
    photo_x = centre + signed_width * np.where(x < 0, centre-left, right-centre)
    pixel_x = photo_x * (photo.width / reference_size[0])
    pixel_y = photo_y * (photo.height / reference_size[1])
    sample = sample_rgb(photo, pixel_x, pixel_y)

    # Suppress the directional lighting baked into the reference. Keep soft
    # local pigmentation and the finer pores, beard hairs and lip creases.
    large_radius = photo.width * (.049 if kane else .019)
    broad = sample_rgb(photo.filter(ImageFilter.GaussianBlur(large_radius)), pixel_x, pixel_y)
    medium = sample_rgb(photo.filter(ImageFilter.GaussianBlur(photo.width*.004)), pixel_x, pixel_y)
    micro = np.clip(sample-medium, -16, 11)
    broad_detail = np.clip(medium-broad, -26, 17)
    palette = np.asarray([205,163,141] if kane else [152,109,85], dtype=np.float32)
    sampled = palette + .30*broad_detail + .92*micro

    if kane:
        # Retain the natural ginger-grey beard shape and prevent the open
        # mouth in the source from being painted on closed lip geometry.
        beard = (1-smoothstep(1.675, 1.731, y)) * smoothstep(.013,.048,np.abs(x))
        beard = np.maximum(beard, (1-smoothstep(1.654,1.664,y))*.96)
        beard = np.maximum(beard, bell(y,1.685,.006)*bell(x,0,.028)*.91)
        beard_delta = np.clip(sample - palette, -112, 34)
        sampled = sampled*(1-beard[...,None]*.77) + (palette+beard_delta*.87)*beard[...,None]*.77
    else:
        # Warm cheek transitions and the narrow lower-lip line are already
        # present in the base. Blend the photo's smaller features between them.
        sampled += np.clip(sample-palette,-38,28)*.13

    # No eye whites, open mouth or hard edges from a projected silhouette.
    # Keep the original UV treatment over the eyelid geometry and lip seam.
    eye = bell(np.abs(x),.034,.018)*bell(y,1.744,.0095)
    lip = bell(x,0,.031)*bell(y,1.672 if kane else 1.676,.011 if kane else .013)
    outer = (1-smoothstep(.68,.96,np.abs(signed_width)))
    mask = covered * outer * smoothstep(.079,.143,z) * smoothstep(1.618,1.641,y)
    mask *= 1-smoothstep(1.790 if kane else 1.786,1.805 if kane else 1.798,y)
    mouth_x, mouth_y, mouth_w, mouth_h = (668, 665, 112, 48) if kane else (387, 216, 37, 17)
    mouth_radius = np.hypot((photo_x-mouth_x)/mouth_w, (photo_y-mouth_y)/mouth_h)
    mask *= (1-.93*eye) * (1-.98*lip) * smoothstep(.82,1.31,mouth_radius)
    if not kane:
        photo_eye = np.maximum(bell(photo_x,357,15),bell(photo_x,414,17))*bell(photo_y,179,9)
        mask *= (1-.86*photo_eye)
    mask *= .87 if kane else .70
    return base*(1-mask[...,None]) + sampled*mask[...,None]


def finish_features(identity, skin, coordinates, covered):
    """Paint brows, eyelid folds and lip pigment onto the skin surface."""
    x, y, z = coordinates
    side = np.abs(x)
    kane = identity == 'kane'
    front = covered * smoothstep(.121, .149, z)

    def layer(result, color, alpha):
        opacity = np.clip(alpha, 0, 1)[..., None]
        return result*(1-opacity) + np.asarray(color)*opacity

    # Rest-space coordinates follow the same deformation as the eyelids.
    # Fine fibres replace the separate hard eyebrow cutout in the likenesses.
    span = smoothstep(.013, .023, side) * (1-smoothstep(.050, .065, side))
    if kane:
        brow_y = np.interp(side, [.014,.023,.035,.048,.063], [1.755,1.758,1.760,1.759,1.752])
        thickness = np.interp(side, [.014,.026,.043,.064], [.0018,.0025,.0020,.0009])
        brow_color = [78,58,47]
    else:
        brow_y = np.interp(side, [.014,.025,.037,.049,.063], [1.754,1.757,1.761,1.761,1.752])
        thickness = np.interp(side, [.014,.025,.042,.064], [.0021,.0029,.0024,.0010])
        brow_color = [57,42,37]
    brow_y += np.sign(x)*.00045
    deviation = y-brow_y
    root = bell(deviation, 0, thickness)
    strands = .50 + .50*np.sin(6900*side + 3200*deviation + 1.5*np.sin(520*side))
    density = front*span*(.14*bell(deviation, 0, thickness*1.8)+root*(.60+.24*strands))
    result = layer(skin, brow_color, density)

    lid_span = smoothstep(.015, .022, side)*(1-smoothstep(.041, .052, side))
    crease_y = 1.749+.0028*bell(side,.030,.013)
    fold = bell(y, crease_y, .00125)*lid_span*front
    result = layer(result, [117,82,68] if kane else [81,54,45], fold*.18)

    # Keep fine texture while reducing lipstick-like saturation around the
    # mouth. The centre seam is narrow and the pigment tapers at each corner.
    mouth_front = covered*smoothstep(.148,.167,z)
    lip_width = bell(x,0,.023)*(1-smoothstep(.025,.035,side))
    lip = bell(y,1.672,.0076)*lip_width*mouth_front
    neutral = np.sum(result*np.array([.30,.57,.13]),axis=2)
    muted = neutral[..., None]+(result-neutral[..., None])*.72
    result = result*(1-lip[..., None]*.54)+muted*lip[..., None]*.54
    seam_y = 1.673+.0009*bell(side,.006,.006)-.0009*smoothstep(.013,.029,side)
    seam = bell(y,seam_y,.00125)*lip_width*mouth_front
    return layer(result, [94,60,53] if kane else [73,44,43], seam*.22)


def build(identity, photo_path):
    manifest = json.loads((ASSETS/'footballer-960.json').read_text())
    coordinates, covered = COMMON['face_space'](manifest, (ASSETS/'footballer-960.bin').read_bytes())
    window = manifest['faceUV']
    light = COMMON['source_skin']('skin-light.webp', window)
    if identity == 'kane':
        base = runpy.run_path(Path(__file__).with_name('build-kane-complexion.py'))['complexion'](
            light, coordinates, covered
        )
        x,y,z = coordinates
        # The older base carried a strongly red, flat lip patch.
        lip_tint = .22*bell(x,0,.036)*bell(y,1.669,.012)*smoothstep(.133,.164,z)
        base = base*(1-lip_tint[...,None])+np.asarray([157,112,98])*lip_tint[...,None]
    else:
        dark = COMMON['source_skin']('skin-dark.webp', window)
        blend = COMMON['MUSIALA_SKIN_BLEND']
        base = COMMON['paint_musiala'](light*(1-blend)+dark*blend, coordinates, covered, smoothstep)
    with Image.open(photo_path) as source:
        photo = source.convert('RGB')
    painted = photo_layer(identity, base, photo, coordinates, covered)
    painted = finish_features(identity, painted, coordinates, covered)
    path = ASSETS/f'face-{identity}.webp'
    image = Image.fromarray(np.clip(painted,0,255).astype('uint8'))
    byte_limit = 12894 if identity == 'kane' else 7522
    for quality in range(84,47,-3):
        image.save(path,quality=quality,method=6)
        if path.stat().st_size <= byte_limit:
            break
    else:
        raise ValueError(f'Face atlas exceeded {byte_limit} bytes: {path}')
    print(path.name,path.stat().st_size,'bytes')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--kane-photo',type=Path)
    parser.add_argument('--musiala-photo',type=Path,default=ASSETS.parent/'editorial/musiala.webp')
    parser.add_argument('--player',choices=['kane','musiala'])
    args = parser.parse_args()
    if args.player != 'musiala':
        if not args.kane_photo:
            parser.error('provide the credited Kane portrait as --kane-photo')
        build('kane',args.kane_photo)
    if args.player != 'kane':
        build('musiala',args.musiala_photo)


if __name__ == '__main__':
    main()

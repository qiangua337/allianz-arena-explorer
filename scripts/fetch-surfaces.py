"""Prepare a small, redistributable CC0 surface bundle; no remote runtime API."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / 'dist' / 'assets' / 'pbr'
ROOT.mkdir(parents=True, exist_ok=True)
HEADERS = {'User-Agent': 'ArenaExplorer local asset preparation'}
SURFACES = {
    'concrete': ('smooth_concrete_floor', ['normal', 'rough']),
    'wood': ('wood_table_001', ['diff', 'normal', 'rough']),
    'fabric': ('fabric_pattern_07', ['normal', 'rough']),
    'rubber': ('rubber_tiles', ['normal', 'rough']),
    'plaster': ('painted_plaster_wall', ['normal', 'rough']),
    'grass': ('grass_ground', ['normal', 'rough']),
}
ENVIRONMENTS = {'day': 'autumn_field_puresky', 'night': 'qwantani_night_puresky', 'indoor': 'studio_small_08'}

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as response:
        return response.read()

def prepare(entry):
    key, asset, channels, environment = entry
    manifest = json.loads(fetch('https://api.polyhaven.com/files/' + asset))
    records = {}
    for channel in channels:
        aliases = {'diff': ['Diffuse', 'diffuse', 'Color'], 'normal': ['nor_gl'], 'rough': ['Rough', 'rough'], 'hdr': ['hdri']}
        source_key = next(name for name in aliases[channel] if name in manifest)
        source = manifest[source_key]['1k']['hdr' if environment else 'jpg']
        name = key + '-' + channel + ('.hdr' if environment else '.jpg')
        target = ROOT / name
        data = target.read_bytes() if target.exists() else fetch(source['url'])
        if hashlib.md5(data).hexdigest() != source['md5']:
            raise ValueError('Asset checksum mismatch: ' + name)
        target.write_bytes(data)
        records[channel] = {'file': name, 'bytes': len(data), 'md5': source['md5'], 'source': source['url']}
    return key, {'asset': asset, 'license': 'CC0-1.0', 'page': 'https://polyhaven.com/a/' + asset, 'maps': records}

entries = [(k, v[0], v[1], False) for k, v in SURFACES.items()]
entries += [(k, v, ['hdr'], True) for k, v in ENVIRONMENTS.items()]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = dict(pool.map(prepare, entries))
result = {'provider': 'Poly Haven', 'credit': 'Powered by Poly Haven', 'license': 'https://polyhaven.com/license', 'resolution': 1024, 'assets': results}
(ROOT / 'manifest.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps({key: sum(m['bytes'] for m in value['maps'].values()) for key, value in results.items()}, indent=2))
print('Total MB:', round(sum(m['bytes'] for a in results.values() for m in a['maps'].values()) / 1048576, 2))

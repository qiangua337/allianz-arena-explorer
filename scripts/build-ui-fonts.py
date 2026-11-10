"""Build the licensed Arena web-font derivatives from pinned Google Fonts files.

Requires fonttools[woff]==4.68.0. Dependencies and upstream TTF files are build
inputs only; the site ships the WOFF2 files, complete OFL licenses and manifest.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import sys
import unicodedata
import urllib.request

COMMIT = '5bb28733cec313b63fbd415b574b5ae35c8aa8b8'
BASE = f'https://raw.githubusercontent.com/google/fonts/{COMMIT}/'
SOURCES = {
    'NotoSansSC[wght].ttf': ('ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf', 'a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da'),
    'NotoSansSC-OFL.txt': ('ofl/notosanssc/OFL.txt', '1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9'),
    'BarlowCondensed-SemiBold.ttf': ('ofl/barlowcondensed/BarlowCondensed-SemiBold.ttf', '7b619d14bc2327509a9ef32b0890f709626f7ecc9ff61191c2a4314c5499d2d9'),
    'BarlowCondensed-OFL.txt': ('ofl/barlowcondensed/OFL.txt', '186d750eb496a4c17a76385f82be6aea2ac1cf2de074a811d63786cf374ea73f'),
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def is_cjk(codepoint: int) -> bool:
    return any(a <= codepoint <= b for a, b in [(0x2E80, 0x9FFF), (0xF900, 0xFAFF), (0xFE10, 0xFE1F), (0xFE30, 0xFE4F), (0xFF00, 0xFFEF), (0x20000, 0x323AF)])


def collect_characters(dist: Path):
    characters = set(range(0x20, 0x7F))
    files = []
    for path in sorted(dist.rglob('*')):
        relative = path.relative_to(dist)
        if not path.is_file() or path.suffix not in {'.js', '.html'} or 'vendor' in relative.parts:
            continue
        data = path.read_bytes()
        text = data.decode('utf-8-sig')
        decoded = html.unescape(text)
        characters.update(ord(c) for c in decoded if unicodedata.category(c) not in {'Cc', 'Cs'})
        for high, low in re.findall(r'\\u([dD][89aAbB][0-9a-fA-F]{2})\\u([dD][c-fC-F][0-9a-fA-F]{2})', text):
            characters.add(0x10000 + ((int(high, 16) - 0xD800) << 10) + int(low, 16) - 0xDC00)
        for a, b, c in re.findall(r'\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})', text):
            cp = int(a or b or c, 16)
            if 0x20 <= cp <= 0x10FFFF and not 0xD800 <= cp <= 0xDFFF:
                characters.add(cp)
        files.append({'file': relative.as_posix(), 'sha256': sha256(data)})
    return characters, files


def read_sources(cache: Path, download: bool):
    cache.mkdir(parents=True, exist_ok=True)
    records = []
    for filename, (path, expected) in SOURCES.items():
        target = cache / filename
        if not target.exists():
            if not download:
                raise SystemExit(f'Missing {target}; use --download for the pinned official source.')
            request = urllib.request.Request(BASE + path, headers={'User-Agent': 'Arena-UI-Fonts/1.0'})
            data = urllib.request.urlopen(request, timeout=120).read()
            if sha256(data) != expected:
                raise SystemExit(f'Upstream checksum mismatch: {filename}')
            target.write_bytes(data)
        data = target.read_bytes()
        if sha256(data) != expected:
            raise SystemExit(f'Cached source checksum mismatch: {filename}')
        records.append({'file': filename, 'url': BASE + path, 'bytes': len(data), 'sha256': expected})
    return records


def rename_derivative(font, family: str, style: str, source_hash: str, charset_hash: str):
    # Keep copyright (0), trademark (7), designer and complete OFL notices.
    # Rename the derivative's primary names instead of claiming the original
    # family. In particular the Noto source's reserved name is "Source".
    replacements = {
        1: family + ' ' + style, 2: 'Regular',
        3: family.replace(' ', '') + '-' + style + ';src-' + source_hash[:16] + ';ui-' + charset_hash[:16],
        4: family + ' ' + style, 6: family.replace(' ', '') + '-' + style,
        16: family, 17: style,
    }
    font['name'].names = [record for record in font['name'].names if record.nameID not in {*replacements, 18, 25}]
    for name_id, value in replacements.items():
        font['name'].setName(value, name_id, 3, 1, 0x409)
        font['name'].setName(value, name_id, 1, 0, 0)


def save_woff2(font, path: Path):
    font.flavor = 'woff2'
    font.recalcTimestamp = False
    temporary = path.with_suffix('.woff2.tmp')
    font.save(temporary, reorderTables=True)
    temporary.replace(path)


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', type=Path, required=True, help='Build-only upstream TTF/license cache.')
    parser.add_argument('--fonttools-path', type=Path, help='Optional temporary pip --target directory.')
    parser.add_argument('--download', action='store_true', help='Download missing pinned Google Fonts sources.')
    parser.add_argument('--dist', type=Path, default=Path(__file__).resolve().parents[1] / 'dist')
    parser.add_argument('--output', type=Path, help='Default: dist/assets/fonts.')
    args = parser.parse_args()
    if args.fonttools_path:
        sys.path.insert(0, str(args.fonttools_path.resolve()))
    import fontTools
    from fontTools import subset
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    import brotli

    output = args.output or args.dist / 'assets/fonts'
    output.mkdir(parents=True, exist_ok=True)
    sources = read_sources(args.sources, args.download)
    requested, scanned = collect_characters(args.dist)
    source = TTFont(args.sources / 'NotoSansSC[wght].ttf', recalcTimestamp=False)
    supported = requested & set(source.getBestCmap())
    missing = requested - supported
    missing_cjk = sorted(cp for cp in missing if is_cjk(cp))
    if missing_cjk:
        raise SystemExit('The source font lacks existing CJK characters: ' + ', '.join(f'U+{cp:04X}' for cp in missing_cjk))
    charset_hash = sha256(b''.join(cp.to_bytes(4, 'big') for cp in sorted(supported)))
    options = subset.Options()
    options.notdef_outline = True
    options.recalc_timestamp = False
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=sorted(supported))
    subsetter.subset(source)
    records = []
    for weight, style in [(500, 'Medium'), (800, 'ExtraBold')]:
        font = instantiateVariableFont(source, {'wght': weight}, inplace=False, optimize=True)
        font['OS/2'].usWeightClass = weight
        if 'STAT' in font:
            del font['STAT']
        rename_derivative(font, 'Arena Sans SC', style, SOURCES['NotoSansSC[wght].ttf'][1], charset_hash)
        filename = f'arena-sans-sc-{weight}.woff2'
        save_woff2(font, output / filename)
        check = TTFont(output / filename)
        if set(check.getBestCmap()) != supported or 'fvar' in check:
            raise SystemExit(f'Incorrect static subset coverage: {filename}')
        record = {'file': filename, 'family': 'Arena Sans SC', 'style': 'normal', 'weight': weight,
                  'bytes': (output / filename).stat().st_size, 'sha256': sha256((output / filename).read_bytes()),
                  'characters': len(check.getBestCmap()), 'glyphs': len(check.getGlyphOrder()), 'source': 'NotoSansSC[wght].ttf', 'licenseFile': 'OFL-NotoSansSC.txt'}
        records.append(record)
        print(json.dumps(record, ensure_ascii=False), flush=True)
    font = TTFont(args.sources / 'BarlowCondensed-SemiBold.ttf', recalcTimestamp=False)
    original_cmap = set(font.getBestCmap())
    if 'DSIG' in font:
        del font['DSIG']
    rename_derivative(font, 'Arena Condensed', 'SemiBold', SOURCES['BarlowCondensed-SemiBold.ttf'][1], SOURCES['BarlowCondensed-SemiBold.ttf'][1])
    filename = 'arena-condensed-600.woff2'
    save_woff2(font, output / filename)
    check = TTFont(output / filename)
    assert set(check.getBestCmap()) == original_cmap
    record = {'file': filename, 'family': 'Arena Condensed', 'style': 'normal', 'weight': 600,
              'bytes': (output / filename).stat().st_size, 'sha256': sha256((output / filename).read_bytes()),
              'characters': len(check.getBestCmap()), 'glyphs': len(check.getGlyphOrder()), 'source': 'BarlowCondensed-SemiBold.ttf', 'licenseFile': 'OFL-BarlowCondensed.txt'}
    records.append(record)
    print(json.dumps(record), flush=True)
    for source_name, output_name in [('NotoSansSC-OFL.txt', 'OFL-NotoSansSC.txt'), ('BarlowCondensed-OFL.txt', 'OFL-BarlowCondensed.txt')]:
        (output / output_name).write_bytes((args.sources / source_name).read_bytes())
    current_characters, current_files = collect_characters(args.dist)
    if current_characters != requested:
        raise SystemExit('UI characters changed during the build; rerun to include the latest HTML and JavaScript.')
    scanned = current_files
    manifest = {
        'license': 'SIL Open Font License 1.1', 'upstreamRepository': 'https://github.com/google/fonts',
        'upstreamCommit': COMMIT, 'sources': sources, 'fonts': records,
        'coverage': {'scan': 'All non-vendor dist .js and .html, HTML entities and JavaScript Unicode/hex escapes, plus printable ASCII.',
                     'sourceFileCount': len(scanned), 'requestedCharacters': len(requested),
                     'requestedCJKCharacters': sum(is_cjk(cp) for cp in requested), 'subsetCharacters': len(supported),
                     'charsetSha256': charset_hash, 'subsetCodepoints': sorted(supported),
                     'systemFallbackCharacters': [{'character': chr(cp), 'codepoint': f'U+{cp:04X}', 'name': unicodedata.name(chr(cp), 'UNNAMED')} for cp in sorted(missing)],
                     'scannedFiles': scanned},
        'processing': {'noto': 'FontTools Unicode subsetting with standard layout closure and hinting retained; full wght instantiation to 500 and 800; STAT removed; derivative names replaced; deterministic WOFF2 encoding.',
                       'barlow': 'Complete upstream SemiBold glyph set retained, derivative names replaced, stale DSIG removed, deterministic WOFF2 encoding.',
                       'copyright': 'Original copyright, author and OFL name-table records retained; complete unmodified upstream OFL files accompany the derivatives.',
                       'fontTools': fontTools.__version__, 'brotli': brotli.__version__},
    }
    (output / 'SOURCES.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'requested': len(requested), 'covered': len(supported), 'cjk': manifest['coverage']['requestedCJKCharacters'],
                      'fallback': manifest['coverage']['systemFallbackCharacters'], 'totalBytes': sum(r['bytes'] for r in records)}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()

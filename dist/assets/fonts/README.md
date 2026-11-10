# Arena web fonts

These locally served font derivatives are licensed under the **SIL Open Font License 1.1**, separately from the application's MIT license. The complete, unmodified upstream licenses and copyright notices are in [OFL-NotoSansSC.txt](OFL-NotoSansSC.txt) and [OFL-BarlowCondensed.txt](OFL-BarlowCondensed.txt).

- `arena-sans-sc-500.woff2`: Noto Sans SC instantiated at 500, for Chinese body text.
- `arena-sans-sc-800.woff2`: Noto Sans SC instantiated at 800, for Chinese headings.
- `arena-condensed-600.woff2`: Barlow Condensed SemiBold at 600, with the complete upstream glyph repertoire retained.

The modified primary family names are **Arena Sans SC** and **Arena Condensed**. Original copyright, author, license and license-URL metadata are preserved. The Noto upstream license reserves the name `Source`; the derivatives do not use that reserved name as their primary font name.

The Chinese subsets cover every current supported character in all non-vendor `dist/**/*.js` and `dist/**/*.html` files, including `visual-credits.html`, HTML entities and JavaScript Unicode/hex escapes. Printable ASCII is always retained. The build fails if an existing CJK character is absent from the source font. Both Chinese weights retain the same coverage, standard layout features and hinting. Existing system-font fallbacks remain necessary for symbols outside the source repertoire, future user-entered names, and emoji. The English face retains its full upstream Latin repertoire.

[SOURCES.json](SOURCES.json) records pinned upstream URLs and SHA-256 values, output hashes, exact sizes, character coverage, scanned source-file hashes and processing details.

## Rebuild

Keep upstream inputs and build dependencies outside the published directory. For the recorded toolchain:

```sh
python -m pip install --target /tmp/arena-fonttools 'fonttools[woff]==4.68.0' 'brotli==1.2.1' 'zopfli==0.4.3'
python scripts/build-ui-fonts.py --sources /tmp/arena-font-sources --fonttools-path /tmp/arena-fonttools --download
```

If FontTools is already installed, omit `--fonttools-path`. `--download` only fetches missing files from the pinned official Google Fonts commit; existing inputs must match their recorded checksums. Normal website loading does not contact Google Fonts and does not require Python or FontTools.

This is a candidate OpenSCAD WASM build from the source lock and recipe at the tagged commit. It does not automatically replace the deployed application's engine.

- `openscad.js` / `openscad.wasm`: compiled engine.
- `engine-corresponding-source.tar.xz`: input source trees, their licenses, exact lock and complete build recipe.
- `engine-source.tar.xz.part*`: the same archive split into 20 MB pieces; concatenate in numbered order.
- `source-parts.json` / `SHA256SUMS`: source and binary integrity checks.
- `CMakeCache.txt` / `toolchain.txt`: configuration and compiler information.

See `engine-build/README.md` in the tagged commit for rebuild instructions. OpenSCAD is GPL-2.0-or-later; dependencies retain their original licenses and notices in the source trees. Release files contain no application login password or hosting credentials.

# Build modifications

SCAD to 3D contributors, 2026-09-24.

The source archive includes the original, hash-verified upstream files. `compile.sh` applies these changes inside the build container:

- Boost `tools/build/src/tools/emscripten.jam`: replace `-fwasm-exceptions` with `-fexceptions` to match OpenSCAD's exception ABI.
- Fontconfig `Makefile.am`: build/install only the fontconfig headers and library, use the release archive's generated headers, and disable execution of the target `fc-cache` tool on the host.

The script adds dated modification comments to both edited files. No OpenSCAD source file is manually patched. Its configured feature set is a single-threaded web build with CGAL and Manifold; Qt/OpenGL rendering, Cairo and test executables are disabled. The application's browser worker controls input and reads the generated STL. This is a custom source build, not an official OpenSCAD binary release.

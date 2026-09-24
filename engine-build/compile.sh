#!/usr/bin/env bash
set -euo pipefail
prefix=/emsdk/upstream/emscripten/cache/sysroot
mkdir -p /out
cmake_lib() {
  local name="$1"; shift
  emcmake cmake -S "/sources/$name" -B "/build-$name" -G Ninja \
    -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$prefix" \
    -DBUILD_SHARED_LIBS=OFF "$@"
  cmake --build "/build-$name" --parallel 2
  cmake --install "/build-$name"
}
# zlib 1.3.1's CMake creates shared and static targets with the same output
# under Emscripten. Its configure script supports an explicit static-only build.
cd /sources/zlib
emconfigure ./configure --static --prefix="$prefix"
emmake make -j2
emmake make install
cmake_lib libzip -DENABLE_COMMONCRYPTO=OFF -DENABLE_GNUTLS=OFF -DENABLE_MBEDTLS=OFF \
  -DENABLE_OPENSSL=OFF -DENABLE_BZIP2=OFF -DENABLE_LZMA=OFF -DENABLE_ZSTD=OFF \
  -DBUILD_TOOLS=OFF -DBUILD_REGRESS=OFF -DBUILD_EXAMPLES=OFF -DBUILD_DOC=OFF
cd /sources/boost
# Match the exception ABI used by OpenSCAD and Emscripten.
sed -i 's/-fwasm-exceptions/-fexceptions/g' tools/build/src/tools/emscripten.jam
sed -i '1i# Modified by SCAD to 3D contributors on 2026-09-24: use the OpenSCAD exception ABI.' tools/build/src/tools/emscripten.jam
./bootstrap.sh
./b2 -j2 --disable-icu --prefix="$prefix" --with-filesystem --with-program_options \
  --with-regex --with-system address-model=32 \
  cxxflags="-std=c++17 -stdlib=libc++ -fexceptions" \
  linkflags="-stdlib=libc++ -fexceptions" link=static runtime-link=static \
  release toolset=emscripten install
cd /sources/libffi
./autogen.sh
emconfigure ./configure --host=wasm32-unknown-linux --prefix="$prefix" \
  --enable-static --disable-shared --disable-dependency-tracking \
  --disable-builddir --disable-multi-os-directory --disable-raw-api --disable-docs
emmake make -j2
emmake make install SUBDIRS=include
cd /sources/glib
meson setup /build-glib --prefix="$prefix" --cross-file=/recipe/emscripten-crossfile.meson \
  --default-library=static --buildtype=release --wrap-mode=nodownload \
  --force-fallback-for=pcre2,gvdb -Dselinux=disabled -Dxattr=false -Dlibmount=disabled \
  -Dnls=disabled -Dtests=false -Dglib_assert=false -Dglib_checks=false
meson compile -C /build-glib -j2
meson install -C /build-glib
cmake_lib freetype -DFT_REQUIRE_ZLIB=TRUE -DFT_DISABLE_BZIP2=TRUE \
  -DFT_DISABLE_PNG=TRUE -DFT_DISABLE_HARFBUZZ=TRUE -DFT_DISABLE_BROTLI=TRUE
cmake_lib libxml2 -DLIBXML2_WITH_PYTHON=OFF -DLIBXML2_WITH_LZMA=OFF \
  -DLIBXML2_WITH_ZLIB=OFF -DLIBXML2_WITH_ICONV=OFF -DLIBXML2_WITH_TESTS=OFF
cd /sources/fontconfig
# Command-line utilities cannot run on the cross-compilation host. The release
# archive already contains the generated fc-lang/fc-case headers used by libfontconfig.
python3 - <<'PY'
from pathlib import Path
p=Path('Makefile.am');s=p.read_text();a=s.index('SUBDIRS=');b=s.index('\nif ENABLE_DOCS',a)
s='# Modified by SCAD to 3D contributors on 2026-09-24: build only the cross-compiled library.\n'+s[:a]+'SUBDIRS=fontconfig src'+s[b:];s=s.replace('RUN_FC_CACHE_TEST=test -z "$(DESTDIR)"','RUN_FC_CACHE_TEST=false');p.write_text(s)
PY
export FREETYPE_CFLAGS="-I$prefix/include/freetype2"
export FREETYPE_LIBS="-lfreetype -lz"
emconfigure ./autogen.sh --host=none --disable-docs --disable-shared --enable-static \
  --sysconfdir=/ --localstatedir=/ --with-default-fonts=/fonts --enable-libxml2 --prefix="$prefix"
emmake make -j2
emmake make install
cmake_lib harfbuzz -DHB_HAVE_FREETYPE=ON -DHB_BUILD_UTILS=OFF
cmake_lib eigen -DBUILD_TESTING=OFF
cd /sources/gmp
emconfigure ./configure --disable-assembly --host=none --enable-cxx --prefix="$prefix" HOST_CC=gcc
emmake make -j2
emmake make install
cd /sources/mpfr
emconfigure ./configure --host=none --with-gmp="$prefix" --prefix="$prefix"
emmake make -j2
emmake make install
cmake_lib cgal
cmake_lib doubleconversion -DBUILD_TESTING=OFF
emcmake cmake -S /sources/openscad -B /build-openscad -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DWASM_BUILD_TYPE=web -DEXPERIMENTAL=ON -DSNAPSHOT=ON \
  -DOPENSCAD_COMMIT=ce5039f8a -DOPENSCAD_VERSION=2025.03.25 \
  -DENABLE_TESTS=OFF -DENABLE_CAIRO=OFF -DMANIFOLD_DOWNLOADS=OFF \
  -DBoost_USE_STATIC_RUNTIME=ON -DBoost_USE_STATIC_LIBS=ON
cmake --build /build-openscad --parallel 2
cp /build-openscad/openscad.js /build-openscad/openscad.wasm /out/
cp /build-openscad/CMakeCache.txt /out/CMakeCache.txt
emcc --version > /out/toolchain.txt
python3 --version >> /out/toolchain.txt
cmake --version >> /out/toolchain.txt
meson --version >> /out/toolchain.txt

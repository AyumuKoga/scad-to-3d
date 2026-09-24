# Source inputs are downloaded and verified by fetch-sources.py before this build.
ARG SDK_IMAGE
FROM ${SDK_IMAGE} AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
    autoconf automake autopoint bison build-essential cmake flex gettext git \
    gperf libtool ninja-build pkg-config python3-pip texinfo xz-utils \
    && python3 -m pip install meson==1.6.1 packaging==24.2 \
    && rm -rf /var/lib/apt/lists/*
ENV CFLAGS="-O3 -fexceptions" CXXFLAGS="-O3 -fexceptions" LDFLAGS="-fexceptions"
ENV CMAKE_BUILD_PARALLEL_LEVEL=2
ENV PKG_CONFIG_PATH=/emsdk/upstream/emscripten/cache/sysroot/lib/pkgconfig
COPY sources /sources
COPY engine-build /recipe
RUN --network=none bash /recipe/compile.sh
FROM scratch AS output
COPY --from=build /out/ /

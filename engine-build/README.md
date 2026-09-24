# OpenSCAD WASM source build

This recipe builds a new engine from explicitly pinned source inputs. It does **not** claim to reproduce the old official `2025.03.25.wasm24456` binary. The application still uses that binary until a candidate from this recipe passes its browser tests; see `docs/engine-provenance.md` for deployment status.

## Inputs and licenses

`sources.lock.json` identifies every downloaded source by HTTPS URL, commit where applicable, and SHA-256. OpenSCAD is pinned to `ce5039f8a9545ad5a8cf197b3ca11c0939bc67f1`. Its git submodules, compiled external libraries, GLib's nested dependencies and Emscripten runtime sources are included. Each source tree retains its own copyright and license files. The application and original build scripts are GPL-2.0-or-later; upstream files retain their own licenses.

The Docker SDK is pinned by digest (Emscripten 3.1.74). Standard host build utilities are installed from the image's Ubuntu repositories; their versions are recorded by the build. Byte-for-byte identical output is not promised. Source inputs are checked before extraction, and the compilation stage has networking disabled so it cannot silently fetch another library.

## Rebuild (Linux, Docker BuildKit, Python 3.12+)

```sh
python3 engine-build/fetch-sources.py
python3 engine-build/package-source.py
SDK_IMAGE=$(python3 -c "import json; print(json.load(open('engine-build/sources.lock.json'))['sdkImage'])")
docker build --progress=plain --build-arg "SDK_IMAGE=$SDK_IMAGE" \
  --file engine-build/Dockerfile --output type=local,dest=.cache/engine-output .cache/engine-context
```

Source download and SDK setup require network access; compilation does not. Allow several GB of free disk space and sufficient RAM. `compile.sh` contains every local source modification and configuration option. `sources/emscripten` contains the matching runtime source for the SDK; it is supplied for inspection/modification and is not substituted into the pinned SDK automatically.

To rebuild from a source release, unpack `engine-corresponding-source.tar.xz` into an empty directory and run the Docker command there with `--file engine-build/Dockerfile` and the current directory (`.`) as build context. Read the SDK digest from the included lock file. There is no need to download the library sources again. The build emits `openscad.js`, `openscad.wasm`, CMake configuration and toolchain information.

## Releases and zero-cost CI

The workflow runs only in a **public** repository on GitHub's standard `ubuntu-24.04` runner. It does not use paid larger runners, Actions artifact storage, caches or Packages. Outputs and their corresponding source are attached to a GitHub prerelease for testing. The workflow never deploys the application automatically.

Each release contains a full source archive, its SHA-256, and numbered 20 MB pieces for hosts with individual-file size limits. Concatenate **all** pieces in numerical filename order, check the complete SHA-256 from `source-parts.json`, then unpack. For example, on macOS/Linux:

```sh
cat engine-source.tar.xz.part* > engine-source.tar.xz
shasum -a 256 engine-source.tar.xz
tar -xJf engine-source.tar.xz
```

The input source trees are packaged without modification; compilation changes only the copy inside Docker. All build-time edits are in the included recipe. Retain released source as long as the matching engine is distributed; do not replace release assets with unrelated builds.

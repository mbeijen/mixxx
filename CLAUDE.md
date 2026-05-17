# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Mixxx is a cross-platform Free DJ application written in C++20 with Qt 6, plus JavaScript for
controller mappings and QML for the next-gen UI. See `README.md` and `CONTRIBUTING.md` for the
canonical project overview, build instructions, and code style. `AGENTS.md` summarizes the same
architectural pointers below.

## Build & Test

Mixxx uses CMake + Ninja/Make. The standard out-of-tree build:

```shell
mkdir build && cd build
cmake ..
cmake --build . --parallel $(nproc)
```

This produces a `mixxx` executable and (if `BUILD_TESTING` is enabled) a `mixxx-test` binary.
Dependency setup varies per platform — use the helper under `tools/` (e.g. `tools/debian_buildenv.sh
setup`, `tools/macos_buildenv.sh setup`, `tools\windows_buildenv.bat`). See `CONTRIBUTING.md` for
the full table.

Common CMake options (toggle with `-DOPTION=ON/OFF`): `BUILD_TESTING`, `BUILD_BENCH`,
`SANITIZE_ADDRESS`, `SANITIZE_UNDEFINED`, `SANITIZE_THREAD`, `DEBUG_ASSERTIONS_FATAL`,
`WARNINGS_FATAL`, `RUBBERBAND`, `KEYFINDER`, `HID`, `ENGINEPRIME`, `QGLES2`.

### Tests

Tests are GoogleTest-based and discovered automatically when `BUILD_TESTING` is on. From the build
directory:

```shell
ctest                                           # run all tests
ctest -R BeatsTest                              # run tests matching a regex
./mixxx-test --gtest_filter='BeatsTest.*'       # run directly (debuggable)
./mixxx-test --gtest_list_tests                 # list available tests
./mixxx-test --benchmark                        # benchmarks (needs -DBUILD_BENCH=ON)
```

`mixxx-test` must be invoked from the **repo root** as the working directory (CTest already does
this). Test sources live under `src/test/`.

### Lint / format

Formatting and linting run through `pre-commit` (installs Git hooks for commit + push):

```shell
pip install pre-commit
pre-commit install
pre-commit install -t pre-push
pre-commit run --all-files          # run every hook on the whole repo
pre-commit run clang-format -a      # run a single hook
SKIP=clang-format,end-of-file-fixer git commit   # skip specific hooks (preferred over --no-verify)
```

Hooks cover: `clang-format` and `clang-tidy` (C++), `eslint` (controller JS), `qmlformat` /
`qmllint` (QML), `gersemi` (CMake), `codespell`, `markdownlint`, `prettier`, `flake8`, and more.
**Only format new or modified code** — never mass-reformat unrelated code, and keep formatting
commits separate from logic commits.

## Architecture

### Thread model

- **Main (GUI) thread**: Qt event loop, widgets, library, controllers.
- **Engine thread**: real-time audio callback. **No allocations, no locks, no blocking syscalls.**
  It may *emit* Qt signals (queued connections deliver them elsewhere) but must not *receive*
  signals or otherwise wait. Adding code that allocates or locks on this thread is a real-time
  safety regression.
- **Worker threads**: analyzer, caching reader, network/broadcast, database. Communicate with the
  engine via lock-free FIFOs (`util/fifo.h`) and `ControlObject` writes.

### ControlObject / ControlProxy

The primary cross-component communication mechanism. A `ControlObject` is identified by a
`ConfigKey` of the form `[Group], key_name` (e.g. `[Channel1], play`). Components subscribe via
`ControlProxy`, which is the *only* safe way to read/write/observe COs from another thread (the
proxy marshals updates appropriately). CO/setting keys use `snake_case`. New COs are typically
created near the object that owns the underlying state (e.g. `EngineBuffer`, `BasePlayer`).

### Qt object ownership: `parented_ptr` / `make_parented`

Mixxx relies on Qt's parent-child ownership tree. `parented_ptr<T>` (in `src/util/parented_ptr.h`)
holds a `QObject*` that **must** acquire a parent before the `parented_ptr` is destroyed — it is a
non-owning handle that asserts on dangling. Use `make_parented<T>(parent, ...)` to construct.
Naked `new`/`delete` are forbidden — use `std::make_unique`, `std::make_shared`, or
`make_parented`.

### Big-picture module layout

```
src/
  engine/        Real-time audio engine (EngineMixer, EngineBuffer, channels, effects, controls)
  mixer/         Per-deck player objects (Deck, BaseTrackPlayer, Microphone, Auxiliary)
  controllers/   HID/MIDI/Bulk controller backends + JS engine for mappings
  library/       Track library, playlists, crates, external libraries (iTunes, Serato, Rekordbox…)
  effects/       Effect chains, presets, native + LV2 effect backends
  analyzer/      Background analysis (beats, key, waveform, silence, ReplayGain)
  sources/       Audio file decoders (FLAC, MP3, Opus, FFmpeg, …)
  soundio/       Audio device I/O (PortAudio + JACK)
  waveform/      Waveform rendering (legacy widgets + rendergraph)
  rendergraph/   New scene-graph renderer used by QML waveforms
  skin/widget/   Legacy QWidget-based skin system (XML skins under res/skins/)
  qml/           New QML-based UI (in flux — see CONTRIBUTING.md)
  preferences/   Settings storage + DlgPref* dialogs
  control/       ControlObject / ControlProxy implementation
  vinylcontrol/  Timecoded vinyl decoding
  util/          Shared utilities (parented_ptr, fifo, sample, …)
  test/          GoogleTest suites for all of the above
res/
  controllers/   Controller mapping JS + XML descriptions (shipped to users)
  skins/         Legacy XML skins
  qml/           Shared QML modules
```

Two UI stacks coexist: the legacy XML/QWidget skins under `src/skin/` + `src/widget/` and the
in-progress QML UI under `src/qml/` + `res/qml/`. New UI work generally targets QML, but most of
the shipping product still uses the legacy skins.

## Conventions worth knowing up front

- **C++20**, 4-space indent (never tabs), 100-col hard / 80-col soft line limit.
- Naming: classes `CamelCase`, methods `camelBack()`, members `m_prefix`, pointers `pPrefix`,
  constants `kPascalCase`, `enum class CamelCase`, CO/setting keys `snake_case`.
- `#pragma once`, not include guards. Include order: matching header → system → Qt → 3rd-party →
  Mixxx local → forward decls, blank-line separated, alphabetical within groups.
- Wrap new code in `namespace mixxx {}`. `QStringLiteral("…")` for literals, `tr("…")` for
  translatable strings. `override` on overrides, drop redundant `virtual`. Non-const out-params
  use pointers, not references (legacy convention).
- Use `std::chrono::duration` for time values, `Q_ENUM` + `QVariant::fromValue` instead of manual
  `static_cast<int>` on enums — both are common review nits.
- `VERIFY_OR_DEBUG_ASSERT(cond) { recovery; }` for defensive checks that should also degrade
  gracefully in release builds.
- **Every commit must build** (matters for `git bisect`). Keep refactor commits and logic commits
  separate. Target bug fixes at the current stable branch (currently `2.6`), features at `main`.

For the full guide see `CONTRIBUTING.md` and the
[Coding Guidelines wiki page](https://github.com/mixxxdj/mixxx/wiki/Coding-Guidelines).

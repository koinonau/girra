const { chmodSync, existsSync, readdirSync, readFileSync, writeFileSync } = require('node:fs')
const { execFileSync } = require('node:child_process')
const { join, resolve } = require('node:path')
const electronBuilderNativeRebuild = require('./scripts/electron-builder-native-rebuild.cjs')
const {
  assertPackagedDaemonEntryExists,
  verifyPackagedDaemonEntryBoots
} = require('./scripts/verify-packaged-daemon-entry.cjs')
const {
  createPackagedRuntimeNodeModuleResources,
  prunePackagedRuntimeNodeModules,
  verifyPackagedMainRuntimeDeps
} = require('./packaged-runtime-node-modules.cjs')
const { verifyLinuxGlibcFloor } = require('./scripts/verify-linux-glibc-floor.cjs')
const { writeMacBuildCompatibility } = require('./scripts/mac-build-compatibility.cjs')
const { verifyPackagedPluginResources } = require('./scripts/verify-packaged-plugin-resources.cjs')
const {
  verifyPackagedNodePtyJobOwnership
} = require('./scripts/verify-packaged-node-pty-job-ownership.cjs')
const { verifySkillsCliRuntime } = require('./scripts/verify-skills-cli-runtime.cjs')
const { verifyStaticAppImagePackage } = require('./scripts/static-appimage-package-contract.cjs')
const { signWindowsUninstallerViaSignPath } = require('./scripts/windows-uninstaller-signing.cjs')

// Why: dev-channel builds must carry the *release* identity — same bundle id,
// Developer ID signature, and notarization ticket — or Squirrel.Mac refuses to
// swap them over an installed Girra and macOS treats each build as a new app.
const isMacHourly = process.env.ORCA_MAC_HOURLY === '1'
const isMacDaily = process.env.ORCA_MAC_DAILY === '1'
const isMacAdhoc = process.env.ORCA_MAC_ADHOC === '1'
// Why a second set of variables rather than making the mac ones platform-neutral:
// the mac ones gate `isMacRelease` below, which turns on hardened runtime,
// notarization, and root-level `forceCodeSigning`. A Windows dev build that
// reused them would fail packaging outright for want of a cert it is
// deliberately not using.
const isWinHourly = process.env.ORCA_WIN_HOURLY === '1'
const isWinDaily = process.env.ORCA_WIN_DAILY === '1'
const isWinAdhoc = process.env.ORCA_WIN_ADHOC === '1'
const isWinDevChannel = isWinHourly || isWinDaily || isWinAdhoc
const isMacRelease = process.env.ORCA_MAC_RELEASE === '1' || isMacHourly || isMacDaily || isMacAdhoc
const isLinuxArm64Release = process.env.ORCA_LINUX_ARM64_RELEASE === '1'
const localBuildVersion =
  isMacRelease || isWinDevChannel ? undefined : process.env.ORCA_LOCAL_BUILD_VERSION
const isHourlyChannel = isMacHourly || isWinHourly
const isDailyChannel = isMacDaily || isWinDaily
const isAdhocChannel = isMacAdhoc || isWinAdhoc
const devChannelBuildVersion = isHourlyChannel
  ? process.env.ORCA_HOURLY_BUILD_VERSION
  : isDailyChannel
    ? process.env.ORCA_DAILY_BUILD_VERSION
    : isAdhocChannel
      ? process.env.ORCA_ADHOC_BUILD_VERSION
      : undefined
// Why each dev channel gets its own repo rather than tagging into the main one:
// the releases atom feed exposes only the 10 newest entries, so 24 hourly tags a
// day would evict every stable/RC entry and strand users on a feed with nothing
// to install. Keeping adhoc/daily separate from hourly too means a branch build
// or a once-a-day cut cannot be picked up by someone who only meant to ride
// main's hourlies.
const devChannelRepo = isHourlyChannel
  ? 'orca-hourly'
  : isDailyChannel
    ? 'orca-daily'
    : isAdhocChannel
      ? 'orca-adhoc'
      : null
const appId = 'com.koinonau.girra'
// Why: freshness detection needs immutable identity metadata from this exact
// app build, but never needs the skill package bytes or a runtime network read.
const skillFreshnessResources = {
  from: 'resources/skills',
  to: 'skills'
}
// Why: SSH relay deploy resolves bundles from process.resourcesPath in packaged
// apps. Keeping relay assets as extraResources makes them real directories
// instead of paths hidden inside app.asar.
const relayExtraResource = {
  from: 'out/relay',
  to: 'relay'
}
// Why: bundled plugins are immutable install inputs and must remain ordinary
// directories so the startup bootstrap can verify and publish exact bytes.
const bundledPluginResources = {
  from: 'resources/plugins/launch',
  to: 'plugins/launch'
}
// Why: the main bundle, packaged CLI, and SSH paths all execute
// from package directories where pnpm's symlink farm is absent. Copy the exact
// runtime dependency closure to Resources/node_modules so bare require() calls
// do not fall through to a developer checkout's node_modules.
// Why the single file rather than the package root: app.asar carries no node_modules, so main's
// lazy require in deferred-emoji-shortcode-dataset.ts resolves only out of Resources/node_modules,
// but emojibase-data is 49 MB of locale datasets and worktree naming reads exactly this 166 KB file.
const emojiShortcodeDatasetResource = {
  from: 'node_modules/emojibase-data/en/shortcodes/emojibase.json',
  to: 'node_modules/emojibase-data/en/shortcodes/emojibase.json'
}
const commonExtraResources = [
  relayExtraResource,
  bundledPluginResources,
  skillFreshnessResources,
  emojiShortcodeDatasetResource
]
// electron-builder replaces these defaults when `depends` is configured; retain
// Electron's loader requirements alongside Girra's headless-host dependencies.
const debElectronRuntimeDependencies = [
  'libgtk-3-0',
  'libnotify4',
  'libnss3',
  'libxss1',
  'libxtst6',
  'xdg-utils',
  'libatspi2.0-0',
  'libuuid1',
  'libsecret-1-0'
]
const rpmElectronRuntimeDependencies = [
  'gtk3',
  'libnotify',
  'nss',
  'libXScrnSaver',
  '(libXtst or libXtst6)',
  'xdg-utils',
  'at-spi2-core',
  '(libuuid or libuuid1)'
]

// Why mirrored, not imported: this config is CJS loaded by electron-builder outside the TS build.
// Keep in sync with isMarkdownDocumentName() in src/main/ipc/markdown-documents.ts and with
// config/nsis/girra-installer-hooks.nsh, which registers the same set on Windows.
const MARKDOWN_FILE_EXTENSIONS = ['md', 'markdown', 'mdx']

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId,
  // Why this diverges from package.json's `name`, still 'orca': Electron derives the Linux
  // userData directory from that field, so renaming it would orphan every Linux profile.
  productName: 'Girra',
  // Why the scheme stays `orca`: links already in the wild resolve against it (ADR 0002).
  protocols: [{ name: 'Girra', schemes: ['orca'] }],
  toolsets: { appimage: '1.0.3' },
  ...(devChannelBuildVersion
    ? { extraMetadata: { version: devChannelBuildVersion } }
    : localBuildVersion
      ? { extraMetadata: { version: localBuildVersion } }
      : {}),
  directories: {
    buildResources: 'resources/build'
  },
  files: [
    '!**/.vscode/*',
    // Why: these repo-only inputs are either bundled into out/ or copied via
    // extraResources. Shipping them in app.asar bloats the desktop bundle.
    '!src{,/**/*}',
    '!config{,/**/*}',
    '!docs{,/**/*}',
    '!mobile{,/**/*}',
    '!native{,/**/*}',
    '!skills{,/**/*}',
    // Why: guide/stub authoring sources are compiled into runtime artifacts; shipping
    // either source tree would duplicate content without a runtime consumer.
    '!skill-guides{,/**/*}',
    '!skill-stubs{,/**/*}',
    '!tests{,/**/*}',
    // Why: examples/ is plugin authoring documentation with no runtime consumer —
    // bundled plugins ship via extraResources from resources/plugins/launch/. It also
    // carries hostile-panel, the adversarial fixture the containment tests point at,
    // which must never reach a user's install.
    '!examples{,/**/*}',
    // Why: pr-evidence/ is a local e2e screenshot output (ORCA_CAPTURE_EVIDENCE);
    // it is gitignored, but exclude it defensively so a stray local capture at
    // package time never bloats app.asar.
    '!pr-evidence{,/**/*}',
    // Why: local agent/tooling directories may contain worktree symlink loops;
    // they are never runtime inputs and must not be traversed by electron-builder.
    '!{.claude,.grok,.agents,.codex}{,/**/*}',
    '!Casks{,/**/*}',
    '!{AGENTS.md,CLAUDE.md,DEVELOPING.md,bundle-size-progress.md,ORCHESTRATION_IMPLEMENTATION_CHECKLIST.md,ORCHESTRATION_STRUCTURED_OUTPUT_DESIGN.md}',
    '!out/**/*.test.js',
    // Why: main builds with sourcemap:'hidden' so release CI can publish maps
    // for decoding minified crash traces. The app never loads them (no
    // sourceMappingURL is emitted), and packing them would add ~34MB to app.asar.
    '!out/**/*.map',
    // Why: Vite's manifest is only used to project the paired web client.
    '!out/renderer/.vite{,/**/*}',
    // Why: out/electron-dev caches `pnpm dev`'s per-branch Electron.app copies (~270MB each).
    // CI never creates it, but packaging on a machine that has run dev would pack them all.
    '!out/electron-dev{,/**/*}',
    '!electron.vite.config.{js,ts,mjs,cjs}',
    '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,CHANGELOG.md,README.md}',
    '!{.env,.env.*,.npmrc,pnpm-lock.yaml}',
    '!tsconfig.json',
    '!resources/skills/**',
    // Why: bundled plugins ship via extraResources to resources/plugins/launch;
    // packing the source tree into app.asar would duplicate those exact bytes.
    '!resources/plugins/launch/**',
    // Why: the Windows CLI shim ships via extraResources to resources/bin/girra.cmd
    // (beside the native resources/bin/girra.exe). Packing the source tree into
    // app.asar too lets asarUnpack:['resources/**'] extract a second copy at
    // app.asar.unpacked/resources/win32/bin/girra.cmd with no adjacent girra.exe,
    // which fails to launch the CLI (#7351).
    '!resources/win32{,/**/*}'
  ],
  // Why: the CLI entry-point lives in out/cli/ but imports shared modules
  // from out/shared/ and local hook mutators from out/main/. These paths must be
  // unpacked so that Node's require() can resolve the cross-directory imports
  // when the CLI runs outside the asar archive.
  // Why: daemon-entry.js is forked as a separate Node.js process and must be
  // accessible on disk (not inside the asar archive) for child_process.fork().
  // Why: the CLI is compiled by tsc (not bundled), so its runtime imports
  // resolve at runtime via Node's normal module lookup. The shim launches
  // the CLI with ELECTRON_RUN_AS_NODE, which bypasses Electron's asar
  // integration — dependencies inside the asar archive are invisible to
  // require(). Unpack CLI runtime deps so they resolve from
  // app.asar.unpacked/node_modules/.
  // Why: remote runtime connections use WebSocket + E2EE from the packaged CLI
  // before the GUI process starts, so those deps need the same treatment.
  // Why: out/package.json pins compiled output to CommonJS so parent
  // package.json files with type=module cannot change the packaged CLI loader.
  // Why: the OpenCode SQLite worker entry is also spawned by the scanner
  // service, which runs under ELECTRON_RUN_AS_NODE and so cannot see into
  // app.asar. Left packed, that spawn fails closed and every OpenCode session
  // disappears from Agent Session History in packaged builds only. Worker
  // entries reached solely from the Electron main process stay packed, since
  // asar redirects their app.asar paths.
  asarUnpack: [
    'out/package.json',
    'out/cli/**',
    'out/shared/**',
    'out/main/agent-hooks/**',
    'out/main/claude/**',
    'out/main/claude-accounts/keychain.js',
    'out/main/daemon-entry.js',
    'out/main/session-scanner-service-entry.js',
    'out/main/wsl-transcript-fs-process-entry.js',
    'out/main/session-scanner-opencode-sqlite-worker-entry.js',
    'out/main/plugin-host-entry.js',
    'out/main/computer-sidecar.js',
    'out/main/parcel-watcher-process-entry.js',
    'out/main/chunks/**',
    'resources/**',
    'node_modules/ws/**',
    'node_modules/tweetnacl/**',
    'node_modules/zod/**',
    'node_modules/yaml/**'
  ],
  artifactBuildCompleted: ({ file, arch }) => {
    if (file.endsWith('.AppImage')) {
      verifyStaticAppImagePackage(file, arch)
    }
  },
  afterPack: async (context) => {
    const resourcesDir =
      context.electronPlatformName === 'darwin'
        ? join(
            context.appOutDir,
            `${context.packager.appInfo.productFilename}.app`,
            'Contents',
            'Resources'
          )
        : join(context.appOutDir, 'resources')
    if (!existsSync(resourcesDir)) {
      throw new Error(`Missing packaged resources directory: ${resourcesDir}`)
    }
    // FpmTarget replaces this with deb/rpm while building those artifacts from the shared app tree.
    if (context.electronPlatformName === 'linux') {
      writeFileSync(join(resourcesDir, 'package-type'), 'AppImage')
    }
    if (context.electronPlatformName === 'darwin') {
      const architectureByEnum = { 1: 'x64', 3: 'arm64' }
      const architecture = architectureByEnum[context.arch]
      if (!architecture) {
        throw new Error(`Unsupported local-build compatibility architecture: ${context.arch}`)
      }
      const version = context.packager.appInfo.version
      let commit = process.env.ORCA_BUILD_COMMIT || process.env.GITHUB_SHA || 'unknown'
      if (commit === 'unknown') {
        try {
          commit = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
            encoding: 'utf8'
          }).trim()
        } catch {
          // Source archives can still produce a signed build with an explicit version.
        }
      }
      writeMacBuildCompatibility(resourcesDir, { version, commit, architecture })
    }
    stampPackagedCliVersion(resourcesDir, context.packager.appInfo.version)
    prunePackagedRuntimeNodeModules(resourcesDir, context.electronPlatformName, context.arch)
    // Why: a Linux runner-image glibc bump silently shipped a node-pty pty.node
    // requiring GLIBC_2.34, crashing the app on startup on Ubuntu 20.04 (#9902).
    // Fail packaging if any bundled native binary exceeds the supported floor.
    // Why after the prune: cross-builds intentionally install every optional
    // native variant, so an arm64 slice still carries the x64 @parcel/watcher
    // until prunePackagedRuntimeNodeModules drops it.
    if (context.electronPlatformName === 'linux') {
      // Why the arch is passed: symbol-version checks pass happily on a wrong-architecture binary,
      // so a cross-built slice could ship the host's pty.node and only fail at runtime.
      verifyLinuxGlibcFloor(context.appOutDir, {
        targetArch: { 1: 'x64', 3: 'arm64' }[context.arch]
      })
    }
    verifyPackagedMainRuntimeDeps(resourcesDir)
    // Why: boot the packaged daemon-entry under plain Node, but only for the
    // slice matching the packaging host's arch — daemon-entry.js is JS, yet it
    // require()s the native (N-API) node-pty for the TARGET arch, which the host
    // Node cannot load cross-arch. `Arch` enum: ia32=0, x64=1, armv7l=2,
    // arm64=3, universal=4 (universal contains the host slice, so run it).
    const archEnumByNodeArch = { ia32: 0, x64: 1, armv7l: 2, arm64: 3 }
    const hostArchEnum = archEnumByNodeArch[process.arch]
    const canExecuteTargetArch = context.arch === hostArchEnum || context.arch === 4
    if (context.electronPlatformName === 'win32') {
      if (process.platform === 'win32' && canExecuteTargetArch) {
        verifyPackagedNodePtyJobOwnership(resourcesDir)
      } else {
        console.log('[verify-packaged-node-pty] skipped cross-platform or cross-arch package')
      }
    }
    verifySkillsCliRuntime(join(resourcesDir, 'app.asar.unpacked', 'out'), resourcesDir, {
      executeCommands: canExecuteTargetArch
    })
    if (!canExecuteTargetArch) {
      console.log(
        `[verify-skills-cli-runtime] skipped command probes on cross-arch slice (target ${context.arch}, host ${process.arch})`
      )
    }
    if (canExecuteTargetArch) {
      verifyPackagedDaemonEntryBoots(resourcesDir)
    } else {
      // Why: a cross-arch slice can't be booted by the host Node, but the
      // unpacked entry must still exist — its absence is a layout regression
      // regardless of arch, so only the boot is skipped, not the check.
      assertPackagedDaemonEntryExists(resourcesDir)
      console.log(
        `[verify-packaged-daemon-entry] skipped boot on cross-arch slice (target ${context.arch}, host ${process.arch})`
      )
    }
    // Why: inspect electron-builder's real output so a broken extraResources
    // mapping fails packaging before bundled content reaches users.
    verifyPackagedPluginResources(resourcesDir)
    chmodUnixCliLaunchers(resourcesDir, context.electronPlatformName)
    chmodMacServeSimHelpers(resourcesDir, context.electronPlatformName)
    for (const filename of readdirSync(resourcesDir)) {
      if (!filename.startsWith('agent-browser-')) {
        continue
      }
      // Why: the upstream package has inconsistent executable bits across
      // platform binaries (notably darwin-x64). child_process.execFile needs
      // the copied binary to be executable in packaged apps.
      chmodSync(join(resourcesDir, filename), 0o755)
    }
    if (context.electronPlatformName === 'darwin') {
      await signMacComputerUseHelper(join(resourcesDir, 'Girra Computer Use.app'), context.packager)
      await signMacStandaloneHelper(
        join(resourcesDir, '..', 'MacOS', 'orca-notification-status'),
        'orca-notification-status',
        context.packager
      )
      await signMacStandaloneHelper(
        join(resourcesDir, '..', 'MacOS', 'orca-keyboard-layout'),
        'orca-keyboard-layout',
        context.packager
      )
    }
  },
  win: {
    executableName: 'Girra',
    // Why: Windows installers are signed after electron-builder packaging by
    // SignPath, so the packager cannot infer the updater publisherName.
    //
    // Why dev channels drop it instead: they ship unsigned, because SignPath's
    // approval waits are budgeted in hours and cannot fit an hourly cadence.
    // electron-updater Authenticode-verifies every installer it downloads
    // against the publisherName baked into the *installed* app's app-update.yml
    // (NsisUpdater.verifySignature), and skips verification entirely when that
    // name is absent. An unsigned build that still claimed 'SignPath Foundation'
    // would therefore reject its own channel's next build — and its way back to
    // stable with it. Dropping it is what makes dev→dev and dev→stable work.
    // Why a sign hook on a build that does not sign: it is the only moment
    // electron-builder exposes the NSIS uninstaller (built in its own makensis
    // pass, embedded, then deleted). The hook signs nothing — it relays the file
    // to and from the CI SignPath request, and is inert when the relay env vars
    // are unset, so local and dev builds are unaffected. publisherName stays on
    // its existing channel split above.
    signtoolOptions: {
      sign: signWindowsUninstallerViaSignPath,
      ...(isWinDevChannel ? {} : { publisherName: 'SignPath Foundation' })
    },
    ...(isWinDevChannel ? { verifyUpdateCodeSignature: false } : {}),
    extraResources: [
      ...commonExtraResources,
      ...createPackagedRuntimeNodeModuleResources('win32'),
      {
        from: 'resources/win32/bin/girra.cmd',
        to: 'bin/girra.cmd'
      },
      // Why the same shim twice: hook scripts and docs already on disk invoke `orca`.
      {
        from: 'resources/win32/bin/girra.cmd',
        to: 'bin/orca.cmd'
      },
      {
        from: 'native/windows-cli-launcher/.build/girra.exe',
        to: 'bin/girra.exe'
      },
      {
        from: 'node_modules/agent-browser/bin/agent-browser-win32-x64.exe',
        to: 'agent-browser-win32-x64.exe'
      },
      {
        from: 'native/computer-use-windows/runtime.ps1',
        to: 'computer-use-windows/runtime.ps1'
      }
    ]
  },
  nsis: {
    artifactName: 'girra-windows-setup.${ext}',
    shortcutName: '${productName}',
    uninstallDisplayName: '${productName}',
    createDesktopShortcut: 'always',
    // Why: electron-builder allows one include, so both Windows installer hooks live in it -
    // the relocated-daemon uninstall sweep (guarded by ${isUpdated} so it never runs during an
    // update's uninstallOldVersion) and the additive markdown "Open with" registration.
    // Windows markdown association is deliberately NOT done via `fileAssociations`; see the
    // header comment in that file for why that would steal the user's default .md handler.
    include: resolve(__dirname, 'nsis', 'girra-installer-hooks.nsh')
  },
  mac: {
    // Why rank Alternate: Girra joins Finder's "Open With" list for Markdown without claiming
    // LSHandlerRank ownership, so whichever editor the user already prefers stays the default.
    // Why one entry per extension: app-builder-lib globs `*.${ext}`, which an array would break.
    fileAssociations: MARKDOWN_FILE_EXTENSIONS.map((ext) => ({
      ext,
      name: 'Markdown Document',
      description: 'Markdown Document',
      role: 'Editor',
      rank: 'Alternate'
    })),
    icon: 'resources/build/icon.icns',
    entitlements: 'resources/build/entitlements.mac.plist',
    entitlementsInherit: 'resources/build/entitlements.mac.plist',
    extendInfo: {
      NSAppleEventsUsageDescription:
        'Girra allows terminal-launched developer tools to automate local apps when you request it.',
      NSBluetoothAlwaysUsageDescription:
        'Girra allows terminal-launched developer tools to access Bluetooth devices when you request it.',
      NSBluetoothPeripheralUsageDescription:
        'Girra allows terminal-launched developer tools to access Bluetooth devices when you request it.',
      NSCameraUsageDescription: "Application requests access to the device's camera.",
      NSLocationUsageDescription:
        'Girra allows terminal-launched developer tools to access location when you request it.',
      NSLocalNetworkUsageDescription:
        'Girra allows terminal-launched developer tools to discover and connect to local development servers when you request it.',
      NSMicrophoneUsageDescription: "Application requests access to the device's microphone.",
      NSAudioCaptureUsageDescription:
        'Girra allows terminal-launched developer tools to capture desktop audio when you request it.',
      NSBonjourServices: ['_http._tcp', '_https._tcp'],
      NSDocumentsFolderUsageDescription:
        "Application requests access to the user's Documents folder.",
      NSDownloadsFolderUsageDescription:
        "Application requests access to the user's Downloads folder."
    },
    // Why: local macOS validation builds should launch without Apple release
    // credentials. Hardened runtime + notarization stay enabled only on the
    // explicit release path so production artifacts remain strict while dev
    // artifacts do not fail with broken ad-hoc launch behavior.
    hardenedRuntime: isMacRelease,
    // Why dev builds notarize too, despite the ~10min notary round trip: TCC
    // anchors a notarized Developer ID app's permission grants on identifier +
    // team, which is cdhash-independent and so survives an update. Without a
    // ticket there is no such stable identity, so every build reads as a
    // different client — the grant row stays but stops matching, and file access
    // under Documents/Desktop/Downloads fails with EPERM and no re-prompt. At 24
    // builds a day that revokes the user's grants faster than they can re-grant.
    notarize: isMacRelease,
    extraResources: [
      ...commonExtraResources,
      ...createPackagedRuntimeNodeModuleResources('darwin'),
      {
        from: 'resources/darwin/bin/girra',
        to: 'bin/girra'
      },
      // Why the same shim twice: hook scripts and docs already on disk invoke `orca`.
      {
        from: 'resources/darwin/bin/girra',
        to: 'bin/orca'
      },
      {
        from: 'node_modules/agent-browser/bin/agent-browser-darwin-${arch}',
        to: 'agent-browser-darwin-${arch}'
      },
      {
        from: 'native/computer-use-macos/.build/release/Girra Computer Use.app',
        to: 'Girra Computer Use.app'
      }
    ],
    // Why: the notification-status helper must execute from Contents/MacOS —
    // on macOS 26 UNUserNotificationCenter aborts (bundleProxyForCurrentProcess
    // is nil) for executables launched out of Contents/Resources (#7929).
    extraFiles: [
      {
        from: 'native/notification-status-macos/.build/release/orca-notification-status',
        to: 'MacOS/orca-notification-status'
      },
      {
        from: 'native/keyboard-layout-macos/.build/release/orca-keyboard-layout',
        to: 'MacOS/orca-keyboard-layout'
      }
    ],
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64']
      }
    ]
  },
  // Why: release builds should fail if signing is unavailable instead of
  // silently downgrading to ad-hoc artifacts that look shippable in CI logs.
  forceCodeSigning: isMacRelease,
  dmg: {
    artifactName: 'girra-macos-${arch}.${ext}'
  },
  linux: {
    // Why mimeTypes and not fileAssociations: shared-mime-info already maps *.md/*.markdown to
    // text/markdown, so reusing that type puts Girra in the Open With list without shipping a glob
    // override. A desktop entry's MimeType only adds a handler - mimeapps.list still owns the
    // default. .mdx is deliberately absent: Ubuntu 24.04's mime database maps it to
    // application/x-genesis-32x-rom, so claiming it here would need a glob override.
    mimeTypes: ['text/markdown'],
    // Why plain `girra` where this used to be `orca-ide`: the name that forced the suffix was
    // Ubuntu's GNOME Orca screen reader (`orca` package, /usr/bin/orca), which girra does not collide with.
    executableName: 'girra',
    // Why: the icns source lets electron-builder emit standard hicolor PNG
    // sizes; a single 1024px PNG is ignored by some Linux docks/launchers.
    icon: 'resources/build/icon.icns',
    desktop: {
      entry: {
        // Why: Electron reports WM_CLASS=girra (productName, lowercased) for the visible Linux
        // window; GNOME docks need an exact match to group it with girra.desktop.
        StartupWMClass: 'girra'
      }
    },
    extraResources: [
      ...commonExtraResources,
      ...createPackagedRuntimeNodeModuleResources('linux'),
      {
        from: 'resources/linux/bin/girra',
        to: 'bin/girra'
      },
      // Why the same shim twice: hook scripts and docs already on disk invoke `orca-ide`.
      {
        from: 'resources/linux/bin/girra',
        to: 'bin/orca-ide'
      },
      {
        from: 'node_modules/agent-browser/bin/agent-browser-linux-${arch}',
        to: 'agent-browser-linux-${arch}'
      },
      {
        from: 'native/computer-use-linux/runtime.py',
        to: 'computer-use-linux/runtime.py'
      }
    ],
    // Keep local artifacts aligned with the release pipeline.
    target: ['AppImage', 'deb', 'rpm'],
    maintainer: 'stablyai',
    category: 'Utility'
  },
  appImage: {
    artifactName: isLinuxArm64Release ? 'girra-linux-arm64.${ext}' : 'girra-linux.${ext}'
  },
  deb: {
    packageName: 'girra',
    artifactName: 'girra_${version}_${arch}.${ext}',
    // Why: xvfb lets the bundled `girra serve` CLI run browser panes on a headless
    // Linux host — Chromium needs a display server even for offscreen rendering,
    // and serve starts Xvfb itself when present (see ensure-virtual-display.ts).
    depends: [
      ...debElectronRuntimeDependencies,
      'python3',
      'python3-gi',
      'gir1.2-atspi-2.0',
      'at-spi2-core',
      'xdotool',
      'xclip',
      'xvfb'
    ],
    // Why: symlink the bundled CLI onto PATH at install time so `girra serve`
    // works on a headless host. The in-app CLI registration (CliInstaller) is
    // GUI-triggered and can never run on a server, so without this the CLI is
    // unreachable from the shell on exactly the hosts that need it.
    afterInstall: 'resources/linux/packaging/after-install.sh',
    afterRemove: 'resources/linux/packaging/after-remove.sh'
  },
  rpm: {
    packageName: 'girra',
    artifactName: 'girra-${version}.${arch}.${ext}',
    // Why: see deb depends. RPM distros ship Xvfb as xorg-x11-server-Xvfb (there
    // is no `xvfb` package), so the name differs from the deb here.
    depends: [
      ...rpmElectronRuntimeDependencies,
      'python3',
      'python3-gobject',
      'xdotool',
      'xclip',
      'xorg-x11-server-Xvfb'
    ],
    // Why: same headless CLI-on-PATH registration as deb; rpm runs these via fpm.
    afterInstall: 'resources/linux/packaging/after-install.sh',
    afterRemove: 'resources/linux/packaging/after-remove.sh'
  },
  beforeBuild: electronBuilderNativeRebuild,
  // Why: must be true so that electron-builder rebuilds native modules
  // (node-pty) for each target architecture when producing dual-arch macOS
  // builds (x64 + arm64). With npmRebuild disabled, CI on an arm64 runner
  // packages arm64 binaries into the x64 DMG, causing "posix_spawnp failed"
  // on Intel Macs. The beforeBuild hook performs Girra's targeted rebuild and
  // returns false so electron-builder does not rebuild optional cpu-features.
  npmRebuild: true,
  publish: {
    provider: 'github',
    owner: 'stablyai',
    repo: devChannelRepo ?? 'orca',
    releaseType: devChannelRepo ? 'prerelease' : 'release'
  }
}

// Stamp the effective channel version where node-mode CLI code can read it.
function stampPackagedCliVersion(resourcesDir, version) {
  const packageJsonPath = join(resourcesDir, 'app.asar.unpacked', 'out', 'package.json')
  if (!existsSync(packageJsonPath)) {
    throw new Error(`Missing unpacked CLI package boundary: ${packageJsonPath}`)
  }
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  writeFileSync(packageJsonPath, `${JSON.stringify({ ...packageJson, version }, null, 2)}\n`)
}

function chmodUnixCliLaunchers(resourcesDir, electronPlatformName) {
  if (electronPlatformName === 'win32') {
    return
  }
  for (const launcherName of ['girra', 'orca', 'orca-ide']) {
    const launcherPath = join(resourcesDir, 'bin', launcherName)
    if (!existsSync(launcherPath)) {
      continue
    }
    // Why: packaged Unix installs expose these extraResources as public shell
    // commands, and source/packager mode drift must not ship a non-executable CLI.
    chmodSync(launcherPath, 0o755)
  }
}

function chmodMacServeSimHelpers(resourcesDir, electronPlatformName) {
  if (electronPlatformName !== 'darwin') {
    return
  }
  const helperPaths = [
    join(resourcesDir, 'serve-sim', 'bin', 'serve-sim-bin'),
    join(resourcesDir, 'serve-sim', 'dist', 'simcam', 'serve-sim-camera-helper'),
    join(resourcesDir, 'node_modules', 'serve-sim', 'bin', 'serve-sim-bin'),
    join(resourcesDir, 'node_modules', 'serve-sim', 'dist', 'simcam', 'serve-sim-camera-helper')
  ]
  for (const helperPath of helperPaths) {
    if (existsSync(helperPath)) {
      chmodSync(helperPath, 0o755)
    }
  }
}

async function signMacComputerUseHelper(helperAppPath, packager) {
  if (!existsSync(helperAppPath)) {
    if (isMacRelease) {
      throw new Error(`Missing Girra Computer Use helper app at ${helperAppPath}`)
    }
    return
  }
  const codeSigningInfo =
    isMacRelease && process.env.CSC_LINK && packager?.codeSigningInfo?.value
      ? await packager.codeSigningInfo.value
      : null
  const identity =
    process.env.ORCA_COMPUTER_MACOS_SIGN_IDENTITY ??
    process.env.CSC_NAME ??
    findInstalledMacSigningIdentity(codeSigningInfo?.keychainFile) ??
    (isMacRelease ? null : '-')
  if (!identity) {
    throw new Error('Missing signing identity for Girra Computer Use helper app')
  }
  // Why: TCC grants attach to this nested app's code identity. Sign it before
  // the outer Girra.app is sealed so production builds preserve that identity.
  execFileSync('codesign', codesignArgs(identity, helperAppPath), { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', helperAppPath], {
    stdio: 'inherit'
  })
}

async function signMacStandaloneHelper(helperPath, helperName, packager) {
  if (!existsSync(helperPath)) {
    if (isMacRelease) {
      throw new Error(`Missing ${helperName} helper at ${helperPath}`)
    }
    return
  }
  const codeSigningInfo =
    isMacRelease && process.env.CSC_LINK && packager?.codeSigningInfo?.value
      ? await packager.codeSigningInfo.value
      : null
  const identity =
    process.env.CSC_NAME ??
    findInstalledMacSigningIdentity(codeSigningInfo?.keychainFile) ??
    (isMacRelease ? null : '-')
  if (!identity) {
    throw new Error(`Missing signing identity for ${helperName} helper`)
  }
  // Why: nested executables must be signed before the outer app bundle is sealed.
  const args = ['--force', '--sign', identity]
  if (isMacRelease) {
    args.push('--options', 'runtime', '--timestamp')
  }
  args.push(helperPath)
  execFileSync('codesign', args, { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--strict', helperPath], { stdio: 'inherit' })
}

function codesignArgs(identity, targetPath) {
  const args = ['--force', '--deep', '--sign', identity]
  if (isMacRelease) {
    args.push(
      '--options',
      'runtime',
      '--timestamp',
      '--entitlements',
      resolve(__dirname, '../resources/build/entitlements.computer-use.mac.plist')
    )
  }
  args.push(targetPath)
  return args
}

function findInstalledMacSigningIdentity(keychainFile) {
  try {
    const output = execFileSync(
      'security',
      ['find-identity', '-v', '-p', 'codesigning', ...(keychainFile ? [keychainFile] : [])],
      {
        encoding: 'utf8'
      }
    )
    const releaseMatch =
      output.match(/"([^"]*Developer ID Application:[^"]+)"/) ??
      output.match(/"([^"]*Apple Distribution:[^"]+)"/)
    if (releaseMatch?.[1]) {
      return releaseMatch[1]
    }
    if (!isMacRelease) {
      return output.match(/"([^"]*Apple Development:[^"]+)"/)?.[1] ?? null
    }
  } catch {}
  return null
}

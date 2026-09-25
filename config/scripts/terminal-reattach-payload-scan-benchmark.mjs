#!/usr/bin/env node
// Benchmark: TerminalKittyKeyboardModeTracker.scanReplay over a whole reattach payload,
// measured to justify leaving it alone and to record that porting the daemon mouse
// mirror's includes() pre-filter makes it slower.
//
// Payloads are generated deterministically (LCG, no Math.random) so runs compare.
//
// Run with:  node config/scripts/terminal-reattach-payload-scan-benchmark.mjs
import { performance } from 'node:perf_hooks'
import { TerminalKittyKeyboardModeTracker } from '../../src/shared/terminal-kitty-keyboard-mode-tracker.ts'

const ROUNDS = Number(process.env.GIRRA_REATTACH_SCAN_BENCH_ROUNDS ?? '7')
const MIN_ITERATION_MS = 120

// --- payload generation -----------------------------------------------------

function makeRng(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const WORDS = [
  'src',
  'renderer',
  'components',
  'terminal',
  'pane',
  'connection',
  'reattach',
  'payload',
  'snapshot',
  'daemon',
  'passed',
  'failed',
  'warning',
  'building',
  'index.ts',
  '1.24s',
  'ok'
]

// Heavily SGR-colored scrollback, ~120 cols/line — what a serialized daemon snapshot
// of a colorized TUI/build log looks like.
function buildColoredScrollback(targetBytes, seed) {
  const rng = makeRng(seed)
  const lines = []
  let size = 0
  while (size < targetBytes) {
    let line = ''
    let visible = 0
    while (visible < 118) {
      const word = WORDS[Math.floor(rng() * WORDS.length)]
      const color = 16 + Math.floor(rng() * 200)
      line += `\x1b[38;5;${color}m${word}\x1b[0m `
      visible += word.length + 1
    }
    lines.push(line)
    size += line.length + 1
  }
  return lines.join('\r\n')
}

// Live TUIs also emit cursor moves / erases; keep some of those in the mix.
function withCursorTraffic(body, seed) {
  const rng = makeRng(seed)
  return body
    .split('\r\n')
    .map((line, i) => `\x1b[${(i % 40) + 1};1H\x1b[K${line}${rng() < 0.1 ? '\x1b[?25l' : ''}`)
    .join('\r\n')
}

function buildPayloads() {
  const base200k = buildColoredScrollback(200 * 1024, 1)
  const base2m = buildColoredScrollback(2 * 1024 * 1024, 2)
  const relayTail = buildColoredScrollback(100 * 1024, 3)
  return [
    { name: '200KB snapshot', data: base200k },
    { name: '2MB snapshot', data: base2m },
    { name: '100KB relay tail, cursor traffic', data: withCursorTraffic(relayTail, 4) }
  ]
}

// --- timing -----------------------------------------------------------------

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function timeMsPerCall(fn, arg) {
  let iterations = 1
  while (true) {
    const start = performance.now()
    for (let i = 0; i < iterations; i++) {
      globalThis.__sink = fn(arg)
    }
    const elapsed = performance.now() - start
    if (elapsed >= MIN_ITERATION_MS || iterations >= 1 << 22) {
      return elapsed / iterations
    }
    iterations *= Math.max(2, Math.ceil(MIN_ITERATION_MS / Math.max(elapsed, 0.01)))
  }
}

function measure(fn, arg) {
  timeMsPerCall(fn, arg) // warmup / JIT
  const samples = []
  for (let round = 0; round < ROUNDS; round++) {
    samples.push(timeMsPerCall(fn, arg))
  }
  return median(samples)
}

const pad = (value, width) => String(value).padStart(width)
const kb = (data) => `${(data.length / 1024).toFixed(0)}KB`

// --- run --------------------------------------------------------------------

const payloads = buildPayloads()

console.log('Reattach payload scans, ms/call (median of %d rounds). Lower is better.\n', ROUNDS)
console.log('== TerminalKittyKeyboardModeTracker.scanReplay ==')
console.log(
  `${pad('payload', 36)} ${pad('size', 8)} ${pad('scanReplay', 11)} ${pad('+includes gate', 15)}`
)
const kittyScan = (data) => {
  const tracker = new TerminalKittyKeyboardModeTracker()
  tracker.scanReplay(data)
  return tracker.flags
}
// Mirrors src/main/daemon/terminal-mouse-mode-mirror.ts:41-47.
const kittyGated = (data) => {
  if (!data.includes('\x1b[?') && !data.includes('\x1bc') && !data.includes('\x9b')) {
    return 0
  }
  return kittyScan(data)
}
for (const { name, data } of payloads) {
  console.log(
    `${pad(name, 36)} ${pad(kb(data), 8)} ${pad(measure(kittyScan, data).toFixed(3), 11)} ${pad(measure(kittyGated, data).toFixed(3), 15)}`
  )
}

// The gate can only pay off where no introducer exists: live plain-output chunks, not
// snapshots (which carry ?1049h/?25l by construction).
const liveChunk = buildColoredScrollback(4 * 1024, 5).replaceAll('\x1b', '')
const introducerRows = [
  ['4KB live chunk, no escapes', liveChunk],
  ['4KB live chunk, \\x1b[?25l present', `${liveChunk}\x1b[?25l`]
]
console.log(
  `\n${pad('payload', 36)} ${pad('size', 8)} ${pad('scanReplay', 11)} ${pad('+includes gate', 15)}`
)
for (const [name, data] of introducerRows) {
  console.log(
    `${pad(name, 36)} ${pad(kb(data), 8)} ${pad(measure(kittyScan, data).toFixed(3), 11)} ${pad(measure(kittyGated, data).toFixed(3), 15)}`
  )
}

console.log(
  '\nSnapshot/replay payloads always contain \\x1b[?, so the includes() gate never fires on\nthe reattach path — it only helps the live per-chunk path.'
)

// Reference point: xterm parses the same bytes right after these scans run, so its cost
// is the yardstick for whether the scans are worth cutting.
const xtermHeadless = await import('@xterm/headless')
const Terminal = xtermHeadless.Terminal ?? xtermHeadless.default.Terminal
const writeToXterm = (data) =>
  new Promise((resolve) => {
    const terminal = new Terminal({ cols: 120, rows: 40, scrollback: 5000, allowProposedApi: true })
    const start = performance.now()
    terminal.write(data, () => {
      const elapsed = performance.now() - start
      terminal.dispose()
      resolve(elapsed)
    })
  })

console.log(`\n== xterm headless parse of the same payload (reference) ==`)
console.log(`${pad('payload', 36)} ${pad('size', 8)} ${pad('xterm write', 11)}`)
for (const { name, data } of payloads) {
  await writeToXterm(data)
  const samples = []
  for (let round = 0; round < ROUNDS; round++) {
    samples.push(await writeToXterm(data))
  }
  console.log(`${pad(name, 36)} ${pad(kb(data), 8)} ${pad(median(samples).toFixed(3), 11)}`)
}

export const ORCA_PI_PREFILL_EXTENSION_FILE = 'orca-prefill.ts'

// Why: prefill-without-submit needs an env var the bundled `orca-prefill.ts`
// extension can read on session_start.
export function getPiPrefillExtensionSource(): string {
  return [
    'export default function (pi) {',
    "  pi.on('session_start', async (event, ctx) => {",
    '    if (!process.env.ORCA_PANE_KEY) return',
    "    if (event.reason !== 'startup') return",
    '    const prefill = process.env.ORCA_PI_PREFILL',
    '    if (!prefill) return',
    '    delete process.env.ORCA_PI_PREFILL',
    '    try {',
    '      ctx.ui.setEditorText(prefill)',
    '    } catch {}',
    '  })',
    '}',
    ''
  ].join('\n')
}

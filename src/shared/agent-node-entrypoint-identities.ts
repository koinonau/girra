import type { TuiAgent } from './tui-agent'

// Node CLIs whose shims launch a generic script (cli.js, versioned index.js), so
// only the exact install path is an authoritative identity signal.
export const EXACT_NODE_ENTRYPOINT_IDENTITIES: readonly {
  pattern: RegExp
  agent: TuiAgent
  processName: string
}[] = [
  // Why: Pi's npm shim launches a generic cli.js; only the exact package path is authoritative.
  {
    pattern:
      /(?:^|\/)node_modules\/@(?:earendil-works|mariozechner)\/pi-coding-agent\/dist\/cli\.js$/,
    agent: 'pi',
    processName: 'pi'
  }
]

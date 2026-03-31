// src/shims/bun-bundle.mjs
// Plain ESM JavaScript version of bun-bundle.ts for use under Node.js/tsx.
// In production Bun builds, bun:bundle is resolved by the bundler to compile-time
// constants. Here we read from env vars with the same defaults.

function envBool(key, fallback) {
  const v = process.env[key]
  if (v === undefined) return fallback
  return v === '1' || v === 'true'
}

const FEATURE_FLAGS = {
  PROACTIVE: envBool('CLAUDE_CODE_PROACTIVE', false),
  KAIROS: envBool('CLAUDE_CODE_KAIROS', false),
  KAIROS_BRIEF: envBool('CLAUDE_CODE_KAIROS_BRIEF', false),
  KAIROS_GITHUB_WEBHOOKS: envBool('CLAUDE_CODE_KAIROS_GITHUB_WEBHOOKS', false),
  BRIDGE_MODE: envBool('CLAUDE_CODE_BRIDGE_MODE', false),
  DAEMON: envBool('CLAUDE_CODE_DAEMON', false),
  VOICE_MODE: envBool('CLAUDE_CODE_VOICE_MODE', false),
  AGENT_TRIGGERS: envBool('CLAUDE_CODE_AGENT_TRIGGERS', false),
  MONITOR_TOOL: envBool('CLAUDE_CODE_MONITOR_TOOL', false),
  COORDINATOR_MODE: envBool('CLAUDE_CODE_COORDINATOR_MODE', false),
  ABLATION_BASELINE: false,
  DUMP_SYSTEM_PROMPT: envBool('CLAUDE_CODE_DUMP_SYSTEM_PROMPT', false),
  BG_SESSIONS: envBool('CLAUDE_CODE_BG_SESSIONS', false),
  HISTORY_SNIP: envBool('CLAUDE_CODE_HISTORY_SNIP', false),
  WORKFLOW_SCRIPTS: envBool('CLAUDE_CODE_WORKFLOW_SCRIPTS', false),
  CCR_REMOTE_SETUP: envBool('CLAUDE_CODE_CCR_REMOTE_SETUP', false),
  EXPERIMENTAL_SKILL_SEARCH: envBool('CLAUDE_CODE_EXPERIMENTAL_SKILL_SEARCH', false),
  ULTRAPLAN: envBool('CLAUDE_CODE_ULTRAPLAN', false),
  TORCH: envBool('CLAUDE_CODE_TORCH', false),
  UDS_INBOX: envBool('CLAUDE_CODE_UDS_INBOX', false),
  FORK_SUBAGENT: envBool('CLAUDE_CODE_FORK_SUBAGENT', false),
  BUDDY: envBool('CLAUDE_CODE_BUDDY', false),
  MCP_SKILLS: envBool('CLAUDE_CODE_MCP_SKILLS', false),
  REACTIVE_COMPACT: envBool('CLAUDE_CODE_REACTIVE_COMPACT', false),
}

export function feature(name) {
  return FEATURE_FLAGS[name] ?? false
}

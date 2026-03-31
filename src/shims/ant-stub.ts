// Stub for @ant/* packages — Anthropic-internal, not published externally.
// All callers are gated behind USER_TYPE === 'ant' or feature() flags that
// return false in external builds, so these stubs should never be called at runtime.

// @ant/computer-use-mcp exports
export const API_RESIZE_PARAMS = {}
export const BROWSER_TOOLS: unknown[] = []
export const DEFAULT_GRANT_FLAGS = {}
export function bindSessionContext(_ctx: unknown): unknown { return {} }
export function buildComputerUseTools(_opts: unknown): unknown[] { return [] }
export function targetImageSize(_dims: unknown): unknown { return {} }
export class ComputerUseSessionContext {}

// @ant/computer-use-mcp/sentinelApps exports
export function getSentinelCategory(_app: unknown): string | null { return null }

// @ant/computer-use-mcp/types exports (re-exported above)

// @ant/claude-for-chrome-mcp exports
export function createClaudeForChromeMcpServer(_opts: unknown): unknown { return {} }

// @ant/computer-use-mcp server factory
export function createComputerUseMcpServer(_opts: unknown): unknown { return {} }
export function createComputerUseMcpServerForCli(_opts: unknown): unknown { return {} }

// Global test setup — runs before every test file.
// Loads the runtime shims that replace Bun bundler build-time features.
import '../src/shims/preload.js'

// In CI/test mode (NODE_ENV=test) the auth util throws if neither key is set.
// Use a dummy OAuth token so module loading succeeds without a real API key.
// ANTHROPIC_API_KEY is intentionally left unset so integration tests that
// check for it are still correctly skipped when no real key is available.
if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'dummy-oauth-token-for-unit-tests'
}

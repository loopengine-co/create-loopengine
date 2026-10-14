// A starting point, not a template to copy verbatim: real persona, real
// tool, real permission rule — one folder per agent, the same convention
// agents/customer-service/ uses in loopengine's own repo. Add more agents
// by copying this whole folder under a new name and a new AgentConfig.name
// — agent-registry.ts discovers it automatically, nothing to register by
// hand.
//
// `rules` and `skillsDirs` are both left unset here on purpose — omitting
// them defaults to actauth.yml and skills/ alongside this file (loopengine
// resolves both relative to wherever you run the process). `tools` is set
// explicitly instead of relying on the equivalent tools/ default: that one
// resolves relative to loopengine's own installed location, not your
// project, so it only works inside loopengine's own repo — see
// tools/index.ts's own comment.
import type { AgentConfig } from 'loopengine'
import { tools } from './tools/index.js'

export const config: AgentConfig = {
  name: 'example-agent',
  systemPrompt: 'You are a helpful assistant.',
  tools,
  // Reads OPENAI_API_KEY: set it on the console's Models page, or in .env.
  // For another provider, change `provider` and `model` (e.g.
  // { provider: 'anthropic', model: 'claude-sonnet-5' } with
  // ANTHROPIC_API_KEY). reasoningEffort 'none' lets this gpt-5.x model use
  // function tools; see AgentModelConfig in loopengine's agent-config.
  model: { provider: 'openai', model: 'gpt-5.6-luna', reasoningEffort: 'none' },
}

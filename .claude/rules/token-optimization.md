# Token Optimization Rules

1. **Direct tools first**: Grep/Read/Glob before Task(Explore)
2. **Limit reads**: `Read(limit:100)` for large files
3. **Max 1 parallel agent** unless explicit need
4. **Registry index**: Read `automations/registry-index.json` (1.3KB) before `registry.json` (75KB)
5. **NO agents** — "ca consomme enormement de tokens!"

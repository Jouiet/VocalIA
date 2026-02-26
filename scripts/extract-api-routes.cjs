#!/usr/bin/env node
/**
 * Extract API routes from db-api.cjs for OpenAPI spec generation
 */
const fs = require('fs');
const code = fs.readFileSync(require('path').join(__dirname, '..', 'core', 'db-api.cjs'), 'utf8');
const lines = code.split('\n');
const routes = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Pattern 1: path === '/api/xxx' && method === 'METHOD'
  const p1 = line.match(/path\s*===\s*'(\/api\/[^']+)'\s*&&\s*method\s*===\s*'(\w+)'/);
  if (p1) {
    routes.push({ method: p1[2], path: p1[1], line: i + 1 });
    continue;
  }

  // Pattern 2: xxxMatch && method === 'METHOD' (regex-based routes)
  const matchDef = line.match(/const\s+(\w+)\s*=\s*path\.match\(/);
  if (matchDef && i + 1 < lines.length) {
    const nextLine = lines[i + 1];
    const methodMatch = nextLine.match(/method\s*===\s*'(\w+)'/);
    if (methodMatch) {
      const regexStr = line.match(/match\(\/(.*?)\/[gi]*\)/);
      if (regexStr) {
        let p = regexStr[1]
          .replace(/\\\//g, '/')
          .replace(/\^/g, '')
          .replace(/\$/g, '')
          .replace(/\([^)]+\)/g, ':id');
        routes.push({ method: methodMatch[1], path: p, line: i + 1 });
      }
    }
  }
}

// Dedupe
const seen = new Set();
const unique = routes.filter(r => {
  const key = r.method + ':' + r.path;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

unique.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
unique.forEach(r => console.log(r.method.padEnd(7) + r.path));
console.log('\nTotal:', unique.length, 'endpoints');

// Output JSON for further processing
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(unique, null, 2));
}

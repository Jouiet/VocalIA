import { build } from 'esbuild';
import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname);

// Collect all external dependencies from node_modules (don't bundle them)
const pkg = await import('./package.json', { with: { type: 'json' } });
const externalDeps = [
  ...Object.keys(pkg.default.dependencies || {}),
  ...Object.keys(pkg.default.devDependencies || {}),
];

// Build configurations
const configs = {
  // Voice API server bundle
  'voice-api': {
    entryPoints: [join(ROOT, 'core/voice-api-resilient.cjs')],
    outfile: join(ROOT, 'dist/voice-api.cjs'),
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    bundle: true,
    minify: false,
    sourcemap: true,
    external: [...externalDeps, 'xlsx', 'fs', 'path', 'http', 'https', 'url', 'crypto', 'os', 'util',
      'stream', 'events', 'child_process', 'net', 'tls', 'dns', 'assert', 'buffer',
      'querystring', 'zlib', 'readline', 'worker_threads', 'perf_hooks'],
    metafile: true,
  },

  // DB API server bundle
  'db-api': {
    entryPoints: [join(ROOT, 'core/db-api.cjs')],
    outfile: join(ROOT, 'dist/db-api.cjs'),
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    bundle: true,
    minify: false,
    sourcemap: true,
    external: [...externalDeps, 'xlsx', 'fs', 'path', 'http', 'https', 'url', 'crypto', 'os', 'util',
      'stream', 'events', 'child_process', 'net', 'tls', 'dns', 'assert', 'buffer',
      'querystring', 'zlib', 'readline', 'worker_threads', 'perf_hooks'],
    metafile: true,
  },

  // Telephony bridge bundle
  'telephony': {
    entryPoints: [join(ROOT, 'telephony/voice-telephony-bridge.cjs')],
    outfile: join(ROOT, 'dist/telephony.cjs'),
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    bundle: true,
    minify: false,
    sourcemap: true,
    external: [...externalDeps, 'xlsx', 'fs', 'path', 'http', 'https', 'url', 'crypto', 'os', 'util',
      'stream', 'events', 'child_process', 'net', 'tls', 'dns', 'assert', 'buffer',
      'querystring', 'zlib', 'readline', 'worker_threads', 'perf_hooks'],
    metafile: true,
  },
};

// Parse CLI args
const positionalArgs = process.argv.slice(2).filter(a => !a.startsWith('--'));
const target = positionalArgs[0] || 'all';
const analyze = process.argv.includes('--analyze');
const minified = process.argv.includes('--minify');

async function buildTarget(name, config) {
  if (minified) config.minify = true;

  console.log(`\n📦 Building ${name}...`);
  const startTime = Date.now();

  try {
    const result = await build(config);
    const elapsed = Date.now() - startTime;

    if (result.metafile) {
      const outfile = Object.keys(result.metafile.outputs)[0];
      const output = result.metafile.outputs[outfile];
      const inputCount = Object.keys(result.metafile.inputs).length;
      const bytes = output.bytes;

      console.log(`  ✅ ${name} → ${config.outfile.replace(ROOT + '/', '')}`);
      console.log(`     ${inputCount} modules → ${(bytes / 1024).toFixed(1)} KB (${elapsed}ms)`);

      if (analyze) {
        console.log(`\n  📊 Module breakdown:`);
        const inputs = Object.entries(result.metafile.inputs)
          .map(([path, info]) => ({ path, bytes: info.bytes }))
          .sort((a, b) => b.bytes - a.bytes)
          .slice(0, 15);

        for (const { path: p, bytes: b } of inputs) {
          const relPath = p.replace(/^\.\//, '');
          console.log(`     ${(b / 1024).toFixed(1).padStart(7)} KB  ${relPath}`);
        }
      }
    }

    return result;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     VocalIA esbuild Production Builder   ║');
  console.log('╚══════════════════════════════════════════╝');

  const targets = target === 'all' ? Object.keys(configs) : [target];
  let success = 0;
  let failed = 0;

  for (const t of targets) {
    if (!configs[t]) {
      console.error(`Unknown target: ${t}. Available: ${Object.keys(configs).join(', ')}`);
      failed++;
      continue;
    }
    const result = await buildTarget(t, { ...configs[t] });
    if (result) success++;
    else failed++;
  }

  console.log(`\n✅ Built: ${success}/${targets.length}${failed ? ` (${failed} failed)` : ''}`);
  if (minified) console.log('📦 Minified mode');
  if (analyze) console.log('📊 Analysis mode');
}

main();

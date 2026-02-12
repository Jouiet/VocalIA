const kling = require('../core/kling-service.cjs');

const id = process.argv[2];
if (!id) {
  console.error('Usage: node scripts/debug_kling.cjs <video_id>');
  process.exit(1);
}

async function debug() {
  console.log(`[DEBUG] Attempting to trigger generation for: ${id}`);
  try {
    const result = await kling.generateApproved(id);
    console.log('[DEBUG] Generation triggered successfully:', result);
  } catch (err) {
    console.error('[DEBUG] Generation failed:', err.message);
  }
}

debug();

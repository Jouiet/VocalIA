#!/bin/bash
# VocalIA Promptfoo Runner
# Usage:
#   ./run-eval.sh eval                         # Quick smoke test (agency-fr, 3 tests)
#   ./run-eval.sh eval-all                     # Full suite (42 configs, ~126 tests)
#   ./run-eval.sh eval -c configs/dental-fr.yaml  # Single persona
#   ./run-eval.sh redteam generate && ./run-eval.sh redteam run  # Red team
#   ./run-eval.sh sync                         # Sync prompts from source
#   ./run-eval.sh view                         # View results in browser

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load .env with proper export
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

# Map VocalIA env vars to Promptfoo expected names
export GOOGLE_API_KEY="${GEMINI_API_KEY:-}"

cd "$SCRIPT_DIR"

# Special command: sync prompts from source
if [ "${1:-}" = "sync" ]; then
  shift
  node "$SCRIPT_DIR/sync-prompts.cjs" "$@"
  exit 0
fi

# Special command: eval-all runs all persona configs sequentially
# Usage: ./run-eval.sh eval-all [--lang fr|en|es|ar|ary] [--share]
if [ "${1:-}" = "eval-all" ]; then
  shift
  LANG_FILTER=""
  EXTRA_ARGS=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --lang) LANG_FILTER="$2"; shift 2 ;;
      *) EXTRA_ARGS+=("$1"); shift ;;
    esac
  done

  echo "=== VocalIA Full Persona Eval ==="
  if [ -n "$LANG_FILTER" ]; then
    echo "Language filter: ${LANG_FILTER}"
    CONFIGS=(configs/*-${LANG_FILTER}.yaml)
  else
    CONFIGS=(configs/*.yaml)
  fi
  echo "Configs: ${#CONFIGS[@]}"

  TOTAL_PASS=0
  TOTAL_FAIL=0
  TOTAL_ERR=0
  for config in "${CONFIGS[@]}"; do
    if [ ! -f "$config" ]; then continue; fi
    echo ""
    echo "--- Running: $config ---"
    OUTPUT=$(promptfoo eval -c "$config" --no-cache "${EXTRA_ARGS[@]}" 2>&1) || true
    echo "$OUTPUT" | grep -E "^(Results:|Duration:|Total Tokens:)" || true
    PASS=$(echo "$OUTPUT" | sed -n 's/.*✓ \([0-9]*\) passed.*/\1/p' | tail -1)
    PASS=${PASS:-0}
    FAIL=$(echo "$OUTPUT" | sed -n 's/.*✗ \([0-9]*\) failed.*/\1/p' | tail -1)
    FAIL=${FAIL:-0}
    ERR=$(echo "$OUTPUT" | sed -n 's/.*✗ \([0-9]*\) errors.*/\1/p' | tail -1)
    ERR=${ERR:-0}
    TOTAL_PASS=$((TOTAL_PASS + PASS))
    TOTAL_FAIL=$((TOTAL_FAIL + FAIL))
    TOTAL_ERR=$((TOTAL_ERR + ERR))
  done
  echo ""
  echo "=== TOTAL: ${TOTAL_PASS} passed, ${TOTAL_FAIL} failed, ${TOTAL_ERR} errors ==="
  exit 0
fi

exec promptfoo "$@"

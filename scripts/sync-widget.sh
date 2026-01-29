#!/bin/bash
# VocalIA Widget Sync Script
# Synchronizes voice widget from source to website deployment
# Created: Session 206 - 29/01/2026

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

SOURCE="$PROJECT_DIR/widget/voice-widget-core.js"
DEST="$PROJECT_DIR/website/voice-assistant/voice-widget.js"

echo "VocalIA Widget Sync"
echo "==================="

if [ ! -f "$SOURCE" ]; then
  echo "ERROR: Source file not found: $SOURCE"
  exit 1
fi

# Get file hashes
SOURCE_HASH=$(md5 -q "$SOURCE" 2>/dev/null || md5sum "$SOURCE" | cut -d' ' -f1)
DEST_HASH=""
if [ -f "$DEST" ]; then
  DEST_HASH=$(md5 -q "$DEST" 2>/dev/null || md5sum "$DEST" | cut -d' ' -f1)
fi

if [ "$SOURCE_HASH" = "$DEST_HASH" ]; then
  echo "Files are identical. No sync needed."
  exit 0
fi

# Perform sync
cp "$SOURCE" "$DEST"
echo "Synced: $SOURCE"
echo "    To: $DEST"
echo ""
echo "Source hash: $SOURCE_HASH"
echo "  Dest hash: $(md5 -q "$DEST" 2>/dev/null || md5sum "$DEST" | cut -d' ' -f1)"
echo ""
echo "Widget synchronized successfully."

#!/usr/bin/env bash
# Builds dist/ApplyFill-<version>.zip from the extension folder.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")
mkdir -p dist
rm -f "dist/ApplyFill-$version.zip"
(cd extension && zip -qr "../dist/ApplyFill-$version.zip" . -x '.*')
echo "Built dist/ApplyFill-$version.zip"

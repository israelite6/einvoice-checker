#!/usr/bin/env bash
# Downloads the official KoSIT artefacts used by the parity test (spike/parity.mjs).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p vendor && cd vendor
base=https://github.com/itplr-kosit
get() { [ -f "$2" ] || curl -fsSL -o "$2" "$1"; d="${2%.zip}"; [ "${2##*.}" = zip ] && { mkdir -p "$d"; unzip -q -o "$2" -d "$d"; } || true; }
get $base/validator-configuration-xrechnung/releases/download/v2026-08-31/xrechnung-3.0.2-validator-configuration-2026-08-31.zip xrechnung-3.0.2-validator-configuration-2026-08-31.zip
get $base/xrechnung-testsuite/releases/download/v2026-08-31/xrechnung-3.0.2-testsuite-2026-08-31.zip xrechnung-3.0.2-testsuite-2026-08-31.zip
get $base/validator/releases/download/v1.6.3/validator-1.6.3-standalone.jar validator-1.6.3-standalone.jar

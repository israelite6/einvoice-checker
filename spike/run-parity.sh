#!/usr/bin/env bash
# Full parity run: official KoSIT validator (Java) vs our engine on the official suite plus generated broken files.
set -euo pipefail
cd "$(dirname "$0")"
./fetch-vendor.sh
V=vendor/xrechnung-3.0.2-validator-configuration-2026-08-31
find vendor/xrechnung-3.0.2-testsuite-2026-08-31/instances -name "*.xml" | sort > testfiles.txt
python3 mutate.py
mkdir -p build
for x in ubl/2.1/xsl/EN16931-UBL-validation cii/16b/xsl/EN16931-CII-validation xrechnung/3.0.2/xsl/XRechnung-UBL-validation xrechnung/3.0.2/xsl/XRechnung-CII-validation; do
  n=$(basename $x); [ -f build/$n.sef.json ] || npx xslt3 -xsl:$V/resources/$x.xsl -export:build/$n.sef.json -nogo -relocate:on
done
mkdir -p ref ref-mut
# The validator exits non-zero when any document is rejected (expected for the broken files); reports are checked below.
java -jar vendor/validator-1.6.3-standalone.jar -s $V/scenarios.xml -r $V -o ref $(cat testfiles.txt) > ref/run.log || true
java -jar vendor/validator-1.6.3-standalone.jar -s $V/scenarios.xml -r $V -o ref-mut mutants/*.xml > ref-mut/run.log || true
test "$(ls ref/*-report.xml | wc -l)" -eq "$(wc -l < testfiles.txt)" && test "$(ls ref-mut/*-report.xml | wc -l)" -eq "$(ls mutants/*.xml | wc -l)"
node parity.mjs | tee parity-summary.json
node -e "const s=require('./parity-summary.json'); const d=require('./parity-diffs.json'); const bad=d.filter(x=>!(x.ref.xsd===false&&x.ours.xsd===false&&x.ref.accept===x.ours.accept&&x.ref.w===x.ours.w&&x.ref.i===x.ours.i)); if(bad.length){console.error('PARITY FAILED',bad.length);process.exit(1)} console.log('parity ok', s.total)"

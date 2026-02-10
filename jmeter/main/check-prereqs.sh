#!/usr/bin/env bash
# Check prerequisites for running the load test locally.
# Run from project root: ./jmeter/main/check-prereqs.sh
# Pipeline does not need this (Java and JMeter are installed in the workflow).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

OK=0
MISSING=""

# Java 11+ (must run, not just exist - macOS can have a stub)
if command -v java >/dev/null 2>&1 && java -version 2>&1 | head -1 | grep -q "version"; then
  echo "[OK] Java: $(java -version 2>&1 | head -1)"
else
  echo "[MISSING] Java (or Java not actually installed – run 'java -version')"
  MISSING="${MISSING} Java 11+"
  OK=1
fi

# JMeter: JMETER_HOME, project tools, or on PATH
if [ -n "${JMETER_HOME}" ] && [ -x "${JMETER_HOME}/bin/jmeter" ]; then
  echo "[OK] JMeter: JMETER_HOME=$JMETER_HOME"
elif [ -d "$REPO_ROOT/jmeter/tools/apache-jmeter-5.6.3" ]; then
  echo "[OK] JMeter: project jmeter/tools/apache-jmeter-5.6.3"
elif command -v jmeter >/dev/null 2>&1; then
  echo "[OK] JMeter: on PATH"
else
  echo "[MISSING] JMeter"
  MISSING="${MISSING} JMeter (set JMETER_HOME or add jmeter/tools/apache-jmeter-5.6.3 to project)"
  OK=1
fi

if [ $OK -eq 1 ]; then
  echo ""
  echo "To fix locally:"
  echo "  Java:  install from https://adoptium.net/ or (macOS) brew install openjdk@17"
  echo "  JMeter: either set JMETER_HOME to your install, or ensure jmeter/tools/apache-jmeter-5.6.3 exists (see TEST-LOCALLY.md)"
  exit 1
fi

echo ""
echo "Prerequisites OK. Run: ./jmeter/main/test-local.sh  or  ./jmeter/main/run-for-squad.sh squad_a 10"

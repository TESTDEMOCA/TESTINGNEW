#!/usr/bin/env bash
# Start Enterprise load test for a given squad at 100% (your users); other squads run at 5% automatically.
# Usage: run-for-squad.sh <squad> <users> [extra JMeter -J options...]
# Example: run-for-squad.sh squad_a 10
#   → primary.squad=squad_a, primary.threads=10, background.threads=1 (5% for others)
# Generates HTML report and prints accumulated result summary (all squads).
# For Copilot: "Start load test for squad-a with 10 users" → run this with squad_a 10.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROPS="$REPO_ROOT/jmeter/shared/global.properties"
RESULTS_DIR="$REPO_ROOT/jmeter/results"
RUN_ID="run_$(date +%Y%m%d_%H%M%S)"
RESULTS_PATH="$RESULTS_DIR/$RUN_ID"

# Resolve JMeter: JMETER_HOME, or project jmeter/tools, or jmeter on PATH
if [ -n "${JMETER_HOME}" ] && [ -x "${JMETER_HOME}/bin/jmeter" ]; then
  JMETER="${JMETER_HOME}/bin/jmeter"
elif [ -z "${JMETER_HOME}" ] && [ -d "$REPO_ROOT/jmeter/tools/apache-jmeter-5.6.3" ]; then
  export JMETER_HOME="$REPO_ROOT/jmeter/tools/apache-jmeter-5.6.3"
  JMETER="${JMETER_HOME}/bin/jmeter"
elif command -v jmeter >/dev/null 2>&1; then
  JMETER="jmeter"
else
  echo "Error: JMeter not found. Set JMETER_HOME or add jmeter to PATH, or run from project with jmeter/tools/apache-jmeter-5.6.3 present."
  exit 1
fi

# Java is required by JMeter (must run – macOS can have a stub)
if ! command -v java >/dev/null 2>&1; then
  echo "Error: Java not found. Install Java 11+ (e.g. https://adoptium.net/) and ensure 'java' is on PATH."
  exit 1
fi
if ! java -version 2>&1 | grep -q "version"; then
  echo "Error: Java did not run correctly. Install a full JDK/JRE 11+ (e.g. https://adoptium.net/)."
  exit 1
fi
# JMeter launcher needs JAVA_HOME/JRE_HOME; set from running java if not set
if [ -z "${JAVA_HOME}" ] && [ -z "${JRE_HOME}" ]; then
  JAVA_HOME=$(java -XshowSettings:properties -version 2>&1 | awk '/java\.home/ { gsub(/^[^=]+= */, ""); print; exit }')
  [ -n "$JAVA_HOME" ] && export JAVA_HOME
fi

squad="${1:-}"
users="${2:-10}"

if [ -z "$squad" ]; then
  echo "Usage: $0 <squad> <users> [extra -J options...]"
  echo "  squad: squad_a | squad_b | squad_c | squad_d"
  echo "  users: primary squad thread count (100% for that squad); others get 5% (background.threads)"
  echo "Example: $0 squad_a 10"
  exit 1
fi

# Validate squad name
case "$squad" in
  squad_a|squad_b|squad_c|squad_d) ;;
  *)
    echo "Error: squad must be one of squad_a, squad_b, squad_c, squad_d"
    exit 1
    ;;
esac

mkdir -p "$RESULTS_PATH"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "Enterprise load test – primary: $squad @ ${users} users (100%), others @ 5%"
echo "=============================================="
echo "Results: $RESULTS_PATH"
echo ""

# Run Enterprise-Test.jmx with weight distribution: primary gets 100%, others 5%
"$JMETER" -n \
  -t Enterprise-Test.jmx \
  -q "$PROPS" \
  -l "$RESULTS_PATH/results.jtl" \
  -j "$RESULTS_PATH/jmeter.log" \
  -Jprimary.squad="$squad" \
  -Jprimary.threads="$users" \
  -Jbackground.threads=1 \
  "${@:3}"

# Generate HTML report (accumulated result for all squads)
echo ""
echo "Generating HTML report (accumulated, all squads)..."
"$JMETER" -g "$RESULTS_PATH/results.jtl" -o "$RESULTS_PATH/html"

# Print weight distribution and sample summary
echo ""
echo "=============================================="
echo "Weight distribution (automatic)"
echo "  Primary: $squad = ${users} threads (100%)"
echo "  Others:  squad_a squad_b squad_c squad_d = 1 thread each (5%)"
echo "=============================================="
echo "Accumulated result summary (all squads)"
echo "----------------------------------------"
if [ -f "$RESULTS_PATH/results.jtl" ]; then
  # JTL: typically timestamp, elapsed, label, responseCode, ... (tab or comma)
  if head -1 "$RESULTS_PATH/results.jtl" | grep -q ','; then
    sep=','
  else
    sep=$'\t'
  fi
  # Sample count by label (squad)
  awk -F"$sep" 'NR>1 && NF>=3 { label=$3; gsub(/^[[:space:]]+|[[:space:]]+$/,"",label); count[label]++; total++ } END { for (l in count) printf "  %s: %d samples\n", l, count[l]; printf "  TOTAL: %d samples\n", total+0 }' "$RESULTS_PATH/results.jtl" 2>/dev/null || true
fi
echo "----------------------------------------"
echo "Full report: $RESULTS_PATH/html/index.html"
echo "JTL: $RESULTS_PATH/results.jtl"
echo "Done."

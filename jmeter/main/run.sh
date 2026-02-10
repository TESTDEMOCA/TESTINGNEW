#!/usr/bin/env bash
# Run Enterprise-Test.jmx (master plan: all squad Thread Groups start together).
# Primary squad is set by property primary.squad (e.g. squad_a, squad_b); others run as background.
# Uses jmeter/shared/global.properties. Override with -J (e.g. -Jprimary.squad=squad_b -Jprimary.threads=30).
# Requires JMETER_HOME or jmeter on PATH.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENTERPRISE_JMX="$SCRIPT_DIR/Enterprise-Test.jmx"
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
if ! command -v java >/dev/null 2>&1; then
  echo "Error: Java not found. Install Java 11+ and ensure 'java' is on PATH."
  exit 1
fi
if ! java -version 2>&1 | grep -q "version"; then
  echo "Error: Java did not run correctly. Install a full JDK/JRE 11+."
  exit 1
fi
# JMeter launcher needs JAVA_HOME/JRE_HOME; set from running java if not set
if [ -z "${JAVA_HOME}" ] && [ -z "${JRE_HOME}" ]; then
  JAVA_HOME=$(java -XshowSettings:properties -version 2>&1 | awk '/java\.home/ { gsub(/^[^=]+= */, ""); print; exit }')
  [ -n "$JAVA_HOME" ] && export JAVA_HOME
fi

if [ ! -f "$ENTERPRISE_JMX" ]; then
  echo "Enterprise plan not found: $ENTERPRISE_JMX"
  exit 1
fi

mkdir -p "$RESULTS_PATH"

# Run from main/ so Include Controller paths (../squads/...) resolve
cd "$SCRIPT_DIR"

echo "Running Enterprise-Test.jmx (all squads; primary squad from primary.squad property)"
echo "Properties: $PROPS"
echo "Results: $RESULTS_PATH"
echo "Overrides: $*"

"$JMETER" -n \
  -t Enterprise-Test.jmx \
  -q "$PROPS" \
  -l "$RESULTS_PATH/results.jtl" \
  -j "$RESULTS_PATH/jmeter.log" \
  "$@"

echo "Done. Results in $RESULTS_PATH"
echo "Generate HTML report: $JMETER -g $RESULTS_PATH/results.jtl -o $RESULTS_PATH/html"

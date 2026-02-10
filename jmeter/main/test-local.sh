#!/usr/bin/env bash
# Short local test of Enterprise load test (squad_a, 2 users, 15s duration).
# Use this to verify the setup before a full run.
# Requires: Java 11+ (JMeter is in jmeter/tools/ if you haven't installed it elsewhere).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Use project JMeter if JMETER_HOME not set
if [ -z "${JMETER_HOME}" ] && [ -d "$REPO_ROOT/jmeter/tools/apache-jmeter-5.6.3" ]; then
  export JMETER_HOME="$REPO_ROOT/jmeter/tools/apache-jmeter-5.6.3"
  echo "Using JMeter from project: $JMETER_HOME"
fi

# Check Java (required by JMeter; must run – macOS can have a stub)
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

echo "Java: $(java -version 2>&1 | head -1)"
echo ""

# Run short test: squad_a, 2 users, 15s duration, 2s rampup
exec "$SCRIPT_DIR/run-for-squad.sh" squad_a 2 -Jduration=15 -Jrampup=2

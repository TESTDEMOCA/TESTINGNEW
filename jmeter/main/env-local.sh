# Source this to put Java (Homebrew openjdk@17) on PATH and JAVA_HOME for the current shell.
# Usage: source jmeter/main/env-local.sh   OR   . jmeter/main/env-local.sh
# Then run: ./jmeter/main/test-local.sh  or  ./jmeter/main/run-for-squad.sh squad_a 10

if [ -d "/opt/homebrew/opt/openjdk@17/bin" ]; then
  export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
  export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  echo "Added Homebrew openjdk@17 to PATH and JAVA_HOME"
elif [ -d "/usr/local/opt/openjdk@17/bin" ]; then
  export PATH="/usr/local/opt/openjdk@17/bin:$PATH"
  export JAVA_HOME="/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  echo "Added Homebrew openjdk@17 to PATH and JAVA_HOME"
fi

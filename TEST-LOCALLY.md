# Test the load test locally

Quick way to run a **short local test** (about 15–20 seconds) to confirm everything works.

**Pipeline:** No setup needed. The GitHub Actions workflow installs Java and JMeter in the job; just trigger **Load Test (Enterprise)** and run.

**Local:** You need Java (and optionally JMeter in the project). The scripts auto-detect JMeter from **`jmeter/tools/apache-jmeter-5.6.3`** if present.

## 0. Check prerequisites (optional)

From project root:

```bash
chmod +x jmeter/main/check-prereqs.sh
./jmeter/main/check-prereqs.sh
```

This reports what’s missing (Java and/or JMeter) and how to fix it.

## 1. Install Java (required for local)

JMeter needs Java 11 or higher.

- **macOS (Homebrew):** `brew install openjdk@17` then add it to PATH for the session:
  ```bash
  export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"   # Apple Silicon
  # or
  export PATH="/usr/local/opt/openjdk@17/bin:$PATH"     # Intel
  ```
  To make it permanent, add that line to your `~/.zshrc` or `~/.bash_profile`. Or run: `source jmeter/main/env-local.sh` from the project root before tests.
- **Or:** Install from [Adoptium](https://adoptium.net/) and add the `bin` folder to PATH.

Check:

```bash
java -version
```

## 2. JMeter (for local)

Either:

- **Use project JMeter:** Ensure **`jmeter/tools/apache-jmeter-5.6.3`** exists (it’s in the repo or was extracted there). The scripts use it automatically if `JMETER_HOME` is not set.
- **Or** set `JMETER_HOME` to your own JMeter install.

## 3. Run the short local test

From the **project root** (the folder that contains `jmeter/` and `README.md`):

```bash
chmod +x jmeter/main/test-local.sh
./jmeter/main/test-local.sh
```

This runs:

- **Primary squad:** squad_a  
- **Users:** 2  
- **Duration:** 15 seconds  
- **Ramp-up:** 2 seconds  
- Other squads at 5% (1 thread each), as in the real run.

After it finishes you should see:

- A short summary in the terminal (weight distribution and sample counts).
- Results in **`jmeter/results/run_<date>_<time>/`**:
  - `results.jtl`
  - `jmeter.log`
  - `html/index.html` (open in a browser for the report).

## 4. If something fails

- **“Java not found”**  
  Install Java 11+ and ensure `java` is on your PATH (see step 1). Run `./jmeter/main/check-prereqs.sh` to verify.

- **“JMeter not found”**  
  Run `./jmeter/main/check-prereqs.sh`. If JMeter is missing, either ensure `jmeter/tools/apache-jmeter-5.6.3` exists or set:

  ```bash
  export JMETER_HOME=/path/to/your/apache-jmeter-5.6.3
  ./jmeter/main/test-local.sh
  ```

- **Pipeline fails**  
  The workflow installs Java and JMeter itself. If the run step fails, check the “Install Apache JMeter” and “Verify JMeter” steps in the Actions log; the download URL may be slow (retries are built in).

- **Connection errors in the report**  
  The test calls `https://example.com`. That’s expected; the point is to confirm the script and Enterprise-Test.jmx run and produce results.

## 5. Run a “real” local test (your squad, your users)

After the short test works, run a full test for your squad and user count, e.g.:

```bash
./jmeter/main/run-for-squad.sh squad_a 10
```

Use `-Jduration=60` (default) or override, e.g. `-Jduration=120`.

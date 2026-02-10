# JMeter Enterprise Load Test

Coordinated workload: one squad at 100% load, others at a chosen % (e.g. 10%). Single report for all squads.

**Squads:** `squad_a`, `squad_b`, `squad_c`, `squad_d`

---

## Copilot prompts

### Single squad run (one squad as primary, others at 10%)

Choose one squad as primary at 100% load; all other squad scripts run automatically at 10%. All squad scripts are fetched and executed in one test; you get one combined report.

**Prompt:** *"Run single squad run for squad_b with 100 users, others at 10%"*

**Copilot runs:** `./jmeter/main/run-for-squad.sh squad_b 100 10`

**What happens:** Enterprise-Test.jmx runs automatically — it loads all squad scripts (squad_a, squad_b, squad_c, squad_d), applies primary load (100%) to squad_b and 10% to the rest. One report for all.

---

### All squad run (same as above — one command runs all scripts)

**Prompt:** *"Run all squad load test with squad_b as primary at 100 users, others at 10%"*  
or *"Execute all squad scripts, primary 100%, others 10%, squad_b primary with 100 users"*

**Copilot runs:** `./jmeter/main/run-for-squad.sh squad_b 100 10`

**What happens:** All squad scripts are executed in one run (scripts are in `jmeter/squads/`; Enterprise-Test.jmx includes them and applies load). Primary = 100%, others = 10%. One report.

---

### Fetch the report from the pipeline (after run in GitHub Actions)

Reports are stored as workflow artifacts (not in git). Use one of these prompts to get the latest report:

**Prompt:** *"Fetch the load test report from the last pipeline run"*  
or *"Download the load test report from GitHub Actions"*

**Copilot runs (requires `gh` CLI):**
```bash
# List latest completed run and download its artifact
gh run list --workflow loadtest.yml --limit 1 --json databaseId,status -q '.[0] | select(.status=="completed") | .databaseId' | xargs -I {} gh run download {} -D jmeter/results
```
Then open `jmeter/results/*/run_*/html/index.html` in a browser.

**Or Copilot tells you:** Go to **Actions** → open the latest **Load Test (Enterprise)** run → **Artifacts** → download the ZIP → unzip and open `run_<date>_<time>/html/index.html`.

---

### Quick reference

| You say | Command / action |
|--------|-------------------|
| *"Run single squad run for squad_b with 100, others at 10%"* | `./jmeter/main/run-for-squad.sh squad_b 100 10` |
| *"Run all squad load test, squad_a primary 50 users, others 10%"* | `./jmeter/main/run-for-squad.sh squad_a 50 5` |
| *"Fetch the load test report from the last pipeline run"* | `gh run download` (see above) or download artifact from Actions |

---

## Prerequisites

- **Pipeline:** None. Java and JMeter are installed in the workflow.
- **Local:** Java 11+ and JMeter 5.x (set `JMETER_HOME` or place under `jmeter/tools/apache-jmeter-5.6.3`).

---

## Copilot commands

Ask Copilot to run the test from project root:

| What you want | Say to Copilot | What runs |
|---------------|----------------|-----------|
| Squad b at 100, others at 10% | *"Run squad b with 100, others at 10%"* | `./jmeter/main/run-for-squad.sh squad_b 100 10` |
| Squad b at 100, others default (1 each) | *"Run load test for squad_b with 100 users"* | `./jmeter/main/run-for-squad.sh squad_b 100` |
| Short local test (~15s) | *"Run short JMeter test"* | `./jmeter/main/test-local.sh` |
| Run in pipeline (squad b 100, others 10%) | *"Run load test in pipeline for squad_b with 100, others at 10%"* | Actions → Load Test (Enterprise) → Run workflow → Primary squad: squad_b, Users: 100, **Background users: 10** → Run. Download artifact for report. |

---

## 1. Start the test

### Pipeline

1. Go to **Actions** → **Load Test (Enterprise)** → **Run workflow**.
2. Set **Primary squad**, **Number of users**, and **Threads for other squads** (e.g. 10 for 10% when primary=100; default 1).
3. Click **Run workflow** and wait for completion.

### Local

From project root, **one command runs all squad scripts** (Enterprise-Test.jmx runs all four squads in a single test):

```bash
./jmeter/main/run-for-squad.sh <squad> <primary_users> [background_users]
```

Examples:
- `./jmeter/main/run-for-squad.sh squad_b 100 10` — squad_b = 100 users, others = 10 each (10%). One report for all.
- `./jmeter/main/run-for-squad.sh squad_b 100` — squad_b = 100, others = 1 each. One report for all.

Short test (~15s): `./jmeter/main/test-local.sh`

---

## 2. Get the report

### Pipeline

1. Open the completed run in **Actions**.
2. Under **Artifacts**, download the ZIP (e.g. `loadtest-results-squad_b-20users`).
3. Unzip and open `run_<date>_<time>/html/index.html` in a browser.

### Local

Open `jmeter/results/run_<date>_<time>/html/index.html` in a browser.

---

## Project layout

```
jmeter/
├── main/               Enterprise-Test.jmx, run-for-squad.sh, run.sh, test-local.sh
├── squads/             One folder per squad (script.jmx, script-fragment.jmx)
├── shared/             global.properties
└── results/            Run outputs (gitignored)
```

When creating or changing JMeter scripts, follow **jmeter/JMETER-SCRIPTING-GUIDELINES.md**.

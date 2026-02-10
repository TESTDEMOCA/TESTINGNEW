# JMeter Enterprise Load Test

Coordinated workload: one squad at 100% load, others at 5%. Single report for all squads.

**Squads:** `squad_a`, `squad_b`, `squad_c`, `squad_d`

---

## Prerequisites

- **Pipeline:** None. Java and JMeter are installed in the workflow.
- **Local:** Java 11+ and JMeter 5.x (set `JMETER_HOME` or place under `jmeter/tools/apache-jmeter-5.6.3`).

---

## 1. Start the test

### Pipeline

1. Go to **Actions** → **Load Test (Enterprise)** → **Run workflow**.
2. Choose **Primary squad** and **Number of users**.
3. Click **Run workflow** and wait for completion.

### Local

From project root:

```bash
./jmeter/main/run-for-squad.sh <squad> <users>
```

Example: `./jmeter/main/run-for-squad.sh squad_b 20`

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

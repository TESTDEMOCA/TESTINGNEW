# Using Copilot to run the load test

**Copy-paste these into Copilot Chat.** Run from **project root** (TESTINGNEW).

---

## Run locally

**You say:**  
*"Run the load test for squad-a with 10 users"*  
or  
*"Start JMeter enterprise load test for squad_a, 10 users"*

**Copilot should run in the terminal:**
```bash
chmod +x jmeter/main/run-for-squad.sh && ./jmeter/main/run-for-squad.sh squad_a 10
```

Change `squad_a` and `10` to your squad and user count.  
**Note:** Java must be on PATH (e.g. `source jmeter/main/env-local.sh` first on macOS if you use Homebrew Java).

---

## Short local test first (~15 s)

**You say:**  
*"Run the short local JMeter test"*  
or  
*"Test the load test locally"*

**Copilot should run:**
```bash
chmod +x jmeter/main/test-local.sh && ./jmeter/main/test-local.sh
```

---

## Run in pipeline (GitHub Actions)

**You say (use your squad and user count):**  
*"Run the load test in the pipeline for squad-b with 20 users"*  
or  
*"Trigger the GitHub Actions load test for squad_b, 20 users"*

**Option A – GitHub CLI (one command, from repo root):**  
If you have [GitHub CLI](https://cli.github.com/) installed and logged in (`gh auth login`), Copilot can run:

```bash
gh workflow run "Load Test (Enterprise)" -f squad=squad_b -f users=20
```

Then open the run: **https://github.com/TESTDEMOCA/TESTINGNEW/actions** and download the artifact when it finishes.

**Option B – Manual in the browser:**  
1. Open: **https://github.com/TESTDEMOCA/TESTINGNEW/actions**  
2. Click **"Load Test (Enterprise)"** in the left sidebar.  
3. Click **"Run workflow"** (dropdown on the right).  
4. Set **Primary squad (100% load)**: `squad_b`  
5. Set **Number of users (threads) for primary squad**: `20`  
6. Click the green **"Run workflow"** button.  
7. When the run finishes, download the artifact **loadtest-results-squad_b-20users**.

---

## Check if ready to run (prerequisites)

**You say:**  
*"Check if I can run the JMeter load test"*

**Copilot should run:**
```bash
./jmeter/main/check-prereqs.sh
```

---

## Summary for Copilot

- **Local run:** `./jmeter/main/run-for-squad.sh <squad> <users>` from project root (e.g. `squad_a 10`).
- **Short test:** `./jmeter/main/test-local.sh`.
- **Pipeline:** User goes to repo Actions → Load Test (Enterprise) → Run workflow → set squad and users → download artifact.
- **Prereqs:** `./jmeter/main/check-prereqs.sh`.
- Scripts set JAVA_HOME from `java` if needed; pipeline has Java and JMeter installed in the job.

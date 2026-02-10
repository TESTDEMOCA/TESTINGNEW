# How to run the load test (VS Code / Copilot)

Project root: **TESTINGNEW** (this folder).

---

## Test locally first (recommended)

Before a full run, do a **short local test** (~15 seconds) to confirm Java, JMeter, and the plan work.

1. **Check prerequisites:** `./jmeter/main/check-prereqs.sh` (reports missing Java/JMeter).
2. **Install Java 11+** if needed (`java -version`). JMeter is auto-detected from `jmeter/tools/` if present.
3. From project root run:
   ```bash
   chmod +x jmeter/main/test-local.sh
   ./jmeter/main/test-local.sh
   ```
4. See **[TEST-LOCALLY.md](TEST-LOCALLY.md)** for details. **Pipeline:** no setup; workflow installs Java and JMeter.

In VS Code: **Terminal → Run Task…** → **Test locally (short run: squad_a, 2 users, 15s)**.

---

## 1. Using Copilot (Chat or inline)

**Say something like:**

- *"Run load test for squad-a with 10 users"*
- *"Start the JMeter enterprise load test for squad_a, 10 users"*

**Copilot should run this in the terminal (from project root):**

```bash
chmod +x jmeter/main/run-for-squad.sh && ./jmeter/main/run-for-squad.sh squad_a 10
```

Change `squad_a` to your squad (`squad_a`, `squad_b`, `squad_c`, `squad_d`) and `10` to your user count.

---

## 2. Using the terminal yourself

1. Open terminal in VS Code: **Terminal → New Terminal** (or `` Ctrl+` ``).
2. Make sure you're in the project root (you should see this folder with `jmeter/`, `README.md`).
3. Run:

```bash
chmod +x jmeter/main/run-for-squad.sh
./jmeter/main/run-for-squad.sh squad_a 10
```

4. Replace `squad_a` with your squad and `10` with your number of users.

**Requirement:** Apache JMeter 5.x must be installed and on your `PATH`, or set `JMETER_HOME` to the JMeter install folder.

---

## 3. Using VS Code Task (Run without typing the command)

1. **Terminal → Run Task…** (or `Ctrl+Shift+B` / **Cmd+Shift+B**).
2. Choose **Run Load Test (squad_a, 10 users)** (or the squad/users you configured).
3. The task runs the same command as above.

You can edit `.vscode/tasks.json` to add more tasks for other squads or user counts.

---

## Where are the results?

- **Folder:** `jmeter/results/run_<date>_<time>/`
- **Files:** `results.jtl`, `jmeter.log`, `html/index.html` (open the HTML in a browser for the report).
- The script also prints a short summary in the terminal when it finishes.

---

## Run in pipeline (GitHub Actions)

- **Actions** tab → **Load Test (Enterprise)** → **Run workflow**.
- Choose **Primary squad** (e.g. squad_a) and **Number of users** (e.g. 10).
- After the run, download the artifact for the full report.

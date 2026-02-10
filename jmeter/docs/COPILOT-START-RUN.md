# Starting a load test (for Copilot and users)

Use this when someone says: **"Start load test for squad-a with 10 users"** or similar.

## What happens automatically

- **Enterprise-Test.jmx** runs with your squad as **primary (100%)** and **all other squads at 5%**.
- **Weight distribution is automatic**: no need to set other squads manually.
- You get **one accumulated result** (all squads in one JTL + HTML report).

## 1. Run locally (from repo root)

```bash
chmod +x jmeter/main/run-for-squad.sh
./jmeter/main/run-for-squad.sh squad_a 10
```

- **squad**: `squad_a` | `squad_b` | `squad_c` | `squad_d`
- **users**: number of threads for the primary squad (your 100%); others get 1 thread (5%) automatically.

Output: results in `jmeter/results/run_<timestamp>/` (results.jtl, jmeter.log, html/). The script prints an **accumulated result summary** (samples per squad and total).

## 2. Run in pipeline (GitHub Actions)

- **Workflow name**: **Load Test (Enterprise)**
- **Trigger**: Actions → Load Test (Enterprise) → Run workflow
- **Inputs**:
  - **Primary squad (100% load)**: choose `squad_a`, `squad_b`, `squad_c`, or `squad_d`
  - **Number of users (threads) for primary squad**: e.g. `10`

After the run, download the **artifact** `loadtest-results-<squad>-<users>users` for the accumulated JTL, log, and HTML report.

## Copilot: what to do when the user asks

| User says | Action |
|-----------|--------|
| "Start load test for squad-a with 10 users" | Run: `./jmeter/main/run-for-squad.sh squad_a 10` (from repo root). If they want pipeline: tell them to trigger workflow **Load Test (Enterprise)** with squad = squad_a, users = 10. |
| "Run load test for squad-b, 20 users" | Run: `./jmeter/main/run-for-squad.sh squad_b 20` |
| "Run enterprise load test in pipeline for squad-a 10 users" | Trigger the **Load Test (Enterprise)** workflow with inputs: squad = squad_a, users = 10. Share the artifact link when the run finishes. |

**Weight distribution**: Handled by Enterprise-Test.jmx (primary.squad + primary.threads + background.threads). No extra steps needed.

**Accumulated result**: One JTL and one HTML report for all squads; the script (and HTML report) show per-squad sample counts and totals.

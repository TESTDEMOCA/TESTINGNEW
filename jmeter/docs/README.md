# JMeter Coordinated Workload Framework

**Enterprise-Test.jmx** is the master plan: it includes all squad scripts via **Include Controllers** (each squad provides a **Test Fragment**). All squad Thread Groups start together in one JVM. The **primary squad** is chosen dynamically via the `primary.squad` property (no hardcoded primary). Squad scripts can also be run standalone with their own Thread Group.

## Structure

```
jmeter/
├── main/                        # Orchestration
│   ├── Enterprise-Test.jmx      # Master plan: 4 Thread Groups + Include Controllers
│   ├── run.sh                   # Runs Enterprise-Test.jmx (generic -J overrides)
│   └── run-for-squad.sh         # Start run for one squad (100%), others 5%; accumulated results
├── squads/                      # Per-squad scripts
│   ├── squad-a/
│   │   ├── script.jmx           # Standalone plan (Thread Group + HTTP Request)
│   │   └── script-fragment.jmx  # Test Fragment + HTTP Request (included by master)
│   ├── squad-b/
│   │   ├── script.jmx
│   │   └── script-fragment.jmx
│   ├── squad-c/
│   │   ├── script.jmx
│   │   └── script-fragment.jmx
│   └── squad-d/
│       ├── script.jmx
│       └── script-fragment.jmx
├── shared/
│   └── global.properties        # primary.squad, primary.threads, background.threads, rampup, duration, base URL
├── results/                     # Run outputs (gitignored except .gitkeep)
└── docs/
    └── README.md                # This file
```

## Enterprise-Test.jmx (master plan)

- **Coordinated workload logic**: one squad runs at **100% load** (primary.threads), all others at **5% load** (background.threads). Implemented with JMeter **properties** and **If Controllers**:
  - **User Defined Variables** (Test Plan): `squad_a_threads`, `squad_b_threads`, etc. = `If primary.squad == SquadX then primary.threads else background.threads`.
  - **Thread Groups** use `${squad_a_threads}` (and b, c, d); no hardcoded counts.
  - **If Controllers** in each Thread Group: “If primary.squad == squad_X (100% load)” runs the squad fragment when this squad is primary; “Else squad_X at 5% (background)” runs it when this squad is background. Same fragment in both branches; thread count (from UDV) determines 100% vs 5%.
- **Include Controllers**: each branch includes that squad’s **script-fragment.jmx** (Test Fragment + HTTP Request).
- **All Thread Groups start together**: Test Plan has **Run Thread Groups consecutively** = false.
- **Shared ramp-up and duration**: `${__P(rampup,10)}` and `${__P(duration,60)}` for all.

## Properties (externalized load)

Defined in `jmeter/shared/global.properties` and overridable with `-J`:

### Enterprise-Test.jmx (master plan)

| Property             | Default  | Description                                           |
|----------------------|----------|-------------------------------------------------------|
| `primary.squad`      | squad_a  | Squad that gets primary.threads (squad_a–squad_d)     |
| `primary.threads`    | 20       | Thread count for the primary squad                    |
| `background.threads`| 1        | Thread count for non-primary squads                  |
| `rampup`             | 10       | Ramp-up time (seconds), same for all                 |
| `duration`           | 60       | Test duration (seconds), same for all                |

### Shared (URL and standalone squad scripts)

| Property            | Default       | Description                    |
|--------------------|---------------|--------------------------------|
| `base.domain`      | example.com   | HTTP Request server name        |
| `base.protocol`    | https         | HTTP Request protocol          |
| `base.path`        | /             | HTTP Request path              |
| `squad_a.threads`  | 1             | Used by squad-a/script.jmx only |
| `squad_b.threads`  | 1             | Used by squad-b/script.jmx only |
| (same for c, d)    |               |                                |

**Switch primary squad (no hardcoding):**

```bash
./jmeter/main/run.sh -Jprimary.squad=squad_b -Jprimary.threads=30
./jmeter/main/run.sh -Jprimary.squad=squad_c
```

## How to run

**Prerequisite:** Apache JMeter 5.x on `PATH` or `JMETER_HOME` set.

### Start a run for your squad (100% for you, 5% for others) – recommended

From repository root, one command sets primary squad and user count; weight distribution is automatic. Accumulated result (all squads) is in one JTL and HTML report.

```bash
chmod +x jmeter/main/run-for-squad.sh
./jmeter/main/run-for-squad.sh squad_a 10
```

- **squad**: `squad_a` | `squad_b` | `squad_c` | `squad_d`
- **users**: threads for your squad (100%); other squads get 5% automatically.

See **[COPILOT-START-RUN.md](COPILOT-START-RUN.md)** for Copilot instructions and pipeline (GitHub Actions).

### Manual property override

```bash
./jmeter/main/run.sh -Jprimary.squad=squad_d -Jprimary.threads=25 -Jduration=300
```

Results are under `jmeter/results/<run_id>/` (results.jtl, jmeter.log, html/). The `run-for-squad.sh` script generates the HTML report and prints a short accumulated summary.

## Squad script rules

- **script-fragment.jmx**: Test Fragment + at least one HTTP Request (used by Enterprise-Test.jmx via Include Controller). Uses `base.domain`, `base.protocol`, `base.path` (no hardcoded load or URL).
- **script.jmx**: Standalone plan with its own Thread Group (`squad_<x>.threads`), same rampup/duration and HTTP request; for running a single squad outside the master.
- No hardcoded load; primary is chosen only via `primary.squad`.

## Adding a squad

1. Add `squad_<name>.threads=1` to `global.properties` (for standalone script.jmx).
2. Create `jmeter/squads/<squad-name>/script.jmx` (Thread Group + HTTP Request from properties).
3. Create `jmeter/squads/<squad-name>/script-fragment.jmx` (Test Fragment + HTTP Request only).
4. In **Enterprise-Test.jmx**: add a Thread Group with `num_threads` = `${__jexl3("${__P(primary.squad)}" == "squad_<name>" ? ${__P(primary.threads,20)} : ${__P(background.threads,1)})}`, same rampup/duration, and an Include Controller to `../squads/<squad-name>/script-fragment.jmx`.
5. In **run.sh**: no change (single Enterprise-Test.jmx run).

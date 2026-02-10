# JMeter scripting guidelines

Follow these when creating or updating squad scripts and the master plan.

---

## 1. Use properties for all load and target values

- **No hardcoded** thread counts, ramp-up, duration, or URLs.
- Use JMeter properties: `jmeter/shared/global.properties` and `-J` overrides.
- Thread count: `${__P(squad_x.threads,1)}` or, in the master plan, `${__jexl3(...)}` driven by `primary.squad`, `primary.threads`, `background.threads`.
- Ramp-up and duration: `${__P(rampup,10)}`, `${__P(duration,60)}`.
- HTTP target: `${__P(base.domain,example.com)}`, `${__P(base.protocol,https)}`, `${__P(base.path,/)}`.

---

## 2. Squad script layout

Each squad has two JMX files:

| File | Purpose |
|------|--------|
| **script-fragment.jmx** | Test Fragment + samplers. Included by Enterprise-Test.jmx. No Thread Group. |
| **script.jmx** | Standalone plan: Thread Group (using properties) + same samplers. For running the squad alone. |

Both must use the same property-based URL and no hardcoded load.

---

## 3. Master plan (Enterprise-Test.jmx)

- One Thread Group per squad. Thread count from User Defined Variables (e.g. `squad_a_threads`) set via `${__jexl3("${__P(primary.squad)}" == "squad_a" ? ${__P(primary.threads,20)} : ${__P(background.threads,1)})}`.
- Each Thread Group contains Include Controllers to the squad’s **script-fragment.jmx** (primary and else branches with If Controllers).
- Test Plan: **Run Thread Groups consecutively** = false so all squads start together.
- Primary squad is chosen only by the `primary.squad` property; do not hardcode which squad is primary.

---

## 4. Adding a new squad

1. Add default thread property to `jmeter/shared/global.properties` (e.g. `squad_x.threads=1`).
2. Create `jmeter/squads/<squad-name>/script.jmx`: Thread Group (properties for threads, rampup, duration) + at least one HTTP Request (properties for domain/protocol/path).
3. Create `jmeter/squads/<squad-name>/script-fragment.jmx`: Test Fragment + same HTTP Request(s), no Thread Group.
4. In Enterprise-Test.jmx: add a Thread Group (same UDV + If Controller pattern as existing squads) and Include Controllers to the new squad’s script-fragment.jmx.
5. In `jmeter/main/run-for-squad.sh`: add a line to run the new squad if you need it for parallel standalone runs; for the master plan, only Enterprise-Test.jmx and the new Include are required.

---

## 5. Naming and structure

- Squad IDs: `squad_a`, `squad_b`, etc. (match folder names and `primary.squad`).
- Keep fragment and standalone script in sync (same requests, same properties).
- Shared settings (rampup, duration, base URL) live in `global.properties`; squad-specific only where needed (e.g. `squad_x.threads` for standalone).

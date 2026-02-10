# TESTINGNEW

JMeter coordinated workload framework under **`jmeter/`**. Master plan: **Enterprise-Test.jmx** (one squad at 100%, others at 5%; weight distribution automatic).

- **Local:** Need Java 11+. JMeter is auto-detected from `jmeter/tools/apache-jmeter-5.6.3` if present. Run `./jmeter/main/check-prereqs.sh` to verify, then `./jmeter/main/test-local.sh` for a short test or `./jmeter/main/run-for-squad.sh squad_a 10` for a full run.
- **Pipeline:** No setup. GitHub Actions → **Load Test (Enterprise)** → choose squad and user count; Java and JMeter are installed in the job. Download the results artifact when done.
- **Copilot:** See **[COPILOT.md](COPILOT.md)** for exact phrases to use and what Copilot should run. Also [jmeter/docs/COPILOT-START-RUN.md](jmeter/docs/COPILOT-START-RUN.md). First time: [TEST-LOCALLY.md](TEST-LOCALLY.md) and [HOW-TO-RUN.md](HOW-TO-RUN.md).

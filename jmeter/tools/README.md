# JMeter for local runs (optional)

The **pipeline** downloads its own JMeter in the job. You don't need anything here for CI.

For **local** runs, either:

1. Put JMeter here: extract `apache-jmeter-5.6.3.tgz` so that `jmeter/tools/apache-jmeter-5.6.3/bin/jmeter` exists, or  
2. Set `JMETER_HOME` to your JMeter install directory.

Then run `./jmeter/main/test-local.sh` or `./jmeter/main/run-for-squad.sh squad_a 10`.

# plexpy2influx
Pipe select PlexPy metrics to InfluxDB so it can be graphed in Grafana


Most basic form:

    docker run -d -e PLEXPY_TOKEN="YOUR_API_TOKEN_HERE" mvantassel/plexpy2influx


# Configuration (ENV, -e)

Variable | Description | Default value | Sample value | Required?
-------- | ----------- | ------------- | ------------ | ---------
INFLUXDB_PROTOCOL | Is Influx SSL? | http | https |
INFLUXDB_HOST | Where is your InfluxDB running? | localhost | influxdb |
INFLUXDB_PORT | What port is InfluxDB running on? | 8086 | 999 |
INFLUXDB_DB | What InfluxDB database do you want to use? | 'plex' | 'potato' |
INFLUXDB_USER | InfluxDB username | | |
INFLUXDB_PASS | InfluxDB password | metrics | |

PLEXPY_TOKEN | What is your PlexPy API Token? | | abc123 |
PLEXPY_PROTOCOL | Is PlexPy SSL? | http | https |
PLEXPY_HOST | Where is your PlexPy running? | localhost | plexpy |
PLEXPY_PORT | What port is PlexPy running on? | 8181 | 999 |
PLEXPY_BASEURL | Is PlexPy running behind a proxy? | | 'plexpy' |

## Tags

- latest
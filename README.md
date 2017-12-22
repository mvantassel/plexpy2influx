# plexpy2influx
Pipe select PlexPy metrics to InfluxDB so it can be graphed in Grafana


Most basic form:

    docker run -d -e PLEXPY_TOKEN="YOUR_API_TOKEN_HERE" mvantassel/plexpy2influx


# Configuration (ENV, -e)

Variable | Description | Default value | Sample value | Required?
-------- | ----------- | ------------- | ------------ | ---------
INFLUX_PROTOCOL | Is Influx SSL? | http | https | optional
INFLUX_HOST | Where is your InfluxDB running? | localhost | influxdb | recommended
INFLUX_PORT | What port is InfluxDB running on? | 8086 | 999 | optional
INFLUX_DB | What InfluxDB database do you want to use? | 'plex' | 'potato' | required
INFLUX_USER | InfluxDB username | | | optional
INFLUX_PASS | InfluxDB password | | | optional
PLEXPY_TOKEN | What is your PlexPy API Token? | | abc123 | required
PLEXPY_PROTOCOL | Is PlexPy SSL? | http | https | optional
PLEXPY_HOST | Where is your PlexPy running? | localhost | plexpy | recommended
PLEXPY_PORT | What port is PlexPy running on? | 8181 | 999 | optional
PLEXPY_BASEURL | Is PlexPy running behind a proxy? | | 'plexpy' | optional
UPDATE_INTERVAL_MS | How often should it check for new metrics? | 30000 | 1000 | optional

# Example Output

### sessions
fields: `{ total_stream_count: 1,
  total_stream_playing_count: 1,
  transcode_stream_count: 1,
  transcode_stream_playing_count: 1,
  direct_stream_count: 0,
  direct_stream_playing_count: 0 }`  
tags: `{ resolution: '1080p' }`

### users
fields: `{ duration: 0, plays: 0 }`  
tags: `{ username: 'username' }`

### library
fields: `{ count: 1 }`  
tags: `{ type: 'movie', section: 'section name' }`

# Tags

- latest

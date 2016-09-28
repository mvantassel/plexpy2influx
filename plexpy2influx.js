'use strict';

const influx = require('influx');
const request = require('request-promise');

if (!process.env.PLEXPY_TOKEN) {
    throw new Error('PLEXPY_TOKEN is required');
}

const checkInterval = process.env.UPDATE_INTERVAL_MS || 1000 * 30;

const influxClient = influx({
    host: process.env.INFLUX_HOST || 'localhost',
    port: process.env.INFLUX_PORT || 8086,
    protocol: process.env.INFLUX_PROTOCOL || 'http',
    database: process.env.INFLUX_DB || 'plex'
});

const plexPyConfig = {
    token: process.env.PLEXPY_TOKEN,
    host: process.env.PLEXPY_HOST || 'localhost',
    protocol: process.env.PLEXPY_PROTOCOL ||'http',
    port: process.env.PLEXPY_PORT || 8181,
    baseUrl: process.env.PLEXPY_BASEURL || ''
};

const plexpyOptions = {
    url: `${plexPyConfig.protocol}://${plexPyConfig.host}:${plexPyConfig.port}/${plexPyConfig.baseUrl}/api/v2?apikey=${plexPyConfig.token}`,
    resolveWithFullResponse: true
};

function getPlexPyActivityData() {
    return request(Object.assign(plexpyOptions, {
        qs: { cmd: 'get_activity' }
    }));
}

function getPlexPyLibraryData() {
    return request(Object.assign(plexpyOptions, {
        qs: { cmd: 'get_libraries' }
    }));
}

function getPlexPyUsersData() {
    return request(Object.assign(plexpyOptions, {
        qs: { cmd: 'get_users_table' }
    }));
}

function writeToInflux(seriesName, values, tags, callback) {
    return influxClient.writePoint(seriesName, values, tags, callback);
}

function groupBy(arr, key) {
    var newArr = [],
        types = {},
        newItem, i, j, cur;
    for (i = 0, j = arr.length; i < j; i++) {
        cur = arr[i];
        if (!(cur[key] in types)) {
            types[cur[key]] = { type: cur[key], data: [] };
            newArr.push(types[cur[key]]);
        }
        types[cur[key]].data.push(cur);
    }
    return newArr;
}

function onGetPlexPyActivityData(response) {
    let sessions = JSON.parse(response.body).response.data.sessions;

    if (sessions.length === 0) {
        console.log(`No sessions to log: ${new Date()}`);
        return;
    }

    let sessionsByResolution = groupBy(sessions, 'video_resolution');

    sessionsByResolution.forEach(data => {
        let resolutionSessions = data.data;

        let sessionData = {
            total_stream_count: resolutionSessions && resolutionSessions.length || 0,
            total_stream_playing_count: 0,
            transcode_stream_count: 0,
            transcode_stream_playing_count: 0,
            direct_stream_count: 0,
            direct_stream_playing_count: 0
        };

        let tags = {
            resolution: data.type
        };

        resolutionSessions.forEach(session => {
            if (session.transcode_decision === 'direct play') {
                sessionData.direct_stream_count++;
                if (session.state === 'playing') {
                    sessionData.direct_stream_playing_count++;
                }
            } else {
                sessionData.transcode_stream_count++;
                if (session.state === 'playing') {
                    sessionData.transcode_stream_playing_count++;
                }
            }

            if (session.state === 'playing') {
                sessionData.total_stream_playing_count++;
            }
        });

        writeToInflux('sessions', sessionData, tags, function() {
            console.dir(`wrote sessions data to influx: ${new Date()}`);
        });

    });

}

function onGetPlexPyLibraryData(response) {
    let libraryData = JSON.parse(response.body).response.data;

    libraryData.forEach(library => {
        let value = { count: Number(library.count) };
        let tags = {
            type: library.section_type,
            section: library.section_name
        };

        writeToInflux('library', value, tags, function() {
            console.dir(`wrote ${library.section_name} library data to influx: ${new Date()}`);
        });
    });
}

function onGetPlexPyUsersData(response) {
    let usersData = JSON.parse(response.body).response.data.data;

    usersData.forEach(user => {
        let value = {
            duration: user.duration,
            plays: user.plays
        };
        let tags = { username: user.friendly_name };

        writeToInflux('users', value, tags, function() {
            console.dir(`wrote ${user.friendly_name} user data to influx: ${new Date()}`);
        });
    });
}

function restart() {
    // Every {checkInterval} seconds
    setTimeout(getAllTheMetrics, checkInterval);
}

function getAllTheMetrics() {
    getPlexPyActivityData().then(onGetPlexPyActivityData)
        .then(getPlexPyLibraryData).then(onGetPlexPyLibraryData)
        .then(getPlexPyUsersData).then(onGetPlexPyUsersData)
        .finally(restart);
}

getAllTheMetrics();

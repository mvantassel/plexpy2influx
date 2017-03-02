'use strict';

if (!process.env.PLEXPY_TOKEN) {
    throw new Error('PLEXPY_TOKEN is required');
}

const Influx = require('influx');
const request = require('request-promise');

const checkInterval = process.env.UPDATE_INTERVAL_MS || 1000 * 30;

const influxClient = new Influx.InfluxDB({
    host: process.env.INFLUX_HOST || 'localhost',
    port: process.env.INFLUX_PORT || 8086,
    protocol: process.env.INFLUX_PROTOCOL || 'http',
    database: process.env.INFLUX_DB || 'plex'
});

const plexPyConfig = {
    token: process.env.PLEXPY_TOKEN || '',
    host: process.env.PLEXPY_HOST || 'localhost',
    protocol: process.env.PLEXPY_PROTOCOL ||'http',
    port: process.env.PLEXPY_PORT || 8181,
    baseUrl: process.env.PLEXPY_BASEURL || ''
};

const plexpyOptions = {
    url: `${plexPyConfig.protocol}://${plexPyConfig.host}:${plexPyConfig.port}/${plexPyConfig.baseUrl}/api/v2?apikey=${plexPyConfig.token}`,
    resolveWithFullResponse: true
};

const STATE_PLAYING = 'playing';
const STREAM_DIRECTPLAY = 'direct play';

let timer;

function log(message) {
    console.log(message);
}

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

function writeToInflux(seriesName, values, tags) {
    return influxClient.writeMeasurement(seriesName, [{
        fields: values,
        tags: tags
    }]);
}

function groupBy(data, key) {
    let newArr = [], types = {};

    data.forEach(item => {
        if (!(item[key] in types)) {
            types[item[key]] = {type: item[key], data: []};
            newArr.push(types[item[key]]);
        }
        types[item[key]].data.push(item);
    });

    return newArr;
}

function onGetPlexPyActivityData(response) {
    let sessions = JSON.parse(response.body).response.data.sessions;

    if (sessions.length === 0) {
        api.log(`${new Date()}: No sessions to log`);
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
            if (session.state !== STATE_PLAYING) {
                return;
            }

            if (session.transcode_decision === STREAM_DIRECTPLAY) {
                sessionData.direct_stream_count++;
                if (session.state === STATE_PLAYING) {
                    sessionData.direct_stream_playing_count++;
                }
            } else {
                sessionData.transcode_stream_count++;
                if (session.state === STATE_PLAYING) {
                    sessionData.transcode_stream_playing_count++;
                }
            }

            if (session.state === STATE_PLAYING) {
                sessionData.total_stream_playing_count++;
            }
        });

        writeToInflux('sessions', sessionData, tags).then(function(){
            api.log(`${new Date()}: wrote session data to influx`);
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

        writeToInflux('library', value, tags).then(function(){
            api.log(`${new Date()}: wrote ${library.section_name} library data to influx`);
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

        writeToInflux('users', value, tags).then(function(){
            api.log(`${new Date()}: wrote ${user.friendly_name} user data to influx`);
        });
    });
}

function restart() {
    api.log(`${new Date()}: fetching plexpy metrics`);

    // Every {checkInterval} seconds
    timer = setTimeout(start, checkInterval);
}

function start() {
    let getActivityData = api.getPlexPyActivityData().then(onGetPlexPyActivityData);

    let getLibraryData = api.getPlexPyLibraryData().then(onGetPlexPyLibraryData);

    let getUserData = api.getPlexPyUsersData().then(onGetPlexPyUsersData);

    Promise.all([getActivityData, getLibraryData, getUserData]).then(restart, reason => {
        api.log(`${new Date()}: ${reason}`);
    });
}

function stop() {
    api.log(`${new Date()}: stopping plexpy2influx`);

    clearTimeout(timer);
}

let api = { getPlexPyActivityData, getPlexPyLibraryData, getPlexPyUsersData, log, start, stop, writeToInflux };

module.exports = api;

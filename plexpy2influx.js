'use strict';

const influx = require('influx');
const request = require('request');

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
    url: `${plexPyConfig.protocol}://${plexPyConfig.host}:${plexPyConfig.port}/${plexPyConfig.baseUrl}/api/v2?apikey=${plexPyConfig.token}`
};

function getPlexPyActivityData(callback) {
    return request(Object.assign(plexpyOptions, {
        url: plexpyOptions.url,
        qs: { cmd: 'get_activity' }
    }), callback);
}

function getPlexPyLibraryData(callback) {
    return request(Object.assign(plexpyOptions, {
        url: plexpyOptions.url,
        qs: { cmd: 'get_libraries' }
    }), callback);
}

function getPlexPyUsersData(callback) {
    return request(Object.assign(plexpyOptions, {
        url: plexpyOptions.url,
        qs: { cmd: 'get_users_table' }
    }), callback);
}

function writeToInflux(seriesName, values, tags, callback) {
    return influxClient.writePoint(seriesName, values, tags, callback);
}

function onGetPlexPyActivityData(error, response, body) {
    if (!body) {
        console.log(error);
        return;
    }

    let sessions = JSON.parse(body).response.data.sessions;

    let sessionData = {
        total_stream_count: sessions && sessions.length || 0,
        total_stream_playing_count: 0,
        transcode_stream_count: 0,
        transcode_stream_playing_count: 0,
        direct_stream_count: 0,
        direct_stream_playing_count: 0
    };

    if (sessions.length === 0) {
        console.log(`No sessions to log: ${new Date()}`);
        return;
    }

    sessions.forEach(session => {
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

        writeToInflux('session', {
            play_count: 1,
            progress_percent: session.progress_percent,
            transcode_progress: session.transcode_progress
        }, {
            type: session.transcode_decision,
            resolution: session.video_resolution,
            mediaType: session.media_type,
            title: session.full_title,
            player: session.player,
            user: session.user
        }, function() {
            console.dir(`wrote ${session.user} session data to influx: ${new Date()}`);
        });

        if (session.state === 'playing') {
            sessionData.total_stream_playing_count++;
        }
    });

    writeToInflux('sessions', sessionData, null, function() {
        console.dir(`wrote sessions data to influx: ${new Date()}`);
    });
}

function onGetPlexPyLibraryData(error, response, body) {
    if (!body) {
        console.log(error);
        return;
    }

    let libraryData = JSON.parse(body).response.data;

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

function onGetPlexPyUsersData(error, response, body) {
    if (!body) {
        console.log(error);
        return;
    }

    let usersData = JSON.parse(body).response.data.data;

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

function getAllTheMetrics() {
    getPlexPyActivityData(onGetPlexPyActivityData);
    getPlexPyLibraryData(onGetPlexPyLibraryData);
    getPlexPyUsersData(onGetPlexPyUsersData);
}

// Every {checkInterval} seconds
getAllTheMetrics();
setInterval(getAllTheMetrics, checkInterval);

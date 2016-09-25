'use strict';

let _ = require('lodash');
let influx = require('influx');
let request = require('request');

if (!process.env.PLEXPY_TOKEN) {
    throw new Error('PLEXPY_TOKEN is required');
}

let influxClient = influx({
    host: process.env.INFLUX_HOST || 'localhost',
    port: process.env.INFLUX_PORT || 8086,
    protocol: process.env.INFLUX_PROTOCOL || 'http',
    database: process.env.INFLUX_DB || 'plex'
});

let plexPyConfig = {
    token: process.env.PLEXPY_TOKEN,
    host: process.env.PLEXPY_HOST || 'localhost',
    protocol: process.env.PLEXPY_PROTOCOL ||'http',
    port: process.env.PLEXPY_PORT || 8181,
    baseUrl: process.env.PLEXPY_BASEURL || ''
};

let plexpyOptions = {
    url: `${plexPyConfig.protocol}://${plexPyConfig.host}:${plexPyConfig.port}/${plexPyConfig.baseUrl}/api/v2?apikey=${plexPyConfig.token}`
};

function getPlexPyActivityData(callback) {
    return request(_.extend(plexpyOptions, {
        url: plexpyOptions.url,
        qs: { cmd: 'get_activity' }
    }), callback);
}

function getPlexPyLibraryData(callback) {
    return request(_.extend(plexpyOptions, {
        url: plexpyOptions.url,
        qs: { cmd: 'get_libraries' }
    }), callback);
}

function getPlexPyUsersData(callback) {
    return request(_.extend(plexpyOptions, {
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

    var sessions = JSON.parse(body).response.data.sessions;

    var sessionData = {
        total_stream_count: sessions && sessions.length || 0,
        total_stream_playing_count: 0,
        transcode_stream_count: 0,
        transcode_stream_playing_count: 0,
        direct_stream_count: 0,
        direct_stream_playing_count: 0
    };

    var tags = {
        resolutions: {
            sd: 0,
            480: 0,
            720: 0,
            1080: 0,
            '4k': 0
        },
        mediaType: {
            episode: 0,
            movie: 0
        }
    };

    if (sessions.length === 0) {
        console.log('No sessions to log:', new Date());
        return;
    }

    _.each(sessions, function(session) {
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

        tags.resolutions[session.video_resolution]++;
        tags.mediaType[session.media_type]++;

        if (session.state === 'playing') {
            sessionData.total_stream_playing_count++;
        }
    });

    writeToInflux('sessions', sessionData, tags, function() {
        console.dir('wrote session data to influx');
    });
}

function onGetPlexPyLibraryData(error, response, body) {
    if (!body) {
        console.log(error);
        return;
    }

    var libraryData = JSON.parse(body).response.data;

    _.each(libraryData, function(library) {
        var value = { count: Number(library.count) };
        var tags = {
            type: library.section_type,
            section: library.section_name
        };

        writeToInflux('library', value, tags, function() {
            console.dir('wrote library data to influx:', new Date());
        });
    });
}

function onGetPlexPyUsersData(error, response, body) {
    if (!body) {
        console.log(error);
        return;
    }

    var usersData = JSON.parse(body).response.data.data;

    _.each(usersData, function(user) {
        var value = {
            duration: user.duration,
            plays: user.plays
        };
        var tags = { username: user.friendly_name };

        writeToInflux('users', value, tags, function() {
            console.dir('wrote user data to influx:', new Date());
        });
    });
}

function getAllTheMetrics() {
    getPlexPyActivityData(onGetPlexPyActivityData);
    getPlexPyLibraryData(onGetPlexPyLibraryData);
    getPlexPyUsersData(onGetPlexPyUsersData);
}

// Every minute
getAllTheMetrics();
setInterval(getAllTheMetrics, 1000 * 30);

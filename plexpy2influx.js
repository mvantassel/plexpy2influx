'use strict';

var _ = require('lodash');
var influx = require('influx');
var request = require('request');

if (!process.env.PLEXPY_TOKEN) {
    throw new Error('PLEXPY_TOKEN is required');
}

let influxClient = influx({
    host: process.env.INFLUX_HOST || 'localhost',
    port: process.env.INFLUX_PORT || 8086,
    protocol: process.env.INFLUX_PROTOCOL || 'http',
    database: process.env.INFLUX_DB || 'plex'
});

var plexPyConfig = {
    token: process.env.PLEXPY_TOKEN,
    host: process.env.PLEXPY_HOST || 'localhost',
    protocol: process.env.PLEXPY_PROTOCOL ||'http',
    port: process.env.PLEXPY_PORT || 8181,
    baseUrl: process.env.PLEXPY_BASEURL || 'plexpy'
};

var plexpyOptions = {
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

        if (session.state === 'playing') {
            sessionData.total_stream_playing_count++;
        }
    });

    writeToInflux('sessions', sessionData, null, function() {
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
            console.dir('wrote library data to influx');
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
            console.dir('wrote user data to influx');
        });
    });
}

// Get Plex Activity Data every second.
getPlexPyActivityData(onGetPlexPyActivityData);

// Get Plex Library Data every hour.
getPlexPyLibraryData(onGetPlexPyLibraryData);

// Get Plex User Data every hour.
getPlexPyUsersData(onGetPlexPyUsersData);

// Every minute
setInterval(function() {
    getPlexPyActivityData(onGetPlexPyActivityData);
}, 1000 * 60);

// Every hour
setInterval(function() {
    getPlexPyLibraryData(onGetPlexPyLibraryData);
    getPlexPyUsersData(onGetPlexPyUsersData);
}, 1000 * 60 * 60);

const assert = require('assert');

process.env.PLEXPY_TOKEN = '123';
process.env.PLEXPY_HOST = 'plex.com';
process.env.INFLUX_HOST = 'influx.com';

const plexpy2influx = require('../plexpy2influx');

describe('plexpy2influx', function() {

    it('should provide an api', function () {
        assert(typeof plexpy2influx === 'object');
        assert(typeof plexpy2influx.getPlexPyActivityData === 'function');
        assert(typeof plexpy2influx.getPlexPyLibraryData === 'function');
        assert(typeof plexpy2influx.getPlexPyUsersData === 'function');
        assert(typeof plexpy2influx.log === 'function');
        assert(typeof plexpy2influx.start === 'function');
        assert(typeof plexpy2influx.stop === 'function');
        assert(typeof plexpy2influx.writeToInflux === 'function');
    });

    it('should get plex activity data', function () {
        let request = plexpy2influx.getPlexPyActivityData();
        assert.equal(request.url.href, 'http://plex.com:8181//api/v2?apikey=123&cmd=get_activity');
    });

    it('should get plex library data', function () {
        let request = plexpy2influx.getPlexPyLibraryData();
        assert.equal(request.url.href, 'http://plex.com:8181//api/v2?apikey=123&cmd=get_libraries');
    });

    it('should get plex user data', function () {
        let request = plexpy2influx.getPlexPyUsersData();
        assert.equal(request.url.href, 'http://plex.com:8181//api/v2?apikey=123&cmd=get_users_table');
    });

    xit('should write data to influx', function () {
        // plexpy2influx.writeToInflux();
    });

    xit('should log messages', function () {
        // plexpy2influx.log('tomato');
    });

});
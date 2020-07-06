let SpotifyWebApi = require('spotify-web-api-node');

module.exports = function (api) {
    api.registerPlatform('homebridge-spotify', DCSpotify);
    api.registerAccessory('SpotifyAccessoryPlugin', SpotifyAccessoryPlugin);
}

class DCSpotify {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.accessories = [];

        let credentials = {
            clientId: config['client_id'],
            clientSecret: config['client_secret'],
            redirectUri: 'https://dc.wtf/callback'
        };

        this.spotify = new SpotifyWebApi(credentials);

        var scopes = [
            'user-read-playback-state',
            'user-library-read',
            'user-read-currently-playing',
            'user-modify-playback-state',
            'user-follow-read',
            'playlist-read-private',
        ];
        var state = 'wooooo_come_on';

        log(this.spotify.createAuthorizeURL(scopes, state));

        let that = this;
        api.on('didFinishLaunching', () => {
            this.updateCredentials()
            .then(
                function() {
                    return that.getDevices()
                }
            ).then (
                function(devices) {
                    // id: '7c0d49154d546f0f78bb42c93d475563541ce58f',
                    // is_active: false,
                    // is_private_session: false,
                    // is_restricted: false,
                    // name: 'DESKTOP-2637H46',
                    // type: 'Computer',
                    // volume_percent: 74
                    that.log.debug('Got devices ' + devices);
                    Array.prototype.forEach.call(devices, device => {
                        const deviceUUID = api.hap.uuid.generate(device['id']);
                        let existingAccessory = that.accessories.find(accessory => accessory.UUID === deviceUUID);
                        if (existingAccessory) {
                            that.log('Device ' + device['name'] + ' is already registered');
                            api.unregisterPlatformAccessories('homebridge-spotify', [existingAccessory]);
                        }

                        let accessory = new SpotifyAccessoryPlugin(that.log, device, that.api);
                        if (!accessory) {
                            that.log.debug('The accessory was not created');
                        } else {
                            that.log.debug('Registering ' + device['name']);
                            that.api.registerPlatformAccessories('homebridge-spotify', 'homebridge-spotify', [accessory]);
                        }
                    });
                }
            )
            .catch(error => this.log(error));
        });
    }

    configureAccessory(accessory) {
        this.log('Pushing accessory');
        this.accessories.push(accessory);
    };


    // accessories: function (callback) {
    //     let that = this;

    //     this.updateCredentials(function() {
    //         that.log("Finished getting credentials");
    //         that.getDevices();
    //     });

    //     callback([]);
    // },

    getDevices() {
        this.log.debug('Getting devices');
        let that = this;
        return new Promise(function(resolve, reject) {
            that.spotify.getMyDevices().then(
                function (data) {
                    resolve(data.body.devices);
                },
                function (error) {
                    reject(error);
                }
            );
        });
    }

    updateCredentials() {
        this.log.debug('Updating credentials');
        let that = this;
        return new Promise(function(resolve, reject) {
            if ('access_token' in that.config && 'refresh_token' in that.config) {
                that.log.debug("Found token and refresh");
                that.log.debug('Token: ' + that.config['access_token']);
                that.log.debug('Refresh ' + that.config['refresh_token']);
                that.spotify.setRefreshToken(that.config['refresh_token']);

                that.log.debug("Refreshing just in case LOL :-)");
                that.spotify.refreshAccessToken().then(
                    function (data) {
                        that.log.debug('Got a new token: ' + data.body['access_token']);
                        that.spotify.setAccessToken(data.body['access_token']);
                        that.spotify.setRefreshToken(data.body['refresh_token']);
                        resolve();
                    },
                    function (error) {
                        reject(error);
                    }
                );
            } else {
                that.log.debug("No token or refresh. Finding one based on code");
                that.spotify.authorizationCodeGrant(that.config['code']).then(
                    function (data) {
                        that.log.debug('Token expiring: ' + data.body['expires_in']);
                        that.log.debug('Token: ' + data.body['access_token']);
                        that.log.debug('Refresh ' + data.body['refresh_token']);

                        that.spotify.setAccessToken(data.body['access_token']);
                        that.spotify.setRefreshToken(data.body['refresh_token']);
                        resolve();
                    },
                    function (error) {
                        reject(error);
                    }
                );
            }
        });
    }
}

class SpotifyAccessoryPlugin extends PlatformAccessory {
    constructor(log, config, api, data) {
        this.log = log;
        this.config = config;
        this.api = api;

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        // extract name from config
        this.name = config['name'];
        this.UUID = api.hap.uuid.generate(config['id']);

        // create a new Smart Speaker service
        this.service = new this.Service(this.Service.SmartSpeaker, this.UUID);

        // create handlers for required characteristics
        this.service.getCharacteristic(this.Characteristic.CurrentMediaState)
            .on('get', this.handleCurrentMediaStateGet.bind(this));

        this.service.getCharacteristic(this.Characteristic.TargetMediaState)
            .on('get', this.handleTargetMediaStateGet.bind(this))
            .on('set', this.handleTargetMediaStateSet.bind(this));

        this.log.debug("Hello, I am " + this.name);
    }

    /**
     * Handle requests to get the current value of the "Current Media State" characteristic
     */
    handleCurrentMediaStateGet(callback) {
        this.log.debug('Triggered GET CurrentMediaState');

        // set this to a valid value for CurrentMediaState
        const currentValue = 1;

        callback(null, currentValue);
    }


    /**
     * Handle requests to get the current value of the "Target Media State" characteristic
     */
    handleTargetMediaStateGet(callback) {
        this.log.debug('Triggered GET TargetMediaState');

        // set this to a valid value for TargetMediaState
        const currentValue = 1;

        callback(null, currentValue);
    }

    /**
     * Handle requests to set the "Target Media State" characteristic
     */
    handleTargetMediaStateSet(value, callback) {
        this.log.debug(`Triggered SET TargetMediaState: ${value}`);

        callback(null);
    }
}

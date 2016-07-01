'use strict';

const constants = require('./constants');
const Disk = require('../persistence/disk');
const errors = require('./errors');
const logger = require('./logger');

const _ = require('lodash');
const async = require('async');
const net = require('net');

module.exports = {

    initialize: function(praetor, options) {
        options = options || {};
        this.options = _.defaults(options, {
            max_coalescing_duration: 1024
        });

        this.coalesce_timeout;
        this.praetor = praetor;
        this.scope = this.praetor.options.legiond.network.public ? 'public' : 'private';
    },

    snapshot_eligible: true,

    sync_ready: true,
    sync_options: {},

    type: null,

    bootstrap: function(fn) {
        const self = this;

        this.type = new Disk(this.options);

        this.snapshot_interval = setInterval(() => {
            self.snapshot((err) => {
                if(err) {
                    logger.log('warn', 'Could not snapshot data!');
                } else {
                    logger.log('verbose', 'Snapshotted data successfully!');
                }
            });
        }, 15000);

        if(this.snapshot_eligible) {
            this.type.bootstrap((err, snapshot) => {
                if(err) {
                    return fn(err);
                }

                self.data = snapshot.data || {};

                async.each(_.keys(snapshot.ttls), (key, cb) => {
                    const date = new Date().valueOf();
                    const ttl = snapshot.ttls[key];
                    const expires = ttl.start + _.parseInt(ttl.duration);

                    if(date < expires) {
                        return self.ttl(key, (expires - date), cb);
                    }

                    return cb();
                }, () => {
                    self.sync();

                    return fn();
                });
            });
        }
        else {
            async.each(_.keys(this.ttls), (key, cb) => {
                const date = new Date().valueOf();
                const ttl = self.ttls[key];
                const expires = ttl.start + _.parseInt(ttl.duration);

                if(date < expires) {
                    return self.ttl(key, (expires - date), cb);
                }

                return cb();
            }, () => {
                self.sync();

                return fn();
            });
        }
    },

    data: {},

    ttls: {},

    timers: {},

    snapshot: function(fn) {
        this.type.snapshot({
            data: this.data,
            ttls: this.ttls
        }, fn);
    },

    keys: function(pattern, fn) {
        if(_.isFunction(pattern)) {
            fn = pattern;
            pattern = undefined;
        }

        let matches;

        if(_.isUndefined(pattern)) {
            matches = _.keys(this.data);
        }

        if(_.isUndefined(matches)) {
            let regex;

            try {
                regex = new RegExp(pattern, 'g');
            }
            catch(err) {
                return fn(err);
            }

            matches = _.map(_.keys(this.data), (key) => {
                if(key.match(regex)) {
                    return key;
                }
            });

            matches = _.compact(matches);
            matches = _.flatten(matches);
        }

        return fn(null, matches);
    },

    get: function(key, options, fn) {
        if(_.isFunction(options)) {
            fn = options;
            options = {
                local: true
            };
        }

        if(options.local || this.praetor.is_controlling_leader()) {
            if(_.has(this.data, key)) {
                return fn(null, this.data[key]);
            } else {
                return fn(new errors.ENOKEY());
            }
        }
        else if(!_.isUndefined(this.praetor.get_controlling_leader())) {
            const leader = this.praetor.get_controlling_leader();
            const client = new net.Socket();

            client.connect(leader.management_port, leader.address[this.scope], () => {
                client.write(['GET', key].join(' '));
                client.write(constants.message.DELIMITER);
            });

            client.on('error', (err) => {
                return fn(err);
            });

            client.on('data', (data) => {
                client.destroy();

                data = data.toString().split(constants.message.DELIMITER)[0];

                if(_.isEmpty(data)) {
                    return fn();
                }

                try {
                    const error = new errors.ENOKEY();

                    if(JSON.parse(data).error == error.message) {
                        return fn(new errors.EFAILEDPROXY(JSON.parse(data).error));
                    } else {
                        return fn(null, data);
                    }
                }
                catch(err) {
                    return fn(null, data);
                }
            });
        } else {
            return fn(new errors.ENOLEADER());
        }
    },

    set: function(key, value, fn) {
        const self = this;

        if(this.praetor.is_controlling_leader()) {
            setImmediate(() => {
                self.data[key] = value;

                self.sync({
                    partial: true,
                    changes: [{
                        method: 'update',
                        path: ['data', key],
                        value: self.data[key]
                    }]
                });

                return fn();
            });
        }
        else if(!_.isUndefined(this.praetor.get_controlling_leader())) {
            var leader = this.praetor.get_controlling_leader();
            var client = new net.Socket();

            client.connect(leader.management_port, leader.address[this.scope], () => {
                client.write(['SET', key, value].join(' '));
                client.write(constants.message.DELIMITER);
            });

            client.on('error', (err) => {
                return fn(err);
            });

            client.on('data', (data) => {
                client.destroy();

                data = data.toString().split(constants.message.DELIMITER)[0];

                if(_.isEmpty(data)) {
                    return fn();
                }

                try {
                    return fn(new errors.EFAILEDPROXY(JSON.parse(data).error));
                }
                catch(err) {
                    return fn(err);
                }
            });
        } else {
            return fn(new errors.ENOLEADER());
        }
    },

    delete: function(key, fn) {
        const self = this;

        if(this.praetor.is_controlling_leader()) {
            if(_.has(this.data, key)) {
                setImmediate(() => {
                    delete self.data[key];
                    delete self.ttls[key];
                    clearTimeout(self.timers[key]);
                    delete self.timers[key];

                    self.sync({
                        partial: true,
                        changes: [{
                            method: 'delete',
                            path: ['data', key]
                        },
                        {
                            method: 'delete',
                            path: ['ttls', key]

                        }]
                    });

                    return fn();
                });
            } else {
                return fn(new errors.ENOKEY());
            }
        }
        else if(!_.isUndefined(this.praetor.get_controlling_leader())) {
            const leader = this.praetor.get_controlling_leader();
            const client = new net.Socket();

            client.connect(leader.management_port, leader.address[this.scope], () => {
                client.write(['DELETE', key].join(' '));
                client.write(constants.message.DELIMITER);
            });

            client.on('error', (err) => {
                return fn(err);
            });

            client.on('data', (data) => {
                client.destroy();

                data = data.toString().split(constants.message.DELIMITER)[0];

                if(_.isEmpty(data)) {
                    return fn();
                }

                try {
                    return fn(new errors.EFAILEDPROXY(JSON.parse(data).error));
                }
                catch(err) {
                    return fn(err);
                }
            });
        } else {
            return fn(new errors.ENOLEADER());
        }
    },

    flush: function(fn) {
        const self = this;

        if(this.praetor.is_controlling_leader()) {
            return setImmediate(() => {
                self.data = {};
                self.ttls = {};

                _.each(self.timers, (timer) => {
                    clearTimeout(timer);
                });

                self.timers = {};
                self.sync();

                return fn();
            });
        }
        else if(!_.isUndefined(this.praetor.get_controlling_leader())) {
            const leader = this.praetor.get_controlling_leader();
            const client = new net.Socket();

            client.connect(leader.management_port, leader.address[this.scope], () => {
                client.write('FLUSH');
                client.write(constants.message.DELIMITER);
            });

            client.on('error', (err) => {
                return fn(err);
            });

            client.on('data', (data) => {
                client.destroy();

                data = data.toString().split(constants.message.DELIMITER)[0];

                if(_.isEmpty(data)) {
                    return fn();
                }

                try {
                    return fn(new errors.EFAILEDPROXY(JSON.parse(data).error));
                }
                catch(err) {
                    return fn(err);
                }
            });
        } else {
            return fn(new errors.ENOLEADER());
        }
    },

    ttl: function(key, ttl, fn) {
        if(!_.has(this.data, key)) {
            return fn(new errors.ENOKEY());
        }

        if(_.isUndefined(ttl) || (_.isArray(ttl) && _.isEmpty(ttl))) {
            if(_.has(this.ttls, key)) {
                const remaining = this.ttls[key].duration - (new Date().valueOf() - this.ttls[key].start);

                return fn(null, {
                    ttl: remaining > 0 ? remaining : 0
                });
            }
            else {
                return fn(null, {ttl: -1});
            }
        }
        else {
            const self = this;

            if(_.isArray(ttl)) {
                ttl = _.first(ttl);
            }

            if(this.praetor.is_controlling_leader()) {
                if(_.has(this.timers, key)) {
                    clearTimeout(this.timers[key]);
                }

                if(ttl == '-1') {
                    setImmediate(() => {
                        delete this.ttls[key];
                        delete this.timers[key];

                        self.sync({
                            partial: true,
                            changes: [{
                                method: 'delete',
                                path: ['ttls', key]
                            }]
                        });

                        return fn();
                    });
                }

                this.ttls[key] = {
                    start: new Date().valueOf(),
                    duration: ttl
                };

                this.timers[key] = setTimeout(() => {
                    delete self.data[key];
                    delete self.ttls[key];
                    delete self.timers[key];

                    self.sync({
                        partial: true,
                        changes: [{
                            method: 'delete',
                            path: ['data', key]
                        },
                        {
                            method: 'delete',
                            path: ['ttls', key]
                        }]
                    });
                }, ttl);

                setImmediate(() => {
                    self.sync({
                        partial: true,
                        changes: [{
                            method: 'update',
                            path: ['ttls', key],
                            value: self.ttls[key]
                        }]
                    });

                    return fn();
                });
            }
            else if(!_.isUndefined(this.praetor.get_controlling_leader())) {
                var leader = this.praetor.get_controlling_leader();
                var client = new net.Socket();

                client.connect(leader.management_port, leader.address[this.scope], () => {
                    client.write(['TTL', key, ttl].join(' '));
                    client.write(constants.message.DELIMITER);
                });

                client.on('error', (err) => {
                    return fn(err);
                });

                client.on('data', (data) => {
                    client.destroy();

                    data = data.toString().split(constants.message.DELIMITER)[0];

                    if(_.isEmpty(data)) {
                        return fn();
                    }

                    try {
                        return fn(new errors.EFAILEDPROXY(JSON.parse(data).error));
                    }
                    catch(err) {
                        return fn(err);
                    }
                });
            } else {
                return fn(new errors.ENOLEADER());
            }
        }
    },

    sync: function(options) {
        var self = this;

        const write_log = (options) => {
            if(_.isUndefined(options.recipients)) {
                logger.log('verbose', `Sending ${options.event} to cluster`);
            } else {
                _.each(options.recipients, (recipient) => {
                    logger.log('verbose', `Sending ${options.event} to ${recipient && recipient.host_name}`);
                });
            }
        };

        options = _.defaults(options || {}, {
            partial: false,
            coalesce: true,
            recipients: undefined
        });

        if(options.coalesce) {
            if(!_.has(this.sync_options, 'event')) {
                this.sync_options.event = options.partial ? 'myriad.sync.partial' : 'myriad.sync.full';
            } else if(!options.partial) {
                this.sync_options.event = 'myriad.sync.full';
            }

            if(!_.has(this.sync_options, 'data')) {
                this.sync_options.data = {};
            }

            if(this.sync_options.event == 'myriad.sync.partial') {
                if(!_.has(this.sync_options.data, 'changes')) {
                    this.sync_options.data.changes = [];
                }

                this.sync_options.data.changes = _.flatten([this.sync_options.data.changes, options.changes]);
            }
            else {
                this.sync_options.data = {
                    data: this.data,
                    ttls: this.ttls
                };
            }

            if(!_.has(this.sync_options.recipients, 'recipients')) {
                this.sync_options.recipients = options.recipients;
            } else if(_.isUndefined(options.recipients)) {
                this.sync_options.recipients = options.recipients;
            } else if(!_.isUndefined(this.sync_options.recipients)) {
                this.sync_options.recipients = _.flatten([this.sync_options.recipients, options.recipients]);
            }

            if(this.sync_ready && this.praetor.is_controlling_leader()) {
                self.sync_ready = false;

                setTimeout(() => {
                    self.sync_ready = true;

                    self.praetor.legiond.send(self.sync_options);

                    self.praetor.legiond.set_attributes({
                        last_sync: new Date().valueOf()
                    });

                    write_log({
                        recipients: self.sync_options.recipients,
                        event: self.sync_options.event
                    });

                    self.sync_options = {};

                }, self.options.max_coalescing_duration);
            }
        }
        else {
            setImmediate(() => {
                let sync_options;

                if(options.partial) {
                    sync_options = {
                        event: 'myriad.sync.partial',
                        data: options.changes
                    };
                }
                else {
                    sync_options = {
                        event: 'myriad.sync.full',
                        data: {
                            data: self.data,
                            ttls: self.ttls
                        }
                    };
                }

                self.praetor.legiond.send(sync_options, options.recipients);

                self.praetor.legiond.set_attributes({
                    last_sync: new Date().valueOf()
                });

                write_log({
                    recipients: options.recipients,
                    event: sync_options.event
                });
            });
        }
    }
};

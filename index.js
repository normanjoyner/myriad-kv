'use strict';

const Cluster = require('./lib/cluster');
const logger = require('./lib/logger');
const persistence = require('./lib/persistence');
const pkg = require('./package.json');
const Server = require('./lib/server');
const state = require('./lib/state');

const _ = require('lodash');
const async = require('async');

class Myriad {
    constructor(options) {
        this.options = options || {};

        if(this.options.standalone) {
            logger.initialize();
        } else if(this.options.logger) {
            logger.initialize(this.options.logger);
        }
    }

    listen(fn) {
        const self = this;

        if(this.options.standalone) {
            logger.log('info', `Starting ${pkg.name} version ${pkg.version}`);
        }

        async.series([
            (cb) => {
                _.defaults(self.options, {
                    standalone: false
                });

                _.defaults(self.options.legiond.network, {
                    port: 2777,
                    cidr: '127.0.0.1/32',
                    public: false
                });

                _.defaults(self.options.legiond.attributes, {
                    state: state.BOOTING,
                    management_port: 2666,
                    start_time: new Date().valueOf()
                });

                self.cluster = new Cluster(self.options);

                self.cluster.listen(() => {
                    logger.log('verbose', `LegionD listening on port ${self.options.legiond.network.port}`);

                    return cb();
                });
            },
            (cb) => {
                self.server = new Server({
                    port: self.options.legiond.attributes.management_port,
                    interface: self.options.legiond.network.public ? '0.0.0.0' : self.cluster.legiond.network.options.address.private
                });

                self.server.listen(() => {
                    logger.log('verbose', `TCP server listening on port ${self.options.legiond.attributes.management_port}`);

                    return cb();
                });
            }
        ], fn);
    }
}
Myriad.prototype.persistence = persistence;

module.exports = Myriad;

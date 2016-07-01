'use strict';

const logger = require('./logger');
const persistence = require('./persistence');
const state = require('./state');
const utils = require('./utils');

const _ = require('lodash');
const Praetor = require('praetor');

class Cluster {
    constructor(options) {
        this.options = options || {};
        this.praetor = new Praetor({
            leader_eligible: this.options.leader_eligible,
            legiond: this.options.legiond
        });

        this.legiond = this.praetor.legiond;
        state.initialize(this.legiond);
    }

    listen(fn) {
        const self = this;
        state.set(state.CLUSTERING);

        persistence.initialize(this.praetor, this.options.persistence);

        this.legiond.join('myriad.sync.full');
        this.legiond.join('myriad.sync.partial');

        this.legiond.on('myriad.sync.full', (message) => {
            persistence.data = message.data.data;
            persistence.ttls = message.data.ttls;

            self.legiond.set_attributes({
                last_sync: new Date().valueOf()
            });

            logger.log('verbose', 'Syncing data from leader');
        });

        this.legiond.on('myriad.sync.partial', (message) => {
            utils.apply_object_changes(persistence, message.data.changes);

            self.legiond.set_attributes({
                last_sync: new Date().valueOf()
            });

            logger.log('verbose', 'Syncing data from leader');
        });

        this.legiond.on('node_added', (node) => {
            if(self.praetor.is_controlling_leader()){
                persistence.sync({
                    coalesce: false,
                    recipients: [node]
                });
            }
        });

        this.legiond.on('leader_elected', () => {
            persistence.snapshot_eligible = false;
        });

        // handle promotion
        this.legiond.on('promoted', (/*data*/) => {
            logger.log('info', 'Promoted to cluster leader');

            self.legiond.join('myriad.set');
            self.legiond.join('myriad.delete');

            state.set(state.RECOVERING);

            persistence.bootstrap((err) => {
                if(err){
                    logger.log('error', err.message);
                    process.exit(1);

                    return;
                }

                state.set(state.OPERATIONAL);
                self.legiond.emit('myriad.bootstrapped');
            });
        });

        // handle demotion
        this.legiond.on('demoted', (/*data*/) => {
            clearInterval(persistence.snapshot_interval);
        });

        this.praetor.on('error', (err) => {
            // We should log eventually, currently though, praetor attempts
            // to connect to all addresses in CIDR range, most don't have
            // containership running
        });

        // emit when listening
        this.legiond.on('listening', () => {
            state.set(state.OPERATIONAL);

            const leader = self.praetor.get_controlling_leader();

            if(!_.isUndefined(leader)) {
                persistence.snapshot_eligible = false;
            }

            return fn();
        });
    }
}
module.exports = Cluster;

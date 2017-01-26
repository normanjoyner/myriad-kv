'use strict';

const constants = require('./constants');
const persistence = require('./persistence');

const _ = require('lodash');

module.exports = function(server) {
    return {
        KEYS: (socket, args) => {
            persistence.keys(_.first(args), (err, data) => {
                if(err){
                    socket.write(JSON.stringify({
                        error: err.message
                    }));
                }
                else {
                    socket.write(data.toString());
                }

                socket.write(constants.message.DELIMITER);
            });
        },

        GET: (socket, args) => {
            persistence.get(_.first(args), { local: true }, (err, data) => {
                if(err) {
                    socket.write(JSON.stringify({
                        error: err.message
                    }));
                }
                else {
                    socket.write(data.toString());
                }

                socket.write(constants.message.DELIMITER);
            });
        },

        EXISTS: (socket, args) => {
            persistence.exists(_.first(args), { local: true }, (err, exists) => {
                if(err) {
                    socket.write(JSON.stringify({
                        error: err.message
                    }));
                } else {
                    socket.write(exists);
                }

                socket.write(constants.message.DELIMITER);
            });
        },

        SET: (socket, args) => {
            persistence.set(_.first(args), _.rest(args).join(' '), (err) => {
                if(err){
                    socket.write(JSON.stringify({
                        error: err.message
                    }));
                }

                socket.write(constants.message.DELIMITER);
            });
        },

        SETNX: (socket, args) => {
            persistence.set(_.first(args), _.rest(args).join(' '), { if_not_exists: true }, (err) => {
                if(err){
                    socket.write(JSON.stringify({
                        error: err.message
                    }));
                }

                socket.write(constants.message.DELIMITER);
            });
        },

        TTL: (socket, args) => {
            persistence.ttl(_.first(args), _.rest(args), (err, data) => {
                if(err){
                    socket.write(JSON.stringify({
                        error: err.message
                    }));
                }
                else if(!_.isUndefined(data))
                    socket.write(JSON.stringify(data));

                socket.write(constants.message.DELIMITER);
            });
        },

        STAT: (socket/*, args*/) => {
            var hosts = [];
            if(_.has(persistence, 'praetor')){
                hosts = persistence.praetor.legiond.get_peers();
                hosts.push(persistence.praetor.legiond.get_attributes());
            }

            hosts = _.map(_.cloneDeep(hosts), (host) => {
                var leader = host.praetor.leader;
                host.leader = leader;
                delete host.praetor;
                return host;
            });

            server.getConnections((err, connections) => {
                socket.write(JSON.stringify({
                    keys: _.keys(persistence.data).length,
                    hosts: _.indexBy(hosts, 'id'),
                    connections: connections
                }));

                socket.write(constants.message.DELIMITER);
            });
        },

        SNAPSHOT: (socket/*, args*/) => {
            persistence.snapshot((err) => {
                if(err){
                    socket.write(JSON.stringify({
                        error: err.message
                    }));
                }

                socket.write(constants.message.DELIMITER);
            });
        },

        DELETE: (socket, args) => {
            persistence.delete(_.first(args), (err) => {
                if(err){
                    socket.write(JSON.stringify({
                        error: err.message
                    }));
                }

                socket.write(constants.message.DELIMITER);
            });
        },

        SUBSCRIBE: (socket, args) => {
            function on_event(message) {
                _.forEach(message.data.changes, (change) => {
                    const event = {
                        action: change.method,
                        type: _.first(change.path),
                        key: _.last(change.path),
                        value: change.value
                    };

                    if(args.length > 0) {
                        let regex;

                        try {
                            regex = new RegExp(_.first(args), 'g');
                        }
                        catch(err) {
                            socket.write(JSON.stringify({
                                error: err.message
                            }), () => {
                                socket.destroy();
                            });
                        }

                        let matches = event.key.match(regex);
                        matches = _.compact(matches);

                        if(matches.length > 0) {
                            socket.write(`${JSON.stringify(event)}${constants.message.DELIMITER}`);
                        }
                    } else {
                        socket.write(`${JSON.stringify(event)}${constants.message.DELIMITER}`);
                    }
                });
            }

            persistence.subscribe(on_event);

            socket.on('close', () => {
                persistence.subscribers = _.without(persistence.subscribers, on_event);
            });
        },

        FLUSH: (socket/*, args*/) => {
            persistence.flush((err) => {
                if(err){
                    socket.write(JSON.stringify({
                        error: err.message
                    }));
                }

                socket.write(constants.message.DELIMITER);
            });
        },

        NOT_FOUND: (socket/*, args*/) => {
            socket.write(JSON.stringify({error: 'Command not found!'}));
            socket.write(constants.message.DELIMITER);
        },

        QUIT: (socket/*, args*/) => {
            socket.end();
        }
    };

};

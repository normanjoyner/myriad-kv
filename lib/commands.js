'use strict';

const constants = require('./constants');
const persistence = require('./persistence');

const _ = require('lodash');

module.exports = {

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

        socket.write(JSON.stringify({
            keys: _.keys(persistence.data).length,
            hosts: _.indexBy(hosts, 'id')
        }));

        socket.write(constants.message.DELIMITER);
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

'use strict';

const constants = require('./constants');
const commands = require('./commands');
const logger = require('./logger');

const _ = require('lodash');
const net = require('net');

class Server {
    constructor(options) {
        options = options || {};
        this.options = _.defaults(options, {
            port: 2666
        });

        this.tcp = net.createServer((socket) => {
            let buffer = [];

            socket.on('data', (data) => {
                if(_.isEmpty(buffer)) {
                    data = data.toString();
                } else {
                    data = buffer.join('') + data.toString();
                    buffer = [];
                }

                const issued = data.split(constants.message.DELIMITER);

                if(!_.isEmpty(_.last(issued))) {
                    buffer.push(_.last(issued));
                }

                _.each(_.initial(issued), (d) => {
                    d = d.split(' ');

                    const command = _.first(d).toUpperCase();
                    const args = _.rest(d);

                    if(_.has(commands, command)) {
                        commands[command](socket, args);
                    } else {
                        commands.NOT_FOUND(socket, args);
                    }
                });
            });

            socket.on('error', (err) => {
                logger.log('error', err.message);
            });

        });
    }

    listen(fn) {
        this.tcp.listen(this.options.port, this.options.interface);

        return fn();
    }
}
module.exports = Server;

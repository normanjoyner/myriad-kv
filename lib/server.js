var net = require("net");
var _ = require("lodash");
var constants = require([__dirname, "constants"].join("/"));
var commands = require([__dirname, "commands"].join("/"));
var logger = require([__dirname, "logger"].join("/"));

function Server(options){
    _.defaults(options, {
        port: 2666
    });

    this.options = options;

    this.tcp = net.createServer(function(socket){

        var buffer = [];

        socket.on("data", function(data){
            if(_.isEmpty(buffer))
                data = data.toString();
            else{
                data = buffer.join("") + data.toString();
                buffer = [];
            }

            var issued = data.split(constants.message.DELIMITER);

            if(!_.isEmpty(_.last(issued)))
                buffer.push(_.last(issued));

            _.each(_.initial(issued), function(d){
                d = d.split(" ");

                var command = _.first(d).toUpperCase();
                var args = _.rest(d);

                if(_.has(commands, command))
                    commands[command](socket, args);
                else
                    commands.NOT_FOUND(socket, args);
            });
        });

        socket.on("error", function(err){
            logger.log("error", err.message);
        });

    });
}

Server.prototype.listen = function(fn){
    this.tcp.listen(this.options.port, this.options.interface);
    return fn();
}

module.exports = Server;

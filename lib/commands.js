var _ = require("lodash");
var persistence = require([__dirname, "persistence"].join("/"));
var size_of = require("object-sizeof");

module.exports = {

    KEYS: function(socket, args){
        persistence.keys(_.first(args), function(err, data){
            if(err){
                socket.write(JSON.stringify({
                    error: err.message
                }));
            }
            else
                socket.write(JSON.stringify(data));

            socket.write("\n");
        });
    },

    GET: function(socket, args){
        persistence.get(_.first(args), { local: true }, function(err, data){
            if(err){
                socket.write(JSON.stringify({
                    error: err.message
                }));
            }
            else
                socket.write(data.toString());

            socket.write("\n");
        });
    },

    SET: function(socket, args){
        persistence.set(_.first(args), _.rest(args).join(" "), function(err){
            if(err){
                socket.write(JSON.stringify({
                    error: err.message
                }));
            }

            socket.write("\n");
        });
    },

    TTL: function(socket, args){
        persistence.ttl(_.first(args), _.rest(args), function(err, data){
            if(err){
                socket.write(JSON.stringify({
                    error: err.message
                }));
            }
            else if(!_.isUndefined(data))
                socket.write(JSON.stringify(data));

            socket.write("\n");
        });
    },

    STAT: function(socket, args){
        var hosts = [];
        if(_.has(persistence, "praetor")){
            hosts = persistence.praetor.legiond.get_peers();
            hosts.push(persistence.praetor.legiond.get_attributes());
        }

        hosts = _.map(hosts, function(host){
            var leader = host.praetor.leader;
            host.leader = leader;
            delete host.praetor;
            return host;
        });

        socket.write(JSON.stringify({
            keys: _.keys(persistence.data).length,
            size: size_of(persistence.data),
            hosts: _.indexBy(hosts, "id")
        }));
        socket.write("\n");
    },

    DELETE: function(socket, args){
        persistence.delete(_.first(args), function(err){
            if(err){
                socket.write(JSON.stringify({
                    error: err.message
                }));
            }

            socket.write("\n");
        });
    },

    FLUSH: function(socket, args){
        persistence.flush(function(err){
            if(err){
                socket.write(JSON.stringify({
                    error: err.message
                }));
            }

            socket.write("\n");
        });
    },

    NOT_FOUND: function(socket, args){
        socket.write(JSON.stringify({error: "Command not found!"}));
        socket.write("\n");
    },

    QUIT: function(socket, args){
        socket.end();
    }

}

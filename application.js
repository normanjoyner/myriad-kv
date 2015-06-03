var _ = require("lodash");
var async = require("async");
var pkg = require([__dirname, "package"].join("/"));
var logger = require([__dirname, "lib", "logger"].join("/"));
var persistence = require([__dirname, "lib", "persistence"].join("/"));
var Cluster = require([__dirname, "lib", "cluster"].join("/"));
var Server = require([__dirname, "lib", "server"].join("/"));
var state = require([__dirname, "lib", "state"].join("/"));

function Myriad(options){
    this.options = options;
    if(this.options.standalone)
        logger.initialize();
    else if(_.has(this.options, "logger"))
        logger.initialize(this.options.logger);
}

Myriad.prototype.listen = function(fn){
    var self = this;

    if(this.options.standalone)
        logger.log("info", ["Starting", pkg.name, "version", pkg.version].join(" "));

    async.series([
        function(fn){
            _.defaults(self.options, {
                standalone: false
            });

            _.defaults(self.options.legiond.network, {
                port: 2777,
                cidr: "127.0.0.1/32",
                public: false
            });

            _.defaults(self.options.legiond.attributes, {
                state: state.BOOTING,
                management_port: 2666,
                start_time: new Date().valueOf()
            });

            self.cluster = new Cluster(self.options);

            self.cluster.listen(function(){
                logger.log("verbose", ["LegionD listening on port", self.options.legiond.network.port].join(" "));
                return fn();
            });
        },
        function(fn){
            self.server = new Server({
                port: self.options.legiond.attributes.management_port,
                interface: self.options.legiond.network.public ? "0.0.0.0" : self.cluster.legiond.network.options.address.private
            });

            self.server.listen(function(){
                logger.log("verbose", ["TCP server listening on port", self.options.legiond.attributes.management_port].join(" "));
                return fn();
            });
        }
    ], fn);
}

Myriad.prototype.persistence = persistence;

module.exports = Myriad;

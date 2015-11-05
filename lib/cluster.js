var _ = require("lodash");
var Praetor = require("praetor");
var persistence = require([__dirname, "persistence"].join("/"));
var state = require([__dirname, "state"].join("/"));
var logger = require([__dirname, "logger"].join("/"));
var utils = require([__dirname, "utils"].join("/"));

function Cluster(options){
    this.options = options;
    this.praetor = new Praetor({
        leader_eligible: this.options.leader_eligible,
        legiond: this.options.legiond
    });
    this.legiond = this.praetor.legiond;
    state.initialize(this.legiond);
}

Cluster.prototype.listen = function(fn){
    var self = this;
    state.set(state.CLUSTERING);

    persistence.initialize(this.praetor, this.options.persistence);

    this.legiond.join("myriad.sync.full");
    this.legiond.join("myriad.sync.partial");

    this.legiond.on("myriad.sync.full", function(message){
        persistence.data = message.data.data;
        persistence.ttls = message.data.ttls;
        self.legiond.set_attributes({
            last_sync: new Date().valueOf()
        });
        logger.log("verbose", "Syncing data from leader");
    });

    this.legiond.on("myriad.sync.partial", function(message){
        utils.apply_object_changes(persistence, message.data.changes);
        self.legiond.set_attributes({
            last_sync: new Date().valueOf()
        });
        logger.log("verbose", "Syncing data from leader");
    });

    this.legiond.on("node_added", function(node){
        if(self.praetor.is_controlling_leader())
            persistence.sync(node);
    });

    this.legiond.on("leader_elected", function(){
        persistence.snapshot_eligible = false;
    });

    // handle promotion
    this.legiond.on("promoted", function(data){
        logger.log("info", "Promoted to cluster leader");
        self.legiond.join("myriad.set");
        self.legiond.join("myriad.delete");

        var peers = self.legiond.get_peers();

        state.set(state.RECOVERING);
        persistence.bootstrap(function(err){
            if(err){
                logger.log("error", err.message);
                process.exit(1);
            }
            else{
                state.set(state.OPERATIONAL);
                self.legiond.emit("myriad.bootstrapped");
            }
        });
    });

    // handle demotion
    this.legiond.on("demoted", function(data){
        clearInterval(persistence.snapshot_interval);
    });

    // handle errors
    this.praetor.on("error", function(err){});

    // emit when listening
    this.legiond.on("listening", function(){
        state.set(state.OPERATIONAL);

        var leader = self.praetor.get_controlling_leader();
        if(!_.isUndefined(leader))
            persistence.snapshot_eligible = false;

        return fn();
    });
}

module.exports = Cluster;

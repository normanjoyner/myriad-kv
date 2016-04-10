var _ = require("lodash");
var async = require("async");
var net = require("net");
var logger = require([__dirname, "logger"].join("/"));
var errors = require([__dirname, "errors"].join("/"));
var constants = require([__dirname, "constants"].join("/"));
var Disk = require([__dirname, "..", "persistence", "disk"].join("/"));

module.exports = {

    initialize: function(praetor, options){
        this.options = _.defaults(options, {
            max_coalescing_duration: 1024
        });

        this.coalesce_timeout;
        this.praetor = praetor;
        this.scope = this.praetor.options.legiond.network.public ? "public" : "private";
    },

    snapshot_eligible: true,

    sync_ready: true,
    sync_options: {},

    type: null,

    bootstrap: function(fn){
        var self = this;

        this.type = new Disk(this.options);

        this.snapshot_interval = setInterval(function(){
            self.snapshot(function(err){
                if(err)
                    logger.log("warn", "Could not snapshot data!");
                else
                    logger.log("verbose", "Snapshotted data successfully!");
            });
        }, 15000);

        if(this.snapshot_eligible){
            this.type.bootstrap(function(err, snapshot){
                if(err)
                    return fn(err);

                self.data = snapshot.data || {};

                async.each(_.keys(snapshot.ttls), function(key, fn){
                    var date = new Date().valueOf();
                    var ttl = snapshot.ttls[key];
                    var expires = ttl.start + _.parseInt(ttl.duration);

                    if(date < expires)
                        self.ttl(key, (expires - date), fn);
                    else
                        return fn();
                }, function(){
                    self.sync();
                    return fn();
                });
            });
        }
        else{
            async.each(_.keys(this.ttls), function(key, fn){
                var date = new Date().valueOf();
                var ttl = self.ttls[key];
                var expires = ttl.start + _.parseInt(ttl.duration);

                if(date < expires)
                    self.ttl(key, (expires - date), fn);
                else
                    return fn();
            }, function(){
                self.sync();
                return fn();
            });
        }
    },

    data: {},

    ttls: {},

    timers: {},

    snapshot: function(fn){
        this.type.snapshot({
            data: this.data,
            ttls: this.ttls
        }, fn);
    },

    keys: function(pattern, fn){
        if(_.isFunction(pattern)){
            fn = pattern;
            pattern = undefined;
        }

        var matches;

        if(_.isUndefined(pattern))
            matches = _.keys(this.data)

        if(_.isUndefined(matches)){
            try{
                var regex = new RegExp(pattern, "g");
            }
            catch(err){
                return fn(err);
            }

            matches = _.map(_.keys(this.data), function(key){
                if(key.match(regex))
                    return key;
            });

            matches = _.compact(matches);
            matches = _.flatten(matches);
        }

        return fn(null, matches);
    },

    get: function(key, options, fn){
        if(_.isFunction(options)){
            fn = options;
            options = {
                local: true
            }
        }

        if(options.local || this.praetor.is_controlling_leader()){
            if(_.has(this.data, key))
                return fn(null, this.data[key]);
            else
                return fn(new errors.ENOKEY());
        }
        else if(!_.isUndefined(this.praetor.get_controlling_leader())){
            var leader = this.praetor.get_controlling_leader();
            var client = new net.Socket();

            client.connect(leader.management_port, leader.address[this.scope], function(){
                client.write(["GET", key].join(" "));
                client.write(constants.message.DELIMITER);
            });

            client.on("error", function(err){
                return fn(err);
            });

            client.on("data", function(data){
                client.destroy();

                data = data.toString().split(constants.message.DELIMITER)[0];

                if(_.isEmpty(data))
                    return fn();

                try{
                    var error = new errors.ENOKEY();
                    if(JSON.parse(data).error == error.message)
                        return fn(new errors.EFAILEDPROXY(JSON.parse(data).error));
                    else
                        return fn(null, data);
                }
                catch(err){
                    return fn(null, data);
                }
            });

        }
        else
            return fn(new errors.ENOLEADER());
    },

    set: function(key, value, fn){
        var self = this;

        if(this.praetor.is_controlling_leader()){
            setTimeout(function(){
                self.data[key] = value;

                self.sync({
                    partial: true,
                    changes: [{
                        method: "update",
                        path: ["data", key],
                        value: self.data[key]
                    }]
                });
                return fn();
            }, 0);
        }
        else if(!_.isUndefined(this.praetor.get_controlling_leader())){
            var leader = this.praetor.get_controlling_leader();
            var client = new net.Socket();

            client.connect(leader.management_port, leader.address[this.scope], function(){
                client.write(["SET", key, value].join(" "));
                client.write(constants.message.DELIMITER);
            });

            client.on("error", function(err){
                return fn(err);
            });

            client.on("data", function(data){
                client.destroy();

                data = data.toString().split(constants.message.DELIMITER)[0];

                if(_.isEmpty(data))
                    return fn();

                try{
                    return fn(new errors.EFAILEDPROXY(JSON.parse(data).error));
                }
                catch(err){
                    return fn(err);
                }
            });
        }
        else
            return fn(new errors.ENOLEADER());
    },

    delete: function(key, fn){
        var self = this;

        if(this.praetor.is_controlling_leader()){
            if(_.has(this.data, key)){
                setTimeout(function(){
                    delete self.data[key];
                    delete self.ttls[key];
                    clearTimeout(self.timers[key]);
                    delete self.timers[key];

                    self.sync({
                        partial: true,
                        changes: [{
                            method: "delete",
                            path: ["data", key]
                        },
                        {
                            method: "delete",
                            path: ["ttls", key]

                        }]
                    });
                    return fn();
                }, 0);
            }
            else
                return fn(new errors.ENOKEY());
        }
        else if(!_.isUndefined(this.praetor.get_controlling_leader())){
            var leader = this.praetor.get_controlling_leader();
            var client = new net.Socket();

            client.connect(leader.management_port, leader.address[this.scope], function(){
                client.write(["DELETE", key].join(" "));
                client.write(constants.message.DELIMITER);
            });

            client.on("error", function(err){
                return fn(err);
            });

            client.on("data", function(data){
                client.destroy();

                data = data.toString().split(constants.message.DELIMITER)[0];

                if(_.isEmpty(data))
                    return fn();

                try{
                    return fn(new errors.EFAILEDPROXY(JSON.parse(data).error));
                }
                catch(err){
                    return fn(err);
                }
            });
        }
        else
            return fn(new errors.ENOLEADER());
    },

    flush: function(fn){
        var self = this;

        if(this.praetor.is_controlling_leader()){
            setTimeout(function(){
                self.data = {};
                self.ttls = {};
                _.each(self.timers, function(timer){
                    clearTimeout(timer);
                });
                self.timers = {};
                self.sync();
                return fn();
            }, 0);
        }
        else if(!_.isUndefined(this.praetor.get_controlling_leader())){
            var leader = this.praetor.get_controlling_leader();
            var client = new net.Socket();

            client.connect(leader.management_port, leader.address[this.scope], function(){
                client.write("FLUSH");
                client.write(constants.message.DELIMITER);
            });

            client.on("error", function(err){
                return fn(err);
            });

            client.on("data", function(data){
                client.destroy();

                data = data.toString().split(constants.message.DELIMITER)[0];

                if(_.isEmpty(data))
                    return fn();

                try{
                    return fn(new errors.EFAILEDPROXY(JSON.parse(data).error));
                }
                catch(err){
                    return fn(err);
                }
            });
        }
        else
            return fn(new errors.ENOLEADER());
    },

    ttl: function(key, ttl, fn){
        if(!_.has(this.data, key))
            return fn(new errors.ENOKEY());

        if(_.isUndefined(ttl) || (_.isArray(ttl) && _.isEmpty(ttl))){
            if(_.has(this.ttls, key)){
                var remaining = this.ttls[key].duration - (new Date().valueOf() - this.ttls[key].start);
                return fn(null, {
                    ttl: remaining > 0 ? remaining : 0
                });
            }
            else
                return fn(null, {ttl: -1});
        }
        else{
            var self = this;

            if(_.isArray(ttl))
                ttl = _.first(ttl);

            if(this.praetor.is_controlling_leader()){
                if(_.has(this.timers, key))
                    clearTimeout(this.timers[key]);

                if(ttl == "-1"){
                    setTimeout(function(){
                        delete this.ttls[key];
                        delete this.timers[key];
                        self.sync({
                            partial: true,
                            changes: [{
                                method: "delete",
                                path: ["ttls", key]
                            }]
                        });
                        return fn();
                    }, 0);
                }

                this.ttls[key] = {
                    start: new Date().valueOf(),
                    duration: ttl
                }

                this.timers[key] = setTimeout(function(){
                    delete self.data[key];
                    delete self.ttls[key];
                    delete self.timers[key];
                    self.sync({
                        partial: true,
                        changes: [{
                            method: "delete",
                            path: ["data", key]
                        },
                        {
                            method: "delete",
                            path: ["ttls", key]
                        }]
                    });
                }, ttl);

                setTimeout(function(){
                    self.sync({
                        partial: true,
                        changes: [{
                            method: "update",
                            path: ["ttls", key],
                            value: self.ttls[key]
                        }]
                    });
                    return fn();
                }, 0);
            }
            else if(!_.isUndefined(this.praetor.get_controlling_leader())){
                var leader = this.praetor.get_controlling_leader();
                var client = new net.Socket();

                client.connect(leader.management_port, leader.address[this.scope], function(){
                    client.write(["TTL", key, ttl].join(" "));
                    client.write(constants.message.DELIMITER);
                });

                client.on("error", function(err){
                    return fn(err);
                });

                client.on("data", function(data){
                    client.destroy();

                    data = data.toString().split(constants.message.DELIMITER)[0];

                    if(_.isEmpty(data))
                        return fn();

                    try{
                        return fn(new errors.EFAILEDPROXY(JSON.parse(data).error));
                    }
                    catch(err){
                        return fn(err);
                    }
                });
            }
            else
                return fn(new errors.ENOLEADER());
        }
    },

    sync: function(options){
        var self = this;

        var write_log = function(options){
            if(_.isUndefined(options.recipients))
                logger.log("verbose", ["Sending", options.event, "to cluster"].join(" "));
            else{
                _.each(options.recipients, function(recipient){
                    logger.log("verbose", ["Sending", options.event, "to", recipient && recipient.host_name].join(" "));
                });
            }
        }

        options = _.defaults(options || {}, {
            partial: false,
            coalesce: true,
            recipients: undefined
        });

        if(options.coalesce){
            if(!_.has(this.sync_options, "event"))
                this.sync_options.event = options.partial ? "myriad.sync.partial" : "myriad.sync.full";
            else if(!options.partial)
                this.sync_options.event = "myriad.sync.full";

            if(!_.has(this.sync_options, "data"))
                this.sync_options.data = {};

            if(this.sync_options.event == "myriad.sync.partial"){
                if(!_.has(this.sync_options.data, "changes"))
                    this.sync_options.data.changes = [];

                this.sync_options.data.changes = _.flatten([this.sync_options.data.changes, options.changes]);
            }
            else{
                this.sync_options.data = {
                    data: this.data,
                    ttls: this.ttls
                }
            }

            if(!_.has(this.sync_options.recipients, "recipients"))
                this.sync_options.recipients = options.recipients;
            else if(_.isUndefined(options.recipients))
                this.sync_options.recipients = options.recipients;
            else if(!_.isUndefined(this.sync_options.recipients))
                this.sync_options.recipients = _.flatten([this.sync_options.recipients, options.recipients]);

            if(this.sync_ready && this.praetor.is_controlling_leader()){
                self.sync_ready = false;

                setTimeout(function(){
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
        else{
            setTimeout(function(){
                if(options.partial){
                    var sync_options = {
                        event: "myriad.sync.partial",
                        data: options.changes
                    }
                }
                else{
                    var sync_options = {
                        event: "myriad.sync.full",
                        data: {
                            data: self.data,
                            ttls: self.ttls
                        }
                    }
                }

                self.praetor.legiond.send(sync_options, options.recipients);

                self.praetor.legiond.set_attributes({
                    last_sync: new Date().valueOf()
                });

                write_log({
                    recipients: options.recipients,
                    event: sync_options.event
                });
            }, 0);
        }
    }

}

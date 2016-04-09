var fs = require("fs");
var _ = require("lodash");
var msgpack = require("msgpack-js");

function Disk(options){
    _.defaults(options, {
        data_directory: "/data",
        snapshot_name: "snapshot"
    });

    this.options = options;
}

Disk.prototype.bootstrap = function(fn){
    var self = this;

    fs.readFile([this.options.data_directory, this.options.snapshot_name].join("/"), function(err, data){
        if(err && err.code == "ENOENT"){
            fs.writeFile([self.options.data_directory, self.options.snapshot_name].join("/"), "", function(err, data){
                if(err)
                    return fn(err);
                else
                    return fn(null, {});
            });
        }
        else if(err)
            return fn(err);
        else if(_.isEmpty(data.toString()))
            return fn(null, {});
        else
            return fn(null, msgpack.decode(data));
    });
}

Disk.prototype.snapshot = function(data, fn){
    fs.writeFile([this.options.data_directory, this.options.snapshot_name].join("/"), msgpack.encode(data), fn);
}

module.exports = Disk;

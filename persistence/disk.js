'use strict';

const _ = require('lodash');
const fs = require('fs');
const msgpack = require('msgpack-js');

class Disk {
    constructor(options) {
        options = options || {};
        this.options = _.defaults(options, {
            data_directory: '/data',
            snapshot_name: 'snapshot'
        });

        this.options.snapshot_path = `${this.options.data_directory}/${this.options.snapshot_name}`;
    }

    bootstrap(fn) {
        fs.readFile(this.options.snapshot_path, (err, data) => {
            if(err && err.code == 'ENOENT') {
                fs.writeFile(this.options.snapshot_path, '', (err) => {
                    if(err) {
                        return fn(err);
                    }

                    return fn(null, {});
                });
            } else if(err) {
                return fn(err);
            } else if(_.isEmpty(data.toString())) {
                return fn(null, {});
            } else {
                return fn(null, msgpack.decode(data));
            }
        });
    }

    snapshot(data, fn) {
        fs.writeFile(this.options.snapshot_path, msgpack.encode(data), fn);
    }
}
module.exports = Disk;

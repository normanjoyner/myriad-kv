'use strict';

const _ = require('lodash');

module.exports = {
    get_object_size: (object) => {
        let bytes = 0;

        const sizeOf = (obj) => {
            if(obj !== null && obj !== undefined) {
                switch(typeof obj) {
                case 'number': {
                    bytes += 8;
                    break;
                }
                case 'string': {
                    bytes += obj.length * 2;
                    break;
                }
                case 'boolean': {
                    bytes += 4;
                    break;
                }
                case 'object': {
                    const objClass = Object.prototype.toString.call(obj).slice(8, -1);

                    if(objClass === 'Object' || objClass === 'Array') {
                        for(var key in obj) {
                            if(!obj.hasOwnProperty(key)) {
                                continue;
                            }

                            sizeOf(obj[key]);
                        }
                    } else {
                        bytes += obj.toString().length * 2;
                    }

                    break;
                }
                }
            }

            return bytes;
        };

        return sizeOf(object);
    },

    apply_object_changes: (persistence, changes) => {
        _.each(changes, (change) => {
            let key = persistence;

            _.each(_.initial(change.path), (path) => {
                key = key[path];
            });

            if(change.method == 'update') {
                key[_.last(change.path)] = change.value;
            } else if(change.method == 'delete') {
                delete key[_.last(change.path)];
            }
        });
    }

};

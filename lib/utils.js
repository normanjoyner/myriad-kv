var _ = require("lodash");

module.exports = {
    get_object_size: function(object){
        var bytes = 0;

        function sizeOf(obj) {
            if(obj !== null && obj !== undefined) {
                switch(typeof obj) {
                case 'number':
                    bytes += 8;
                    break;
                case 'string':
                    bytes += obj.length * 2;
                    break;
                case 'boolean':
                    bytes += 4;
                    break;
                case 'object':
                    var objClass = Object.prototype.toString.call(obj).slice(8, -1);
                    if(objClass === 'Object' || objClass === 'Array') {
                        for(var key in obj) {
                            if(!obj.hasOwnProperty(key)) continue;
                            sizeOf(obj[key]);
                        }
                    } else bytes += obj.toString().length * 2;
                    break;
                }
            }
            return bytes;
        }

        return sizeOf(object);
    },

    apply_object_changes: function(persistence, changes){
        _.each(changes, function(change){
            var key = persistence;
            _.each(_.initial(change.path), function(path){
                key = key[path];
            });

            if(change.method == "update")
                key[_.last(change.path)] = change.value;
            else if(change.method == "delete")
                delete key[_.last(change.path)];
        });
    }

}

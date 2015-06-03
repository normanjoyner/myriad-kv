var logger = require([__dirname, "logger"].join("/"));


module.exports = {

    initialize: function(legiond){
        this.legiond = legiond;
    },

    set: function(state){
        var new_state = state || "unknown";
        logger.log("verbose", ["Entered", new_state, "state"].join(" "));
        this.legiond.set_attributes({
            state: new_state
        });
    },

    BOOTING: "booting",

    CLUSTERING: "clustering",

    RECOVERING: "recovering",

    OPERATIONAL: "operational"

}

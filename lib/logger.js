var _ = require("lodash");
var winston = require("winston");

module.exports = {

    initialize: function(logger){
        if(_.isUndefined(logger)){
            this.logger = new (winston.Logger)({
                transports: [
                    new (winston.transports.Console)({
                        colorize: true,
                        level: process.env.LOG_LEVEL || "info"
                    })
                ]
            });
        }
        else
            this.logger = logger;
    },

    log: function(level, message){
        if(_.isUndefined(this.logger))
            return;

        this.logger.log(level, message);
    }

}

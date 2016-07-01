'use strict';

const logger = require('./logger');

module.exports = {

    initialize: (legiond) => {
        this.legiond = legiond;
    },

    set: (state) => {
        const new_state = state || 'unknown';
        logger.log('verbose', `Entered ${new_state} state`);

        this.legiond.set_attributes({
            state: new_state
        });
    },

    BOOTING: 'booting',

    CLUSTERING: 'clustering',

    RECOVERING: 'recovering',

    OPERATIONAL: 'operational'

};

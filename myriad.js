#!/usr/bin/env node
'use strict';

const Myriad = require('./application');

const options = {
    leader_eligible: true,
    legiond: {
        network: {
            port: process.env.MYRIAD_PORT,
            cidr: process.env.MYRIAD_CIDR ? process.env.MYRIAD_CIDR.split(',') : [],
            public: process.env.MYRIAD_PUBLIC
        },
        attributes: {
            management_port: process.env.MYRIAD_MANAGEMENT_PORT
        }
    },
    persistence: {
        max_coalescing_duration: process.env.MYRIAD_MAX_COALESCING_DURATION,
        data_directory: process.env.MYRIAD_DATA_DIRECTORY,
        snapshot_name: process.env.MYRIAD_SNAPSHOT_NAME
    },
    standalone: true
};

const myriad = new Myriad(options);
myriad.listen(() => {
    /* myriad is listening */
});

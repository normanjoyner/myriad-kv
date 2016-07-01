#!/usr/bin/env node
'use strict';

const dns = require('native-dns');

const question = dns.Question({
    name: `followers.${process.env.CS_CLUSTER_ID}.containership`,
    type: 'A'
});

const req = dns.Request({
    question: question,
    server: {
        address: '127.0.0.1',
        port: 53,
        type: 'udp'
    },
    timeout: 2000
});

req.on('timeout', () => {
    process.stderr.write(`DNS timeout when resolving ${question.name}`);
    process.exit(1);
});

req.on('message', (err, answer) => {
    const addresses = [];

    answer.answer.forEach((answer) => {
        addresses.push(`${answer.address}/32`);
    });

    process.env.MYRIAD_CIDR = addresses.join(',');
    require('../myriad');
});

req.send();

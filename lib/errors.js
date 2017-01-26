'use strict';

function EINSUFFINFO() {
    Error.captureStackTrace(this.constructor);
    this.name = this.constructor.name;
    this.message = 'Not enough information provided to complete request!';
}

function ENOLEADER() {
    Error.captureStackTrace(this.constructor);
    this.name = this.constructor.name;
    this.message = 'No controlling leader node found!';
}

function ENOKEY() {
    Error.captureStackTrace(this.constructor);
    this.name = this.constructor.name;
    this.message = 'Requested key not found!';
}

function EFAILEDPROXY(message) {
    Error.captureStackTrace(this.constructor);
    this.name = this.constructor.name;
    this.message = message || 'Failed to proxy command to controlling leader node!';
}

function EEXISTS(message) {
    Error.captureStackTrace(this.constructor);
    this.name = this.constructor.name;
    this.message = message || 'The requested key already exists!';
}

module.exports = {
    'EINSUFFINFO': EINSUFFINFO,
    'ENOLEADER': ENOLEADER,
    'ENOKEY': ENOKEY,
    'EFAILEDPROXY': EFAILEDPROXY,
    'EEXISTS': EEXISTS
};

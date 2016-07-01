'use strict';

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

module.exports = {
    'ENOLEADER': ENOLEADER,
    'ENOKEY': ENOKEY,
    'EFAILEDPROXY': EFAILEDPROXY
};

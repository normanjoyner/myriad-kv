![myriad logo](http://content.containership.io/hubfs/myriad-horizontal.svg)

## About

### Build Status
[![Build Status](https://drone.containership.io/api/badges/containership/myriad-kv/status.svg)](https://drone.containership.io/containership/myriad-kv)

### Description
A distributed key-value store built on top of [praetor](https://github.com/containership/praetor) and [legiond](https://github.com/containership/legiond)

### Author
ContainerShip Developers - developers@containership.io

## Modes
myriad-kv can be run in either standalone or embedded mode.

### Standalone
In standalone mode, myriad-kv cannot be required from another module directly. All communication must happen over TCP on the given management port.

myriad-kv can be globally installed to be run in standalone mode
```
npm install -g myriad-kv
```

The following optional environment variables can be set to configure myriad-kv:

* `MYRIAD_MANAGEMENT_PORT` - management port to which client issues commands
* `MYRIAD_PORT` - port internode communication will happen on
* `MYRIAD_CIDR` - CIDR range to search for other myriad-kv nodes
* `MYRIAD_PUBLIC` - forces myriad-kv to listen on 0.0.0.0 and communicate over the public network
* `MYRIAD_DATA_DIRECTORY` - path to directory where myriad-kv snapshot will live
* `MYRIAD_SNAPSHOT_NAME` - name of snapshot file
* `MYRIAD_MAX_COALESCING_DURATION` - duration of period where messages are coalesced before sending

Starting myriad-kv is as simple as running `myriad` with any desired environment variables set.

### Embedded
In embedded mode, myriad-kv is required and instantiated from another node module. Commands can be issued by direct nodejs calls to the API, or over TCP. Issuing calls directly to the embedded API, and avoiding the TCP stack, will result in significant performance benefits.

Include the myriad-kv dependency in your project to run in embedded mode

```
npm install myriad-kv
```

Optionally configure myriad-kv by contructing an options object similar to the one below. These configuration parameters are explained above.

```javascript
var options = {
    legiond: {
        network: {
            port: process.env.MYRIAD_PORT,
            cidr: process.env.MYRIAD_CIDR,
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
    }
}
```

To start using myriad-kv in your code simply instantiate, configure and start listening:

```javascript
var Myriad = require("myriad-kv");

var options = {
    legiond: {
        network: {
            cidr: "10.0.10.0/24"
        }
    },
    persistence: {
        data_directory: "/tmp"
    }
}

var myriad = new Myriad(options);
myriad.listen(function(){});
```

## Commands

Below are examples of all commands that can be issued over TCP

### KEYS

Get all keys
```
KEYS
["a::b::c","a::b::d"]
```

Get keys matching a specific pattern
```
KEYS a::[a-z]::d
["a::b::d"]
```

### GET

Get a specific key
```
GET a::b::c
abc
```

### SET

Set a key
```
SET a::b::a aba

```

### TTL

Retrieve the ttl for a key
```
TTL a::b::a
{"ttl":-1}
```

Set the ttl for a key (in ms)
```
TTL a::b::a 10000

```

### DELETE

Delete a key
```
DELETE a::b::c

```

### FLUSH

Flushes all keys from the store
```
FLUSH

```

## Contributing
Pull requests and issues are encouraged!

# myriad-kv

## About

### Description
A distributed key-value store built on top of praetor and legiond

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

var myriad = new Myriad(options);
myriad.listen(function(){});
```

## Contributing
Pull requests and issues are encouraged!

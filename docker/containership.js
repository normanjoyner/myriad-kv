#!/usr/bin/env node
var dns = require("native-dns");

var question = dns.Question({
  name: ["followers", process.env.CS_CLUSTER_ID, "containership"].join("."),
  type: "A"
});

var req = dns.Request({
    question: question,
    server: { address: "127.0.0.1", port: 53, type: "udp" },
    timeout: 2000
});

req.on("timeout", function(){
    process.stderr.write(["DNS timeout when resolving", question.name].join(" "));
    process.exit(1);
});

req.on("message", function (err, answer) {
    var addresses = [];
    answer.answer.forEach(function(a){
        addresses.push([a.address, "32"].join("/"));
    });

    process.env.MYRIAD_CIDR = addresses.join(",");
    require([__dirname, "..", "myriad"].join("/"));
});

req.send();

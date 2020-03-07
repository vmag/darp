"use strict";
exports.__esModule = true;
//
//  wireguard.ts - configure wireguard conf file in wireguard as darp.pending.conf
//
var pulseRedis = require('redis');
var redisClient = pulseRedis.createClient(); //creates a new client
function setWireguard() {
    //we assume these file were set by configWG
    var BASECONFIG;
    try {
        BASECONFIG = require('fs').readFileSync('/etc/wireguard/wg0.conf', 'utf8');
    }
    catch (err) {
        BASECONFIG = "deadbeef00deadbeef00deadbeef0012";
    }
    //# Created by ./configWG.bash Fri Mar 6 20:46:57 UTC 2020
    //[Interface]
    //PrivateKey = CPEQ3Q4tv6MXHhbQEyfw3VdJP5QzBihe4B41ocAm9UE=
    var PUBLICKEY;
    try {
        PUBLICKEY = require('fs').readFileSync('/etc/wireguard/publickey', 'utf8');
    }
    catch (err) {
        PUBLICKEY = "deadbeef00deadbeef00deadbeef0012";
    }
    //for each group in me.pulseGroups
    redisClient.hget("me", "pulseGroups", function (err, pulseGroups) {
        console.log("pulseGroups=" + pulseGroups);
        var config = ""; // we will add this to the base wireguard config
        var ary = pulseGroups.split(" ");
        for (var i = 0; i < ary.length; i++) {
            var group = ary[i];
            //  for each mint in group.mints
            console.log("getting mints for group=" + group);
            redisClient.lrange(group + ".mints", 0, -1, function (err, mints) {
                console.log("found mints=" + mints);
                //if (mintAry!=null) {
                console.log("mints=" + JSON.stringify(mints, null, 2));
                //var mintAry=mints.split(",");
                for (var j = 0; j < mints.length; j++) {
                    var mint = mints[j];
                    // find mint:publickey:ipaddr:port for wireguard stanze
                    console.log("Writing stanza for mint=" + mint);
                    redisClient.hgetall("mint:" + mint, function (err, mintTableEntry) {
                        console.log("mintTableEntry =" + JSON.stringify(mintTableEntry, null, 2));
                        config += "/n[Peer]/n";
                        config += "PublicKey = " + mintTableEntry.publickey + "/n";
                        config += "AllowedIPs = 10.10.0." + mintTableEntry.mint + "/n";
                        config += "Endpoint = " + mintTableEntry.ipaddr;
                        config += "PersistentKeepalive = 25" + "/n";
                        /***
                                                "mint" : ""+newMint,
                                                "geo" : me.geo,
                                                "ipaddr" : incomingIP,
                                                "port" : ""+me.port,
                                                "publickey" : ""+me.publickey,
                                                "wallet" : ""+me.wallet
                        **/
                        /**
                                                converted to
                                                #PulseGroup Peer devops
                        [Peer]
                        PublicKey = ziIzC9q6qnbAuhMz3S96GCITbmsb4rZbN7MRYWfow3o=
                        AllowedIPs = 10.10.0.3/32
                        Endpoint = 71.202.2.184:80
                        PersistentKeepalive = 25
                        
                        */
                    });
                }
                //}
            });
        }
        //write wireguard config to /etc/wireguard/darp.pending.conf for installation outside the docker
        console.log("Generated wireguard config: " + BASECONFIG + config);
    });
}
exports.setWireguard = setWireguard;
setWireguard();

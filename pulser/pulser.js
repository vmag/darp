"use strict";
exports.__esModule = true;
var lib_1 = require("../lib/lib");
//
//  pulse - send my owl measurements to my pulseGroups
//
//var HOST='127.0.0.1';
var dgram = require('dgram');
var message = new Buffer('message pulseGoesHere');
var networkClient = dgram.createSocket('udp4');
var pulseRedis = require('redis');
var redisClient = pulseRedis.createClient(); //creates a new client
pulse();
function pulse() {
    var datagramClient = dgram.createSocket('udp4');
    redisClient.hget('me', 'lastSeq', function (err, lastSeq) {
        lastSeq = parseInt(lastSeq);
        console.log(lastSeq);
        redisClient.hset('me', 'lastSeq', "" + (lastSeq + 1));
        redisClient.hgetall("me", function (err, me) {
            if (err) {
                console.log("hgetall me failed");
            }
            else {
                //console.log("me="+JSON.stringify(me,null,2));
                //  MAZORE.1 MAZDAL.1
                console.log("pulsing pulsegroup: " + me.pulseGroups);
                var pulseGroups = me.pulseGroups.split(" ");
                for (var PG in pulseGroups) {
                    var pulseGroup = pulseGroups[PG];
                    var pulseGroupOwner = pulseGroup.split(".")[0];
                    var ownerPulseLabel = pulseGroupOwner + ":" + pulseGroup;
                    var pulseSrc = me.geo;
                    //make a pulse message
                    console.log("pulse(): Make a pulse Message, pulseGroup=" + pulseGroup);
                    //I am pulsing my measurement from others
                    //in the format OWL:MAZORE:MAZORE.1=1:2-1=23,3-1=46
                    var pulseMessage = "OWL" + lastSeq + "," + lib_1.now() + "," + me.geo + ":" + pulseGroup + "="; //MAZORE:MAZJAP.1
                    //
                    //  assume the handlePulse routine will store the data into the MAZORE.1.owls object
                    //                MAZORE.1 contains a list of mint:owl tuples
                    //
                    redisClient.hgetall(pulseGroup, function (err, mints) {
                        if (err) {
                            console.log("couldn't find any mints for " + pulseGroup);
                        }
                        else {
                            var virgin = 1;
                            console.log("make my pulse message from these mints=" + lib_1.dump(mints));
                            //for each mint in the group, fetch the PEER-ME : OWL
                            for (var mint in mints) {
                                var owl = mints[mint];
                                var srcMint = mint.split(">")[0];
                                var dstMint = mint.split(">")[1];
                                console.log("srcMint=" + srcMint + " dstMint=" + dstMint + " owl=" + owl + " mint=" + mint + " mints=" + lib_1.dump(mints));
                                if (srcMint != me.mint) {
                                    if (virgin)
                                        virgin = 0;
                                    else
                                        pulseMessage += ",";
                                    pulseMessage += mint + "=" + owl;
                                    //var owlLabel=entry+"-"+me.mint;  //src to me
                                    console.log("");
                                    console.log("send this pulseMessage=" + pulseMessage);
                                    redisClient.hgetall("mint:" + srcMint, function (err, mintTableEntry) {
                                        console.log("mintTableEntry=" + lib_1.dump(mintTableEntry));
                                        var PORT = mintTableEntry.port;
                                        var HOST = mintTableEntry.ipaddr;
                                        networkClient.send(pulseMessage, 0, pulseMessage.length, PORT, HOST, function (err, bytes) {
                                            if (err)
                                                throw err;
                                            console.log('UDP message sent to ' + HOST + ':' + PORT);
                                        });
                                    });
                                }
                            }
                        }
                    });
                    //for eah mint, get mintTable entry   <pulseGroup>.workingOWLs   
                    // handlepulse stores all OWLS here: (MAZORE.1.workingOWLs = 2-1: 23 3-1: 43 2-3: 43 ... )
                }
            }
        });
    });
    datagramClient.close();
}
//
//  iterator through each mint of a pulseGroup
//
function forEachMint(pulseGroup, callback) {
    console.log("forEachMint() : pulseGroup=" + pulseGroup);
    //fetch the group mints mint:2 : 2  mint:5 : 5   ....
    redisClient.hgetall(pulseGroup, function (err, pulseGroupNodes) {
        console.log("insideIterator");
        if (err) {
            console.log("forEachMint(): hgetall pulseGroup mints " + pulseGroupNodes + " failed");
        }
        else {
            console.log("forEachMint(): *** ** ** pulseGroupNodes=" + lib_1.dump(pulseGroupNodes));
            for (var mintKey in pulseGroupNodes) { //mint:1  mint:2  mint:3
                console.log("forEachMint(): **** pulser mintKey=" + mintKey);
                redisClient.hgetall(mintKey, function (err, mintKey) {
                    if (err) {
                        console.log("forEachMint(): hgetall mintKey " + mintKey + " failed");
                    }
                    else {
                        callback(mintKey); //callback may fetch mint table
                    }
                });
            }
        }
    });
    //setTimeout(pulse,3000); //pulse again in 3 seconds
}
/*
function makePulse(groupEntry,owls) {
  console.log("groupEntry="+groupEntry+" owls="+owls);
  var seqNum="1"; //fetch the from pulseGroupTable MazORE.1 seqNum:

  var d = new Date();
  var now=d.getTime();
  var srcNode="1";

  //var pulse="0:"+seqNum+":"+now+":"+myMint+":"+groupEntry;
  var pulse="OWL:"+seqNum+":"+now+":"+me.geo+":"+groupEntry+":"+"2:1:23,3:1:243"  //MAZORE:MAZJAP.1
//OWL:MAZORE:MAZORE.1:1:2-1=23,3-1=46

  for (var owl in owls) {
    //console.log("owl="+owl+"="+owls[owl]);
    var owlMeasurement=owl.split(":");

    if (owlMeasurement.length==3) {
      // for each node in pulseGroup, send pulseMessage
      var group=owlMeasurement[0];
      var srcMint=parseInt(owlMeasurement[1]);
      var dstMint=parseInt(owlMeasurement[2]);
      //console.log("group="+group+" srcMint="+srcMint+" dstMint="+dstMint);
      if (dstMint==me.mint) pulse+=":"+srcMint+":"+owls[owl];
    }
  }
  return pulse;
}

*/

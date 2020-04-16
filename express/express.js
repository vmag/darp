"use strict";
//
// express.ts - set up the "me" and connect to the network by getting config from the genesis node
//
// incoming environmental variables:
//    GENESIS - IP of Genesis node
//    MYIP - my measured IP address
//    DARPDIR - where the code and config reside
//    VERSION - of software running
//    HOSTNAME - human readable text name - we use this for "geo"
//    PUBLICKEY - Public key 
//
exports.__esModule = true;
var lib_1 = require("../lib/lib");
var expressRedis = require('redis');
var expressRedisClient = expressRedis.createClient(); //creates a new client
var express = require('express');
var app = express();
var CYCLETIME = 5; //Seconds between system poll
var POLLFREQ = CYCLETIME * 1000; //how often to send pulse
var REFRESHPAGETIME = CYCLETIME; //how often to refresh instrumentation web page
//
//      handleShowState(req,res) - show the node state
//
function handleShowState(req, res) {
    var dateTime = new Date();
    var txt = '<meta http-equiv="refresh" content="' + REFRESHPAGETIME + '">';
    if (CYCLETIME < 5)
        txt = '<meta http-equiv="refresh" content="' + 5 + '">';
    expressRedisClient.hgetall("mint:0", function (err, me) {
        if (me.state == "HOLD")
            txt = '<meta http-equiv="refresh" content="' + 15 + '">';
        txt += '<html><head>';
        txt += '<script> function startTime() { var today = new Date(); var h = today.getHours(); var m = today.getMinutes(); var s = today.getSeconds(); m = checkTime(m); s = checkTime(s); document.getElementById(\'txt\').innerHTML = h + ":" + m + ":" + s; var t = setTimeout(startTime, 500); } function checkTime(i) { if (i < 10) {i = "0" + i};  return i; } </script>';
        txt += '<link rel = "stylesheet" type = "text/css" href = "http://drpeering.com/noia.css" /></head>';
        txt += '<body>';
        var insert = "";
        expressRedisClient.hgetall("mint:1", function (err, genesis) {
            if (me.isGenesisNode) {
                //console.log(ts()+"handleShowState() ***** GENESIS");
                insert = 'style="background-color: beige;"';
            }
            txt += '<body onload="startTime()" ' + insert + '>';
            if (me.isGenesisNode)
                txt += '<H2>GENESIS NODE : ' + me.geo + '</H2><BR>';
            txt += '<H2 class="title">';
            txt += 'Layer #' + me.layer + ' : </h2><h1> ' + me.geo + " </h1><h2> : " + me.ipaddr + "</H2>";
            if (!me.isGenesisNode)
                txt += ' under Genesis Node: <a href="http://' + genesis.geo + ":" + genesis.group + '">' + genesis.geo + ":" + genesis.group + "</a>";
            txt += "<H2>Polling every=" + POLLFREQ / 1000 + " seconds</H2>";
            txt += "<H2> with pulseMsgSize=" + me.statsPulseMessageLength + "</H2>";
            //if (JOINOK) txt+='<H2> <  JOINOK  > </H2>';
            //else txt+='<H2>*** NOT JOINOK ***</H2>';
            txt += '<H2> STATE: ' + me.state + ' </H2>';
            if (me.state == "HOLD")
                txt += "<p>Hit %R to RELOAD PAGE DURING HOLD MODE</p>";
            //txt += ' under Genesis Node: <a href="http://'+me.Genesis.split(":")[0]+":"+me.Genesis.split(":")[1]+'">'+me.Genesis.split(":")[0]+":"+me.Genesis.split(":")[1]+"</a>";
            txt += '<div class="right"><p>.......refreshed at ' + dateTime + "</p></div>";
            expressRedisClient.hgetall("gSRlist", function (err, gSRlist) {
                if (err)
                    console.log("gSRlist error");
                //txt+=dump(gSRlist);
                var lastEntry = "";
                for (var entry in gSRlist)
                    lastEntry = entry;
                //console.log("lastEntry="+lastEntry);
                txt += '<table class="gSRlist" border="1">';
                txt += "<th>srcMint</th><th>State</th><th>NodeName</th><th>pulseGroup</th><th>IP Address</th><th>Port #</th><th>publickey</th><th>lastSeq#</th><th>inMsgs</th><th>inOctets</th><th>OWL</th><th>outMsgs</th><th>outOctets</th><th>pktDrops</th><th>....</th><th>bootTime</th><th>pulseTimestamp</th>";
                for (var entry in gSRlist) {
                    console.log("gSRlist entry=" + lib_1.dump(entry));
                    expressRedisClient.hgetall(entry, function (err, pulseEntry) {
                        txt += "<tr>";
                        //txt+="<p>"+mintEntry.mint+":"+mintEntry.geo+":"+mintEntry.group+"</p>";
                        console.log("pulseEntry=" + lib_1.dump(pulseEntry));
                        expressRedisClient.hgetall("mint:" + pulseEntry.srcMint, function (err, mintEntry) {
                            console.log("mintEntry=" + lib_1.dump(mintEntry));
                            txt += '<tr class="color' + pulseEntry.group + " " + pulseEntry.geo + ' ' + "INIT" + '">';
                            txt += "<td>" + mintEntry.mint + "</td>";
                            txt += "<td>" + mintEntry.state + "</td>";
                            txt += '<td>' + '<a href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/" target="_blank">' + mintEntry.geo + '</a></td>';
                            txt += '<td><a href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/groups" target="_blank">' + pulseEntry.group + "</a></td>";
                            txt += "<td>" + mintEntry.ipaddr + "</td>";
                            txt += "<td>" + '<a href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/state" target="_blank">' + mintEntry.port + "</a></td>";
                            txt += "<td>" + mintEntry.publickey.substring(0, 3) + "..." + mintEntry.publickey.substring(mintEntry.publickey.length - 4) + "</td>";
                            txt += "<td>" + pulseEntry.seq + "</td>";
                            txt += "<td>" + pulseEntry.inMsgs + "</td>";
                            txt += "<td>" + pulseEntry.inOctets + "</td>";
                            var pulseGroupOwner = pulseEntry.group.split(".")[0];
                            //if ( (entry.geo!='GENESIS') && (entry.owl==0) && (entry.geo!=me.geo))  txt += '<td class="alert" bgcolor="#909090">' + '<a href="http://' + me.ipaddr + ':' + entry.port + '/graph?dst=' + me.geo + '&src=' + entry.geo + "&group=" + group + '" target="_blank">' + entry.owl + "</a></td>";
                            txt += "<td>" + '<a href="http://' + me.ipaddr + ':' + pulseEntry.port + '/graph?dst=' + me.geo + '&src=' + pulseEntry.geo + "&group=" + pulseEntry.group + '" target="_blank">' + pulseEntry.owl + "</a></td>";
                            txt += "<td>" + pulseEntry.outMsgs + "</td>";
                            txt += "<td>" + pulseEntry.outOctets + "</td>";
                            txt += "<td>" + pulseEntry.pktDrops + "</td>";
                            var stopButtonURL = "http://" + mintEntry.ipaddr + ":" + mintEntry.port + "/stop";
                            var rebootButtonURL = "http://" + mintEntry.ipaddr + ":" + mintEntry.port + "/reboot";
                            var reloadButtonURL = "http://" + mintEntry.ipaddr + ":" + mintEntry.port + "/reload";
                            var holdButtonURL = "http://" + mintEntry.ipaddr + ":" + mintEntry.port + "/hold";
                            var pulseMsgButtonURL = "http://" + mintEntry.ipaddr + ":" + mintEntry.port + "/pulseMsg";
                            txt += "<td>" + '<FORM>';
                            txt += '<INPUT Type="BUTTON" Value="PULSE1" Onclick="window.location.href=\'' + pulseMsgButtonURL + "'" + '">';
                            txt += '<INPUT Type="BUTTON" Value="RELOAD" Onclick="window.location.href=\'' + reloadButtonURL + "'" + '">';
                            txt += '<INPUT Type="BUTTON" Value="HOLD" Onclick="window.location.href=\'' + holdButtonURL + "'" + '">';
                            txt += '<INPUT Type="BUTTON" Value="STOP" Onclick="window.location.href=\'' + stopButtonURL + "'" + '">';
                            txt += '<INPUT Type="BUTTON" Value="REBOOT" Onclick="window.location.href=\'' + rebootButtonURL + "'" + '">';
                            txt += '<FORM>' + "</td>";
                            console.log(lib_1.ts() + "mintEntry.bootTime=" + mintEntry.bootTime);
                            var delta = Math.round((lib_1.now() - mintEntry.bootTime) / 1000) + " secs ago";
                            if (mintEntry.bootTime == 0)
                                delta = "";
                            txt += "<td>" + delta + "</td>";
                            //txt += "<td>" + entry.bootTime+ "</td>";
                            var deltaSeconds = Math.round((lib_1.now() - pulseEntry.pulseTimestamp) / 1000) + " secs ago";
                            if (pulseEntry.pulseTimestamp == 0)
                                deltaSeconds = "";
                            //txt += "<td>" + now()+" "+entry.pulseTimestamp+ "</td>";
                            txt += "<td>" + deltaSeconds + "</td>";
                            txt += "</tr>";
                            if (pulseEntry.geo + ":" + pulseEntry.group == lastEntry) {
                                txt += "</table>";
                                //console.log(ts()+"READY TO DUMP HTML: "+txt);
                                txt += "</body></html>";
                                res.setHeader('Content-Type', 'text/html');
                                res.setHeader("Access-Control-Allow-Origin", "*");
                                res.end(txt);
                            }
                            //expressRedisClient.hgetall(entry, function (err,pulseEntry) {
                            // txt+=pulseEntry.geo+":"+pulseEntry.group;
                            //console.log("mintEntry="+dump(mintEntry));
                            //});
                        });
                    });
                }
                /*         gSRlist.forEachGroup(function (groupEntry) {
                           //console.log(ts()+"handleShowState(): groupEntry.group="+groupEntry.group);
                           if (groupEntry.owner!="GENESIS")
                                   txt+=externalizeGroup(groupEntry);
                         });
                
                         gSRlist.forEachGenesisGroup(function (genesisGroupEntry) {
                           //console.log(ts()+"handleShowState(): Genesis Group owner="+genesisGroupEntry.owner);
                           //console.log(ts()+"handleShowState(): genesisGroupEntry="+dump(genesisGroupEntry));
                           txt+=externalizeGroupState(genesisGroupEntry);
                         });
                         */
            });
        });
    });
}
//
//
//
app.get('/state', function (req, res) {
    //console.log("fetching '/state'");
    //handleShowState(req, res);
    getConfig(function (config) {
        //console.log("app.get('/state' callback config="+dump(config));
        expressRedisClient.hgetall("mint:0", function (err, me) {
            config.mintTable["mint:0"] = me;
            //var html="<html>"
            res.setHeader('Content-Type', 'application/json');
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(JSON.stringify(config, null, 2));
            return;
        });
    });
});
//
//
//
app.get('/', function (req, res) {
    console.log("fetching '/' ");
    handleShowState(req, res);
    //   getConfig(function(config) {
    //      console.log("app.get('/' callback config="+dump(config));
    //      expressRedisClient.hgetall("mint:0", function(err, me) {
    //         config.mintTable["mint:0"]=me;
    //         var html="<html>"
    //         //res.end(JSON.stringify(config, null, 2));
    //      });
    //  })
    return;
});
//
//
//
app.get('/mint/:mint', function (req, res) {
    console.log("fetching '/mint' state");
    expressRedisClient.hgetall("mint:" + req.params.mint, function (err, mintEntry) {
        res.end(JSON.stringify(mintEntry, null, 2));
        return;
    });
});
app.get('/version', function (req, res) {
    //console.log("EXPRESS fetching '/version'");
    expressRedisClient.hget("mint:0", "version", function (err, version) {
        //console.log("version="+version);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify(version));
        return;
    });
});
app.get('/stop', function (req, res) {
    //console.log("EXPRess fetching '/state' state");
    console.log("EXITTING and Stopping the node");
    process.exit(86);
});
app.get('/reload', function (req, res) {
    //console.log("EXPRess fetching '/state' state");
    console.log("EXITTING to reload the system");
    expressRedisClient.hset("mint:0", "state", "RELOAD");
});
app.get('/state', function (req, res) {
    //console.log("EXPRess fetching '/state' state");
    getConfig(function (config) {
        //console.log("app.get('/state' callback config="+dump(config));
        res.setHeader('Content-Type', 'application/json');
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify(config, null, 2));
    });
    return;
});
//
//
//
function getConfig(callback) {
    //console.log("getConfig() ");
    expressRedisClient.hgetall("mint:0", function (err, me) {
        expressRedisClient.hgetall("gSRlist", function (err, gSRlist) {
            //console.log("gSRlist="+dump(gSRlist));
            fetchConfig(gSRlist, null, function (config) {
                //console.log("getConfig(): callback config="+dump(config));
                callback(config); //call sender
            });
        });
    });
}
//
//
//
function fetchConfig(gSRlist, config, callback) {
    if (typeof config == "undefined" || config == null) {
        //console.log(ts()+"fetchConfig(): STARTING ECHO: gSRlist="+dump(gSRlist)+" config="+dump(config)+" ");
        config = {
            gSRlist: gSRlist,
            mintTable: {},
            pulses: {},
            entryStack: new Array()
        };
        for (var index in gSRlist) {
            //console.log("pushing "+index);
            config.entryStack.push({ entryLabel: index, mint: gSRlist[index] });
        }
        //onsole.log("entryStack="+dump(config.entryStack));
    }
    //Whether first call or susequent, pop entries until pop fails
    var entry = config.entryStack.pop();
    //console.log("EXPRESS() popped entry="+dump(entry));
    if (entry) {
        var mint = entry.mint;
        var entryLabel = entry.entryLabel;
        expressRedisClient.hgetall("mint:" + mint, function (err, mintEntry) {
            if (err)
                console.log("ERROR: mintEntry=" + mintEntry);
            if (mintEntry)
                config.mintTable["mint:" + mint] = mintEntry; //set the pulseEntries
            //console.log("EXPRESS() mint="+mint+" mintEntry="+dump(mintEntry)+" config="+dump(config)+" entryLabel="+entryLabel);
            //                       MAZORE:DEVOPS.1
            expressRedisClient.hgetall(entryLabel, function (err, pulseEntry) {
                config.pulses[entryLabel] = pulseEntry; //set the corresponding mintTable
                //console.log("EXPRESS() RECURSING entryLabel="+entryLabel+" pulseEntry="+dump(pulseEntry)+" config="+dump(config));
                fetchConfig(gSRlist, config, callback); //recurse until we hit bottom
            });
        });
    }
    else {
        delete config.entryStack;
        callback(config); //send the config atructure back
    }
}
//
// 
//
app.get('/me', function (req, res) {
    //res.send('express root dir');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");
    expressRedisClient.hgetall("mint:0", function (err, me) {
        res.end(JSON.stringify(me, null, 3));
    });
    return;
});
//
//
//
app.get('/hold', function (req, res) {
    expressRedisClient.hmset("mint:0", {
        state: "HOLD"
    });
    console.log(lib_1.ts() + "HOLD HOLD HOLD HOLD state - ");
    console.log(lib_1.ts() + "HOLD HOLD HOLD HOLD state - ");
    console.log(lib_1.ts() + "HOLD HOLD HOLD HOLD state - ");
    console.log(lib_1.ts() + "HOLD HOLD HOLD HOLD state - ");
    console.log(lib_1.ts() + "HOLD HOLD HOLD HOLD state - ");
});
//
//
//
app.get('/pulseMsg', function (req, res) {
    expressRedisClient.hmset("mint:0", {
        state: "RUNNING"
    });
    console.log(lib_1.ts() + "pulsed - Now in RUNNING state");
});
//
// nodeFactory
//       Configuration for node - allocate a mint
//
app.get('/nodefactory', function (req, res) {
    //onsole.log('****EXPRESS; config requested with params: '+dump(req.query));
    //console.log("EXPRESS geo="+req.query.geo+" publickey="+req.query.publickey+" query="+JSON.stringify(req.query,null,2)+" port="+req.query.port+" wallet="+req.query.wallet+" version="+req.query.version);
    var geo = req.query.geo;
    var publickey = req.query.publickey;
    var port = req.query.port || 65013;
    var wallet = req.query.wallet || "";
    var incomingTimestamp = req.query.ts || lib_1.now();
    var OWL = Math.round(lib_1.now() - incomingTimestamp);
    // store incoming public key, ipaddr, port, geo, etc.
    //   var incomingIP=req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    //   var incomingIP=req.connection.remoteAddress;
    var incomingIP = req.query.myip; /// for now we believe the node's IP
    var clientIncomingIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    //console.log("req="+dump(req));
    var version = req.query.version;
    //console.log("EXPRESS /nodefactory clientIncomingIP="+clientIncomingIP+" geo="+geo+" publickey="+publickey+" port="+port+" wallet="+wallet+" incomingIP="+incomingIP+" version="+version);
    //console.log("req="+dump(req.connection));
    //
    //    Admission control goies here - test wallet, stop accepting nodeFactory requests
    //
    /********** GENESIS NODE **********/
    expressRedisClient.incr("mintStack", function (err, newMint) {
        var _a;
        if (newMint == 1) { //I AM GENESIS NODE - set my records
            console.log("* * * * * * * I AM GENESIS NODE * * * * * *");
            var mint0 = {
                "mint": "1",
                "geo": geo,
                "group": geo + ".1",
                // wireguard configuration details
                "port": "" + port,
                "ipaddr": incomingIP,
                "publickey": publickey,
                //
                "state": "RUNNING",
                "bootTime": "" + lib_1.now(),
                "version": version,
                "wallet": wallet,
                "owl": "" //
            };
            expressRedisClient.hmset("mint:0", mint0);
            mint0.mint = "1";
            expressRedisClient.hmset("mint:1", mint0);
            var genesisGroupEntry = {
                "geo": geo,
                "group": geo + ".1",
                "seq": "0",
                "pulseTimestamp": "" + lib_1.now(),
                "srcMint": "1",
                // =
                "owls": "1",
                //"owls" : getOWLs(me.group),  //owls other guy is reporting
                //node statistics - we measure these ourselves
                //"owl": ""+OWL,   //how long it took this node's last record to reach me
                "inOctets": "0",
                "outOctets": "0",
                "inMsgs": "0",
                "outMsgs": "0",
                "pktDrops": "0" //as detected by missed seq#
                //"remoteState": "0"   //and there are mints : owls for received pulses 
            };
            var genesisGroupLabel = geo + ":" + geo + ".1";
            expressRedisClient.hmset(genesisGroupLabel, genesisGroupEntry);
            expressRedisClient.hmset("gSRlist", (_a = {},
                _a[genesisGroupLabel] = "1",
                _a));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ "node": "GENESIS" }));
            getConfig(function (err, config) {
                console.log("Genesis config=" + JSON.stringify(config, null, 2));
            });
            console.log("* * * * * * * * * * * * * * GENESIS CONFIGURATION COMPLETE * * * * * * * * * * *");
            expressRedisClient.publish("members", "Genesis Started pulseGroup mint:" + genesisGroupEntry.srcMint + " " + genesisGroupEntry.geo + ":" + genesisGroupEntry.group);
            return;
        }
        /* ---------------------NON-GENESIS NODE - this config is sent to remote node ------------*/
        // Genesis Node as mint:1
        expressRedisClient.hgetall("mint:1", function (err, genesis) {
            console.log("--------------- EXPRESS() Non-GENESIS CONFIGURATION  ------------------");
            var genesisGroupLabel = genesis.geo + ":" + genesis.group;
            expressRedisClient.hgetall(genesisGroupLabel, function (err, genesisGroup) {
                //console.log(ts()+"genesis.owls="+genesisGroup.owls);
                expressRedisClient.hmset(genesisGroupLabel, "owls", genesisGroup.owls + "," + newMint + "=" + OWL);
                //console.log("working on NON-GENESIS Config");
                // Use the genesis node info to create the config
                var mint0 = {
                    "mint": "" + newMint,
                    "geo": geo,
                    "group": genesis.group,
                    // wireguard configuration details
                    "port": "" + port,
                    "ipaddr": incomingIP,
                    "publickey": publickey,
                    //
                    "state": "RUNNING",
                    "bootTime": "" + lib_1.now(),
                    "version": version,
                    "wallet": wallet,
                    "owl": "" //we will get measures from genesis node
                };
                /*** **/
                var mint1 = {
                    "mint": "1",
                    "geo": genesis.geo,
                    "group": genesis.group,
                    // wireguard configuration details
                    "port": "" + genesis.port,
                    "ipaddr": genesis.ipaddr,
                    "publickey": genesis.publickey,
                    //
                    "state": "RUNNING",
                    "bootTime": "" + lib_1.now(),
                    "version": genesis.version,
                    "wallet": genesis.wallet,
                    "owl": "" //we will get measures from genesis node
                };
                /*(******/
                var newMintRecord = {
                    "mint": "" + newMint,
                    "geo": geo,
                    "group": genesis.group,
                    // wireguard configuration details
                    "port": "" + port,
                    "ipaddr": incomingIP,
                    "publickey": publickey,
                    //
                    "state": "RUNNING",
                    "bootTime": "" + lib_1.now(),
                    "version": version,
                    "wallet": wallet,
                    "owl": "" //do not measure OWL to self - maybe delete this field to catch err?
                };
                expressRedisClient.hmset("mint:" + newMint, newMintRecord);
                //expressRedisClient.hmset("mint:"+newMint,newMintRecord);
                // Now for a record of this newNode in the Genesis group
                //get group owner (genesis group) OWLS
                //mintList(expressRedisClient, genesis.group, function(err,owls){
                //expressRedisClient.hgetall(genesisGroupLabel, function(err,genesisGroup))   
                //var genesisGroup=genesis.geo+":"+genesis.group;
                var newOwlList = genesisGroup.owls + "," + newMint;
                console.log(lib_1.ts() + "Genesis.group=" + lib_1.dump(genesisGroup) + " newOwlList=" + newOwlList);
                expressRedisClient.hset(genesisGroupLabel, "owls", newOwlList, function (err, reply) {
                    var justMints = lib_1.getMints(genesisGroup);
                    console.log(lib_1.ts() + "err=" + err + " justMints=" + justMints + " genesisGroup=" + lib_1.dump(genesisGroup));
                    var genesisGroupEntry = {
                        "geo": genesis.geo,
                        "group": genesis.group,
                        "seq": "0",
                        "pulseTimestamp": "0",
                        "srcMint": "1",
                        // =
                        "owls": newOwlList,
                        //"owls" : getOWLs(me.group),  //owls other guy is reporting
                        //node statistics - we measure these ourselves
                        "owl": "",
                        "inOctets": "0",
                        "outOctets": "0",
                        "inMsgs": "0",
                        "outMsgs": "0",
                        "pktDrops": "0" //as detected by missed seq#
                        //"remoteState": "0"   //and there are mints : owls for received pulses 
                    };
                    //console.log(ts()+"EXPRESS: non-genesis config genesisGroupEntry.owls="+genesisGroupEntry.owls);
                    var newSegmentEntry = {
                        "geo": geo,
                        "group": genesis.group,
                        "seq": "0",
                        "pulseTimestamp": "0",
                        "srcMint": "" + newMint,
                        // =
                        "owls": justMints,
                        //"owls" : getOWLs(me.group),  //owls other guy is reporting
                        //node statistics - we measure these ourselves
                        "owl": "",
                        "inOctets": "0",
                        "outOctets": "0",
                        "inMsgs": "0",
                        "outMsgs": "0",
                        "pktDrops": "0" //as detected by missed seq#
                        //"remoteState": "0"   //and there are mints : owls for received pulses 
                    };
                    //console.log(ts()+"newSegmentEntry="+dump(newSegmentEntry));
                    expressRedisClient.hmset(geo + ":" + genesis.group, newSegmentEntry);
                    lib_1.SRList(expressRedisClient, function (err, mygSRlist, myOwlList) {
                        var _a;
                        console.log("EXPRESS: ********** SRList callback - mygSRlist=" + mygSRlist + " myOwlList=" + myOwlList) + " newMint=" + newMint + " geo=" + geo + " genesis.group=" + genesis.group;
                        //we now have updated gSRlist and updated owls   
                        var entryLabel = "" + geo + ":" + genesis.group;
                        expressRedisClient.hmset("gSRlist", (_a = {},
                            _a[entryLabel] = "" + newMint,
                            _a)); //add node:grp to gSRlist
                        // install owls into genesisGroup
                        getConfig(function (config) {
                            //console.log("EXPRESS nodeFactory about to send json="+dump(node));
                            config.mintTable["mint:0"] = mint0; //tell remote their config
                            console.log("EXPRESS(): sending new node its config=" + lib_1.dump(config));
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify(config));
                            //console.log("EXPRESS: Node connection established - now rebuild new configuration for witreguard configuration file to allow genesis to sendus stuff");
                            console.log("EXPRESS nodeFactory done");
                        });
                        expressRedisClient.publish("members", "Genesis ADDED pulseGroup member mint:" + newSegmentEntry.srcMint + " " + newSegmentEntry.geo + ":" + newSegmentEntry.group);
                        console.log("EXPRESS(): Non-Genesis config: newMintRecord=" + lib_1.dump(newMintRecord) + " mint0=" + lib_1.dump(mint0) + " mint1=" + lib_1.dump(mint1) + " genesisGroupEntry=" + lib_1.dump(genesisGroupEntry) + " newSegmentEntry=" + lib_1.dump(newSegmentEntry));
                    });
                });
            });
        });
    });
});
function getMintTable(mint, callback) {
    expressRedisClient.hgetall("mint:" + mint, function (err, mintEntry) {
        callback(err, mintEntry);
    });
}
function popMint() {
    var mint = 0;
    expressRedisClient.incr("mintStack", function (err, newMint) {
        if (err) {
            console.log("err=" + err);
        }
        else {
            //debug('Generated incremental id: %s.', newId);
            mint = newMint;
        }
    });
}
//
// bind the TCP port for externalizing 
//
expressRedisClient.hget("me", "port", function (err, port) {
    if (!port)
        port = 65013;
    var server = app.listen(port, '0.0.0.0', function () {
        var host = server.address().address;
        var port = server.address().port;
        console.log("Express app listening at http://%s:%s", host, port);
    });
});

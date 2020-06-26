"use strict";
var _a;
exports.__esModule = true;
//
//  nodefactory.ts - Creatre Configuration for joining our  pulseGroup object
//
//
var lib_1 = require("../lib/lib");
var pulselayer_1 = require("./pulselayer");
var TEST = true;
var DEFAULT_SHOWPULSES = "0";
//const DEFAULT_START_STATE="SINGLESTEP";  //for single stepping through network protocol code
//const DEFAULT_START_STATE = "QUARENTINE"; //for single stepping through network protocol code
var DEFAULT_START_STATE = "RUNNING";
console.log(lib_1.ts() + "pulsegroup.ts(): ALL NODES START IN RUNNING Mode");
//const DEFAULT_START_STATE="SINGLESTEP"; console.log(ts()+"EXPRESS: ALL NODES START IN SINGLESTEP (no pulsing) Mode");
/****  NODE SITE CONFIGURATION  ****/
//      Environment is way for environment to control the code
if (!process.env.DARPDIR) {
    console.log("No DARPDIR enviropnmental variable specified ");
    process.env.DARPDIR = process.env.HOME + "/darp";
    console.log("DARPDIR defaulted to \" + " + process.env.DARPDIR);
}
if (!process.env.HOSTNAME) {
    process.env.HOSTNAME = require('os').hostname().split(".")[0].toUpperCase();
    console.log("No HOSTNAME enviropnmental variable specified + " + process.env.HOSTNAME);
}
if (!process.env.PORT) {
    process.env.PORT = "65013";
    console.log("No PORT enviropnmental variable specified - setting my DEFAULT PORT " + process.env.PORT);
}
var PORT = parseInt(process.env.PORT) || 65013; //passed into docker
if (!process.env.GENESIS) {
    process.env.GENESIS = "71.202.2.184";
    console.log("No GENESIS enviropnmental variable specified - setting DEFAULT GENESIS and PORT to " + process.env.GENESIS + ":" + process.env.PORT);
}
var GENESIS = process.env.GENESIS;
if (!process.env.VERSION) {
    process.env.VERSION = require('fs').readFileSync('../SWVersion', { encoding: 'utf8', flag: 'r' }).trim();
    console.log("No VERSION enviropnmental variable specified - setting to " + process.env.VERSION);
}
var VERSION = process.env.VERSION || "NoVersion";
if (!process.env.MYIP) {
    console.log("No MYIP enviropnmental variable specified - ERROR - but I will try and find an IP myself frmom incoming message");
    process.env.MYIP = process.env.GENESIS;
    //   MYIP();
}
else
    process.env.MYIP = process.env.MYIP.replace(/['"]+/g, ''); //\trim string
var IP = process.env.MYIP;
var PUBLICKEY = process.env.PUBLICKEY || "noPublicKey";
if (!PUBLICKEY)
    try {
        PUBLICKEY = require('fs').readFileSync('../wireguard/publickey', 'utf8');
        PUBLICKEY = PUBLICKEY.replace(/^\n|\n$/g, '');
        console.log("pulled PUBLICKEY from publickey file: >" + PUBLICKEY + "<");
    }
    catch (err) {
        console.log("PUBLICKEY lookup failed");
        PUBLICKEY = "deadbeef00deadbeef00deadbeef0013";
    }
var GEO = process.env.HOSTNAME || "noHostName"; //passed into docker
GEO = GEO.toUpperCase().split(".")[0].split(":")[0].split(",")[0].split("+")[0];
var WALLET = process.env.WALLET || "584e560b06717ae0d76b8067d68a2ffd34d7a390f2b2888f83bc9d15462c04b2";
//------------------------ Environmentals loaded -----------------------
//             start config/instrumentation web server
var express = require('express');
var app = express();
var server = app.listen(PORT, '0.0.0.0', function () {
    //TODO: add error handling here
    var host = server.address().address;
    var port = server.address().port;
    console.log("Express app listening at http://%s:%s", host, port);
}); //.on('error', console.log);
//
//
//  Making of my own pulseGroup for members to connect to
//
//
var me = makeMintEntry(1, GEO, PORT, IP, PUBLICKEY, VERSION, WALLET); //All nodes can count on 'me' always being present
//All nodes also start out ready to be a genesis node for others
var genesis = makeMintEntry(1, GEO, PORT, IP, PUBLICKEY, VERSION, WALLET);
var pulse = makePulseEntry(1, GEO, GEO + ".1", IP, PORT, VERSION); //makePulseEntry(mint, geo, group, ipaddr, port, version) 
var pulseGroup = {
    groupName: me.geo + ".1",
    groupOwner: me.geo,
    me: {},
    genesis: {},
    mintTable: [
        me
    ],
    pulses: (_a = {},
        _a[genesis.geo + ":" + genesis.geo + ".1"] = pulse,
        _a),
    rc: 0,
    ts: lib_1.now(),
    nodeCount: 1,
    nextMint: 2,
    cycleTime: 600
};
pulseGroup.me = me;
pulseGroup.genesis = genesis;
var pulseGroups = [pulseGroup];
//TO ADD a PULSE: pulseGroup.pulses["newnode" + ":" + genesis.geo+".1"] = pulse;
//TO ADD A MINT: pulseGroup.mintTable[36]=me;
//pulseGroup.mintTable=genesis;
//console.log("--------------------------Starting with my own pulseGroup="+dump(pulseGroup));
//pulseGroup.addNode("MAZORE",GEO+".1","104.42.192.234",65013,PUBLICKEY,VERSION,WALLET);
//console.log("-********************** AFTER pulseGroup="+dump(pulseGroup));
//process.exit(36);
app.get('/', function (req, res) {
    //console.log("fetching '/state'");
    //handleShowState(req, res); 
    res.setHeader('Content-Type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify(pulseGroups, null, 2));
    return;
});
app.get('/state', function (req, res) {
    //console.log("fetching '/state'");
    //handleShowState(req, res); 
    res.setHeader('Content-Type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify(pulseGroups, null, 2));
    return;
});
//// nodeFactory
//       Configuration for node - allocate a mint
//
app.get('/nodefactory', function (req, res) {
    //console.log(ts() + "NODEFACTORY");
    //
    //  additional nodes adding to pulseGroup
    //
    console.log('EXPRESS nodeFactory: config requested with params: ' + lib_1.dump(req.query));
    //console.log("EXPRESS geo="+req.query.geo+" publickey="+req.query.publickey+" query="+JSON.stringify(req.query,null,2)+" port="+req.query.port+" wallet="+req.query.wallet+" version="+req.query.version);
    //marshall variables
    var geo = req.query.geo;
    var publickey = req.query.publickey;
    var port = req.query.port || 65013;
    var wallet = req.query.wallet || "";
    var incomingTimestamp = req.query.ts;
    var incomingIP = req.query.myip; /// for now we believe the node's IP
    var clientIncomingIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (incomingIP == "noMYIP")
        incomingIP = clientIncomingIP;
    if (typeof incomingIP == "undefined")
        return console.log(lib_1.ts() + "***********************ERROR: incomingIP unavailable from geo=" + geo + " incomingIP=" + incomingIP + " clientIncomingIP=" + clientIncomingIP);
    ;
    var octetCount = incomingIP.split(".").length;
    if (typeof incomingTimestamp == "undefined") {
        console.log("/nodeFactory called with no timestamp");
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            "rc": "-1 nodeFactory called with no timestamp. "
        }));
        return;
    }
    if (octetCount != 4) {
        console.log("EXPRESS(): nodefactory called with bad IP address:" + incomingIP + " returning rc=-1 to config geo=" + geo);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            "rc": "-1 nodeFactory called with BAD IP addr: " + incomingIP
        }));
        return;
    }
    //console.log("req="+dump(req));
    var version = req.query.version;
    //console.log("EXPRESS /nodefactory geo="+geo+" publickey="+publickey+" port="+port+" wallet="+wallet+" incomingIP="+incomingIP+" version="+version);
    //console.log("req="+dump(req.connection));
    //var newNode=pulseGroup.addNode( geo, GEO+".1", incomingIP, port,publickey, version, wallet); //add new node and pulse entry to group
    if (me.ipaddr == incomingIP) { //GENESIS NODE instantiating itself - don't need to add anything
        console.log("...........................GENESIS NODE CONFIGURED FINISHED configured...........");
        console.log("...........................GENESIS NODE CONFIGURED FINISHED configured...........");
        console.log("...........................GENESIS NODE CONFIGURED FINISHED configured...........");
        console.log("...........................GENESIS NODE CONFIGURED FINISHED configured...........");
        console.log("...........................GENESIS NODE CONFIGURED FINISHED configured...........");
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(pulseGroup));
        return;
    }
    console.log("........................ SETTING UP NON-GENESIS PULSE NODE ...................");
    console.log("........................ SETTING UP NON-GENESIS PULSE NODE ...................");
    console.log("........................ SETTING UP NON-GENESIS PULSE NODE ...................");
    console.log("........................ SETTING UP NON-GENESIS PULSE NODE ...................");
    console.log("........................ SETTING UP NON-GENESIS PULSE NODE ...................");
    //
    //  Add mint and pulse to my pulsegroup
    //
    var newMint = pulseGroup.nextMint++;
    console.log(geo + ": mint=" + newMint + " publickey=" + publickey + "version=" + version + "wallet=" + wallet);
    pulseGroup.pulses[geo + ":" + pulseGroup.groupName] = makePulseEntry(newMint, geo, pulseGroup.groupName, incomingIP, port, VERSION);
    //console.log("Added pulse: "+geo + ":" + group+"="+dump(pulseGroup.pulses[geo + ":" + group]));
    var newNode = makeMintEntry(newMint, geo, port, incomingIP, publickey, version, wallet);
    pulseGroup.mintTable.push(newNode); //put new node in the mint table
    console.log("added mint# " + newMint + " = " + newNode.geo + ":" + newNode.ipaddr + ":" + newNode.port + ":" + newMint + " to " + pulseGroup.groupName);
    //console.log("After adding node, pulseGroup="+dump(pulseGroup));
    pulseGroup.nodeCount++;
    console.log("BeforeCloning, pulseGroup=" + lib_1.dump(pulseGroup));
    //function makeMintEntry(mint:number, geo:string, port:number, incomingIP:string, publickey:string, version:string, wallet:string):MintEntry {
    //make a copy of the pulseGroup for the new node and set its passed-in startup variables
    var newNodePulseGroup = JSON.parse(JSON.stringify(pulseGroup));
    newNodePulseGroup.me = newNode;
    //newNodePulseGroup.mintTable.shift();  //get rid of groupOwner mint[0]
    //newNodePulseGroup.mintTable[0]=newNode;
    //wbnwbnwbn - Here we modify our pulseGroup to be fitted for remote.
    //  this means mintTable[0]  
    console.log("********************************* newNodePulseGroup=" + lib_1.dump(newNodePulseGroup));
    console.log("********************************* newNodePulseGroup=");
    console.log("********************************* newNodePulseGroup=");
    console.log("********************************* newNodePulseGroup=");
    console.log("********************************* newNodePulseGroup=");
    //                              //pulseNode MEMBER NODE
    //
    console.log(lib_1.ts() + "nodefactory configuring new node publickey=" + publickey + " me.publickey=" + me.publickey);
    console.log("nodefactory: Received connection from " + geo + "(" + incomingIP + ")");
    console.log(lib_1.ts() + " nodeFactory sending newNodeConfig =" + lib_1.dump(newNodePulseGroup));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(newNodePulseGroup)); //send mint:0 mint:1 *mint:N groupEntry *entryN
    console.log("After Cloning and delivery of member config, my genesis pulseGroup=" + lib_1.dump(pulseGroup));
    pulseGroups = [pulseGroup];
});
function makeMintEntry(mint, geo, port, incomingIP, publickey, version, wallet) {
    return {
        mint: mint,
        geo: geo,
        // wireguard configuration details
        port: port,
        ipaddr: incomingIP,
        publickey: publickey,
        state: DEFAULT_START_STATE,
        bootTimestamp: lib_1.now(),
        version: version,
        wallet: wallet // ** 
    };
}
//
//  pulseEntry - contains stats for and relevent fields to configure wireguard
//
function makePulseEntry(mint, geo, group, ipaddr, port, version) {
    return {
        mint: mint,
        geo: geo,
        group: group,
        ipaddr: ipaddr,
        port: port,
        seq: 1,
        owl: -99999,
        pulseTimestamp: 0,
        owls: "1",
        // stats
        bootTimestamp: lib_1.now(),
        version: version,
        //
        inPulses: 0,
        outPulses: 0,
        pktDrops: 0,
        lastMsg: "",
        outgoingTimestamp: 0 //sender's timestamp on send
    };
}
//
//      get conmfiguration from the genesis node
//
var url = encodeURI("http://" + process.env.GENESIS + ":" + process.env.PORT + "/nodefactory?geo=" + GEO + "&port=" + PORT + "&publickey=" + PUBLICKEY + "&version=" + VERSION + "&wallet=" + WALLET + "&myip=" + process.env.MYIP + "&ts=" + lib_1.now());
console.log("getting pulseGroup from url=" + url);
//var hostname=process.env.HOSTNAME||"noHostName"
//var geo=hostname.split(".")[0].toUpperCase();
//var port=process.env.PORT||"65013";
//
//  getPulseGroup() - 
//
function joinPulseGroup(ipaddr, port, callback) {
    console.log("getPulseGroup(): ipaddr=" + ipaddr + ":" + port);
    var http = require('http');
    var req = http.get(url, function (res) {
        var data = '', json_data;
        res.on('data', function (stream) {
            data += stream;
        });
        res.on('error', function () {
            console.log(lib_1.ts() + "getPulseGroup(): received error from " + URL);
            process.exit(36);
        });
        res.on('end', function () {
            //console.log("********* *******           data="+data);
            var newPulseGroup = JSON.parse(data);
            console.log("getPulseGroup(): from node factory:" + lib_1.dump(newPulseGroup));
            if (newPulseGroup.me.publickey == PUBLICKEY) {
                console.log(lib_1.ts() + "getPulseGroup(): GENESIS node already configured ");
                //*********** GENESIS NODE CONFIGURED **********/
                //pulseGroups=[newPulseGroup];
                callback(newPulseGroup);
                return;
            }
            console.log(lib_1.ts() + "getPulseGroup(): Configuring non-genesis node ... ");
            callback(newPulseGroup);
            console.log("getPulseGroup():- call setWireguard to generate wireguard config for me and genesis node:");
            //        setWireguard(); //set up initial wireguard comfig
        });
    });
    console.log("http fetch done");
}
//
//
//
/***************** TEST AREA ****************/
if (TEST) {
    //console.log("* * * * * * * * * Starting  pulseGroup="+dump(pulseGroup));
    joinPulseGroup(GENESIS, PORT, function (newPulseGroup) {
        //    joinPulseGroup("71.202.2.184","65013", function (newPulseGroup) {
        console.log("callback from my or someone else's pulseGroup=" + lib_1.dump(pulseGroup));
        //
        //       attach convenience routines to the downloaded pulseGroup assignment
        //
        newPulseGroup.forEachNode = function (callback) { for (var node in this.pulses)
            callback(node, this.pulses[node]); };
        newPulseGroup.forEachMint = function (callback) { for (var mint in this.mintTable)
            callback(mint, this.mintTable[mint]); };
        newPulseGroup.addNode = function (geo, group, ipaddr, port, publickey, version, wallet) {
            var newMint = newPulseGroup.nextMint++;
            //console.log("AddNode(): "+geo+":"+group+" as "+ipaddr+"_"+port+" mint="+newMint+" publickey="+publickey+"version="+version+"wallet="+wallet);
            //TO ADD a PULSE: 
            this.pulses[geo + ":" + group] = makePulseEntry(newMint, geo, group, ipaddr, port, VERSION);
            //console.log("Added pulse: "+geo + ":" + group+"="+dump(pulseGroup.pulses[geo + ":" + group]));
            //TO ADD A MINT:
            var newNode = makeMintEntry(newMint, geo, port, ipaddr, publickey, version, wallet);
            this.mintTable[newMint] = newNode;
            //console.log(`addNode() adding mint# ${newMint} = ${geo}:${ipaddr}:${port}:${newMint} added to ${group}`);
            //console.log("After adding node, pulseGroup="+dump(pulseGroup));
            newPulseGroup.nodeCount++;
            return this.mintTable[newMint];
        };
        newPulseGroup.deleteNode = function (geo, group, ipaddr, port, mint) {
            delete this.pulses[geo + ":" + group];
            delete this.mintTable[mint];
        };
        //pulseGroup.pulse = function() {
        newPulseGroup.pulse = function () {
            var ipary = [], owls = "";
            newPulseGroup.forEachNode(function (index, nodeEntry) {
                ipary.push(nodeEntry.ipaddr + "_" + nodeEntry.port);
                nodeEntry.outPulses++;
                if (nodeEntry.owl == -99999)
                    owls = "" + owls + nodeEntry.mint + ",";
                else {
                    //if pulseTimestamp within a second (POLLING CYCLE)
                    owls += "" + owls + nodeEntry.mint + "=" + nodeEntry.owl + ",";
                }
            });
            owls = owls.replace(/,+$/, ""); //remove trailing comma 
            var myEntry = newPulseGroup.pulses[GEO + ":" + newPulseGroup.groupName];
            var pulseMessage = "0," + VERSION + "," + GEO + "," + newPulseGroup.groupName + "," + (myEntry.seq++) + "," + newPulseGroup.mintTable[0].bootTimestamp + "," + myEntry.mint + "," + owls;
            console.log("pulseGroup.pulse(): pulseMessage=" + pulseMessage + " to " + lib_1.dump(ipary));
            pulselayer_1.sendPulses(pulseMessage, ipary);
            setTimeout(newPulseGroup.pulse, newPulseGroup.cycleTime * 1000);
        };
        newPulseGroup.recvPulses = function () {
            pulselayer_1.recvPulses(me.port, function (incomingPulse) {
                console.log("recvPulseGroup incomingPulse=" + lib_1.dump(incomingPulse));
                var pulseEntry = newPulseGroup.pulses[incomingPulse.geo + ":" + incomingPulse.group];
                console.log("My pulseEntry for " + incomingPulse.geo + ":" + incomingPulse.group + "=" + lib_1.dump(pulseEntry));
                if (pulseEntry != null) { //copy incoming pulse into my record
                    pulseEntry.inPulses++;
                    pulseEntry.lastMsg = incomingPulse.lastMsg;
                    pulseEntry.pulseTimestamp = incomingPulse.pulseTimestamp;
                    pulseEntry.owl = incomingPulse.owl;
                    pulseEntry.owls = incomingPulse.owls;
                }
                else {
                    console.log("Received pulse but could not find our pulseRecord for it. Ignoring until group owner sends us a new list: " + incomingPulse.geo);
                }
            });
        };
        newPulseGroup.getMint = function (mint) {
            this.forEachMint(function (mintEntry) {
                if (mintEntry.mint == mint)
                    return mintEntry;
            });
            return null;
        };
        //
        // TODO: assign a mew and genesis convenience reference as part of pulseGroup
        //newPulseGroup.me=newPulseGroup.getMint(newPulseGroup.whoami);newPulseGroup.genesis=newPulseGroup.getMint(1);
        /*      pulseGroup.addNode("MAZORE",GEO+".1","104.42.192.234",65013,PUBLICKEY,VERSION,WALLET);
              pulseGroup.addNode("MAZDAL",GEO+".1","23.102.167.37", 65013,PUBLICKEY,VERSION,WALLET);
              pulseGroup.addNode("MAZASH",GEO+".1","52.251.39.60",  65013,PUBLICKEY,VERSION,WALLET);
              pulseGroup.addNode("MAZCHI",GEO+".1","157.55.208.35", 65013,PUBLICKEY,VERSION,WALLET);
              pulseGroup.addNode("MAZPAR",GEO+".1","40.89.168.131", 65013,PUBLICKEY,VERSION,WALLET);
              pulseGroup.addNode("MAZLON",GEO+".1","51.105.5.246",  65013,PUBLICKEY,VERSION,WALLET);
              pulseGroup.addNode("MAZAMS",GEO+".1","13.73.182.162", 65013,PUBLICKEY,VERSION,WALLET);
              pulseGroup.addNode("MAZIND",GEO+".1","104.211.95.109",65013,PUBLICKEY,VERSION,WALLET);
             pulseGroup.addNode("MAZCAP",GEO+".1","40.127.4.79",   65013,PUBLICKEY,VERSION,WALLET);
              pulseGroup.addNode("MAZSYD",GEO+".1","52.187.248.162",65013,PUBLICKEY,VERSION,WALLET);
          /* */
        console.log("===* * * * * * * * * * * * * * * * * * DARP NODE STARTED: pulseGroup=" + lib_1.dump(newPulseGroup));
        //        pulseGroup.forEachNode(function(index:string,node:PulseEntry){console.log("pulseNode: "+index+" node="+dump(node));});
        //        pulseGroup.forEachMint(function(index:string,mint:MintEntry){console.log("MINT:"+index+" mint="+dump(mint));});
        //console.log("pulseGroup="+dump(pulseGroup));
        //console.log("pulse():");
        newPulseGroup.recvPulses();
        newPulseGroup.pulse();
        //if (!pulseGroup.isGenesisNode) pulseGroups.push(newPulseGroup);
        //if (!pulseGroup.isGenesisNode) pulseGroups.push(newPulseGroup);
        //else 
        pulseGroups = [newPulseGroup]; //for now genesis node has no others
    });
}
//----------------- sender 
/***************** TEST AREA ****************/ 

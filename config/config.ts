//
//  config.ts - Configure your node to connect to the pulseGroup
//
import { now, ts ,dump} from '../lib/lib.js';
//      Configuration parameters - agreed to by all in the pulseGroup

/*
process.on('uncaughtException', function (err) {
    console.log("CONFIG: uncaughtException trap: "+err);
}); 
*/



//  me - my internal state and pointer to genesis
//
import { setWireguard } from "../wireguard/wireguard";
//import { generateKeyPairSync } from "crypto";
//import { getUnpackedSettings } from "http2";
//import { Z_VERSION_ERROR } from "zlib";
var http = require('http');

const pulseRedis = require('redis');
var redisClient = pulseRedis.createClient(); //creates a new client

/***
var PUBLICKEY=process.env.PUBLICKEY;
redisClient.hgetall("mint:0", function(err,me) {
    console.log(ts()+"CONFIG: WEIRD ENV PUBLICKEY != REDIS PUBLICKEY-Exitting 23");
    if (PUBLICKEY!=me.publickey) process.exit(23);
});//we need this to authenticate self as genesis
//console.log("env="+JSON.stringify(process.env,null,2));
var GEO=process.env.HOSTNAME;   //passed into docker
GEO=GEO.toUpperCase().split(".")[0].split(":")[0].split(",")[0].split("+")[0];
var PORT=process.env.PORT||"65013";         //passed into docker

var WALLET=process.env.WALLET || "584e560b06717ae0d76b8067d68a2ffd34d7a390f2b2888f83bc9d15462c04b2";

//from 
redisClient.hmset("mint:0","geo",GEO,"port",PORT,"wallet",WALLET,"MYIP",process.env.MYIP,"VERSION",process.env.VERSION,"HOSTNAME",process.env.HOSTNAME,"GENESIS",process.env.GENESIS);

//GEO=GEO.toString().split('.').split(',');
**/
console.log("CONFIG GENESIS="+process.env.GENESIS+" PORT="+process.env.PORT+" HOSTNAME="+process.env.HOSTNAME+" VERSION="+process.env.VERSION+" MYIP="+process.env.MYIP);

/*
//  mint:0 is me  and  mint:1 is Genesis node 
redisClient.hmset("mint:0",{
    "mint" : "0",      //set by genesis node
    "geo" : GEO,
    "group": GEO+".1",      //add all nodes to genesis group
    // wireguard configuration details
    "port" : ""+PORT,
    "ipaddr" : process.env.MYIP,   //set by genesis node on connection
    "publickey" : PUBLICKEY,
    //
    "bootTime" : ""+now(),   //So we can detect reboots
    "version" : process.env.VERSION,  //software version
    "wallet" : WALLET,
    "owl": ""   //how long it took this node's last record to reach me
 });
*/


getConfiguration();  //later this should start with just an IP of genesis node 

function getConfiguration() {
    var URL="http://"+process.env.GENESIS+":"+"65013/"
    URL=URL+encodeURI("nodefactory?geo="+process.env.GEO+"&port="+process.env.PORT+"&publickey="+process.env.PUBLICKEY+"&version="+process.env.VERSION+"&wallet="+process.env.WALLET+"&myip="+process.env.MYIP+"&ts="+now());
    
    console.log("****CONFIG: getConfiguration() Fetching config from URL: "+URL);

    //FETCH CONFIG
    var req = http.get(URL, function (res) {
        var data = '', json_data;
        res.on('data', function (stream) {
            data += stream;
        });
        res.on('error', function() {
            console.log(ts()+"CONFIG: received error from "+URL);
            process.exit(36); 
        })

        res.on('end', function () {
            var config = JSON.parse(data);            
            console.log("COMFIG: --------- " +process.env.GEO+" --------- configuration");
            console.log("CONFIG from node factory:"+JSON.stringify(config,null,2));

            if (config.isGenesisNode==true) {
                console.log(ts()+"CONFIG GENESIS node already configured");
                //dumpState();
            } else {
                console.log(ts()+"CONFIG Configuring non-genesis node ... config.isGenesisNode="+config.isGenesisNode);
                redisClient.hmset("gSRlist", config.gSRlist );
                //install config
                for (var mint in config.mintTable) {
                    var mintEntry=config.mintTable[mint];
                    //console.log("add mint:"+mint+" mintEntry="+dump(mintEntry));
                    redisClient.hmset(mint, mintEntry);
                }

                for (var pulse in config.pulses) {
                    var pulseEntry=config.pulses[pulse];
                    //console.log("add pulse:"+pulse+" pulseEntry="+dump(pulseEntry));
                    redisClient.hmset(pulse, pulseEntry);

                    redisClient.publish("members","ADDED "+pulseEntry.geo)
                }

            }
        });
    });
}


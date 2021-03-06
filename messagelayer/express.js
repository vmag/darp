"use strict";
exports.__esModule = true;
//
// express.ts - set up the "me" and connect to the network by getting config from the genesis node
//
// incoming environmental variables:
//    GENESIS - IP of Genesis node
//    DARPDIR - where the code and config reside
//    VERSION - of software running
//    HOSTNAME - human readable text name - we use this for "geo"
//    PUBLICKEY - Public key 
//
var lib_1 = require("../lib/lib");
var wireguard_1 = require("../wireguard/wireguard");
var MAX_CONFIG_FRAMES = 1; //How many config snapshot to store for mdeian variance calaucltions
var INSTRUMENTATION_REFRESH = 300; //BROWSER REFRESH ____ seconds
var BETTER_THRESHOLD = 10;
var ACTIVE_INSTRUMENTATION = true;
var YELLOW_TRIGGER = 20; //when we show yellow warning when meaurement is  +/- _ 10 _% from median
var ORANGE_TRIGGER = 30; //when we show orange warning 
var RED_TRIGGER = 40; //when we show red warning 
console.log("Starting EXPRESS GENESIS=" + process.env.GENESIS + " PORT=" + process.env.PORT + " HOSTNAME=" + process.env.HOSTNAME + " VERSION=" + process.env.VERSION);
var expressRedis = require('redis');
var expressRedisClient = expressRedis.createClient(); //creates a new client
expressRedisClient.flushall(); //clean slate
var express = require('express');
var app = express();
var mintStack = 1;
var DEFAULT_SHOWPULSES = "0";
//const DEFAULT_START_STATE="SINGLESTEP";  //for single stepping through network protocol code
//const DEFAULT_START_STATE = "QUARENTINE"; //for single stepping through network protocol code
var DEFAULT_START_STATE = "RUNNING";
console.log(lib_1.ts() + "EXPRESS: ALL NODES START IN RUNNING Mode");
//const DEFAULT_START_STATE="SINGLESTEP"; console.log(ts()+"EXPRESS: ALL NODES START IN SINGLESTEP (no pulsing) Mode");
/****  NODE SITE CONFIGURATION  ****/
//      Environment is way for environment to control the code
if (!process.env.DARPDIR) {
    console.log("No DARPDIR enviropnmental variable specified ");
    process.env.DARPDIR = process.env.HOME + "/darp";
    console.log("DARPDIR defaulted to " + process.env.DARPDIR);
}
if (!process.env.HOSTNAME) {
    console.log("No HOSTNAME enviropnmental variable specified ");
    process.env.HOSTNAME = require('os').hostname().split(".")[0];
    console.log("setting HOSTNAME to " + process.env.HOSTNAME);
}
if (!process.env.GENESIS) {
    console.log("No GENESIS enviropnmental variable speci.0fied - setting DEFAULT GENESIS and PORT");
    process.env.GENESIS = "71.202.2.184";
    process.env.PORT = "65013";
}
if (!process.env.PORT) {
    console.log("No PORT enviropnmental variable specified - setting DEFAULT GENESIS PORT");
    process.env.PORT = "65013";
}
if (!process.env.VERSION) {
    console.log("No VERSION enviropnmental variable specified - setting to noVersion");
    process.env.VERSION = lib_1.MYVERSION();
}
console.log(lib_1.ts() + "process.env.VERSION=" + process.env.VERSION);
if (!process.env.MYIP) {
    console.log("No MYIP enviropnmental variable specified - ERROR - but I will try and find an IP myself frmom incoming message");
    process.env.MYIP = "noMYIP";
    lib_1.MYIP();
}
else
    process.env.MYIP = process.env.MYIP.replace(/['"]+/g, ''); //\trim string
var PUBLICKEY = process.env.PUBLICKEY;
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
var GEO = process.env.HOSTNAME; //passed into docker
GEO = GEO.toUpperCase().split(".")[0].split(":")[0].split(",")[0].split("+")[0];
var PORT = process.env.PORT || "65013"; //passed into docker
var WALLET = process.env.WALLET || "584e560b06717ae0d76b8067d68a2ffd34d7a390f2b2888f83bc9d15462c04b2";
//from 
//FAT MODEL expressRedisClient.hmset("mint:0","geo",GEO,"port",PORT,"wallet",WALLET,"version",process.env.VERSION,"hotname",process.env.HOSTNAME,"genesis",process.env.GENESIS,"publickey",PUBLICKEY);
expressRedisClient.hmset("mint:0", "geo", GEO, "port", PORT, "wallet", WALLET, "version", process.env.VERSION, "hostname", process.env.HOSTNAME, "genesis", process.env.GENESIS, "publickey", PUBLICKEY);
//uncomment this to enter protocol single step mode for pulsing manually
expressRedisClient.hmset("mint:0", "adminControl", "SINGLESTEP");
/**** CONFIGURATION SET ****/
expressRedisClient.hgetall("mint:0", function (err, me) {
    console.log("EXPRESS DARP " + me.version);
    console.log("EXPRESS DARP " + me.version);
    console.log("EXPRESS DARP " + me.version + " starting with me=" + lib_1.dump(me));
    console.log("EXPRESS DARP " + me.version);
    console.log("EXPRESS DARP " + me.version);
    if (me != null) { }
    else {
        console.log(lib_1.ts() + "EXPRESS NO REDIS");
        process.exit(36);
    }
});
//
//
//9=25,8=5,1=3,2=39,3=49,5=36,6=20,7=42	
function getOWLfrom(srcMint, owls) {
    var ary = owls.split(",");
    for (var i = 0; i < ary.length; i++) {
        var mint = ary[i].split("=")[0];
        if (mint == srcMint) {
            var owl = ary[i].split("=")[1];
            if (typeof owl != "undefined" && owl != null)
                return owl;
            else
                return "";
        }
    }
}
function getMintRecord(mint, callback) {
    expressRedisClient.hgetall("mint:" + mint, function (err, entry) {
        callback(err, entry);
    });
}
function getIPport(mint, callback) {
    getMintRecord(mint, function (err, mintEntry) {
        callback(err, mintEntry.ipaddr + ":" + mintEntry.port);
    });
}
//
//  Make a matrix of group latency measures
//
function getMatrixTable(config, darp, callback) {
    //console.log("getMatrixTable(): darpMatrix="+dump(darp) );
    if (darp == null) {
        darp = {};
        darp.matrix = {};
        darp.srcNodes = new Array();
        darp.last = "";
        //        expressRedisClient.hgetall("gSRlist", function (gSRlist) {
        var gSRlist = config.gSRlist;
        //console.log("gSRlist:"+dump(gSRlist));
        for (var srcEntry in gSRlist) {
            var srcGeo = srcEntry.split(":")[0];
            darp.srcNodes.push(srcGeo);
            darp.last = srcGeo;
        }
        ///console.log("darp.srcNodes:"+darp.srcNodes);
        for (var srcNode in darp.srcNodes) {
            srcGeo = darp.srcNodes[srcNode];
            //console.log("srcGeo:"+srcGeo);
            for (var destNode in darp.srcNodes) {
                var destGeo = darp.srcNodes[destNode];
                //console.log("dstGeo:"+destGeo);
                if (typeof darp.matrix[srcGeo] == "undefined")
                    darp.matrix[srcGeo] = {};
                if (typeof darp.matrix[srcGeo][destGeo] == "undefined")
                    darp.matrix[srcGeo][destGeo] = srcGeo + "-" + destGeo;
                //console.log("destEntryLabel:"+destEntryLabel+" srcEntryLabel:"+srcEntryLabel+" darp.last:"+darp.last);
                if (destGeo == darp.last) {
                    if (srcGeo == darp.last) { //we now have an empty default matrix
                        //console.log("getMatrixTable: populated matrix:"+dump(darp));
                        getMatrixTable(config, darp, callback); //call again
                    }
                }
            }
        }
        //});
    }
    else {
        //else fill in the default matrix with available values
        //console.log("READY TO FILL MATRIX darp=:"+dump(darp));
        var dstNode = darp.srcNodes.pop();
        if (dstNode == null)
            callback(darp.matrix);
        else {
            //console.log("PROCESSING dstNode="+dstNode);
            expressRedisClient.hgetall(dstNode, function (err, nodeOWLEntries) {
                //console.log(ts()+"dstNode nodeOWLEntries="+dump(nodeOWLEntries));
                if (err) {
                    throw err;
                }
                else {
                    //console.log("dstNode OWL measures:"+dump(nodeOWLEntries));
                    for (var srcGeo in nodeOWLEntries) {
                        if (srcGeo != "EX") {
                            //console.log("srcGeo="+srcGeo+" to "+dstNode+" =nodeOWLEntries[srcGeo]="+dump(nodeOWLEntries[srcGeo]));
                            darp.matrix[srcGeo][dstNode] = nodeOWLEntries[srcGeo];
                        }
                    }
                }
                getMatrixTable(config, darp, callback); //this only returns one bucket full.............
            });
        }
    }
}
;
//
//      handleShowState(req,res) - show the node state
//
function handleShowState(req, res) {
    var dateTime = new Date();
    var txt = '<!DOCTYPE html><meta http-equiv="refresh" content="' + INSTRUMENTATION_REFRESH + '">'; //TODO: dynamic refresh based on new node adds
    expressRedisClient.hgetall("mint:0", function (err, me) {
        if (me == null)
            return console.log("handleShowState(): WEIRD: NULL mint:0");
        //Simple instrumentation UI for DARP
        if (me.state == "SINGLESTEP")
            txt = '<!DOCTYPE html><meta http-equiv="refresh" content="' + 10 + '">';
        //       txt += '<html><head>';
        //
        //
        //      In browser XHR Code to fetch and update the page
        //
        //
        txt += '<head title="DARP">';
        txt += '<script> function startTime() { var today = new Date(); var h = today.getHours(); var m = today.getMinutes(); var s = today.getSeconds(); m = checkTime(m); s = checkTime(s); document.getElementById(\'txt\').innerHTML = h + ":" + m + ":" + s; var t = setTimeout(startTime, 500); } function checkTime(i) { if (i < 10) {i = "0" + i};  return i; } </script>';
        txt += '<link rel = "stylesheet" type = "text/css" href = "http://drpeering.com/noia.css" /> ';
        txt += '<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>';
        txt += '<script>';
        txt += 'var FREEZEBTN="FREEZE";';
        txt += '$(document).ready(function() {';
        txt += '  $("#btnSubmit").click(function(){';
        txt += '      if (FREEZEBTN=="FREEZE") FREEZEBTN="UNFREEZE"; else FREEZEBTN="FREEZE";';
        txt += '      $("#btnSubmit").val(FREEZEBTN);';
        txt += '   }); ';
        //
        txt += '  $("#btnBack").click(function(){';
        txt += '      renderPage(configs.pop());'; //DOES NOT WORK YET
        txt += '   }); ';
        txt += '  $("#btnForward").click(function(){';
        txt += '      renderPage(config.pop());'; //TO DO: DOES NOT WORK YET
        txt += '   }); ';
        txt += ' });';
        txt += "var URL='http://" + me.ipaddr + ":" + me.port + "/state';";
        txt += "var configs=[],startingArrayWidth=1;";
        txt += 'const median = arr => {';
        txt += '       const mid = Math.floor(arr.length / 2),';
        txt += '       nums = [...arr].sort((a, b) => a - b);';
        txt += '      return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;';
        txt += '};';
        txt += '   function renderPage(config) {';
        txt += "      var d = new Date(parseInt(config.ts)); var now=d.getTime();var timeStr=d.toString().split(' ')[4];";
        //       txt += "      var d = new Date(); var now=d.getTime();var timeStr=d.toString().split(' ')[4];"
        //
        //      Render table from information in the state fetched from node
        //
        txt += '      $("#dateTime").html( "<div class=\'fade-out\'><h1>*Updated: " + timeStr + "</h1></div>" );'; //we show this epoch
        txt += '      for (let [key, value] of Object.entries(config.pulses)) {';
        //                txt += '   console.log(`FOR EACH PULSE  ${key}.split(":")[0]: ${value} ---> $("."+pulse.geo+"_"+${key}+").html("+${value}+");`);'
        txt += '          var pulseLabel=key;'; //fill in most fields as counters - plain
        txt += '          var pulse=value;'; //
        txt += '          for (let [field, fieldValue] of Object.entries(pulse)) {';
        // txt += '           console.log("     FOR EACH FIELD       ^field="+field+" fieldValue="+fieldValue);'
        //txt += '              console.log("Setting "+pulse.geo+"_"+field+"="+fieldValue);'
        txt += '             $("."+pulse.geo+"_"+field).html(fieldValue+"");';
        txt += '          }';
        //txt += '          console.log("config="+JSON.stringify(config,null,2));'
        txt += '          if (pulse.pulseTimestamp!="0")';
        txt += '              $("."+pulse.geo+"_pulseTimestamp").html(""+Math.round((now-pulse.pulseTimestamp)/1000)+" secs ago");';
        txt += '          else $("."+pulse.geo+"_pulseTimestamp").html("0");';
        txt += '          $("."+pulse.geo+"_bootTimestamp").html(""+Math.round((now-pulse.bootTimestamp)/1000)+" secs ago");';
        txt += '           $("."+pulse.geo+"_owls").html(pulse.owls);'; //TODO : Align left for this text field
        //        txt +='           $("."+pulse.geo+"_owls").html(\'<span style="text-align:left>"\'+pulse.owls+"</span>");'  //TODO : Align left for this text field
        txt += '       }';
        //Note: we are measuring relative latency so there IS NO ABSOLUTE latency - 0 and -# are valid latency measures
        //
        //                  FILL MATRIX
        //
        txt += '      var arrayWidth=0;';
        txt += '       for(var src in config.mintTable) {';
        txt += '         arrayWidth++;';
        txt += '          for(var dst in config.mintTable) {';
        txt += '              var srcMint=config.mintTable[src].mint;';
        txt += '              var dstMint=config.mintTable[dst].mint;';
        txt += '              var owls=getOwls(configs,srcMint,dstMint);'; //return array of owls
        txt += '              var owl=owls[0];'; //recent measure is first
        txt += '              var myMedian=Math.round(median(owls));';
        txt += '              $("."+srcMint+"-"+dstMint).css("border-color","grey").css("border-width","1px").css("background-color","white").html("_");'; //reset cell markings
        txt += '              ';
        // txt +='            console.log("owls="+owls+" srcMint="+srcMint+"-"+dstMint+" owl="+owl+" myMedian="+myMedian);'
        txt += '              var Ideviation=Math.round(100*(Math.abs(myMedian-owl)/myMedian));';
        //txt +='            console.log(srcMint+"-"+dstMint+" owl="+owl+" myMedian="+myMedian+" Idevitation=:"+Ideviation);'
        //
        txt += '             if (isNaN(owl)) owl="?";';
        //txt += '               '
        txt += '                 var owlHTML=\'<div class="fade-out"><a target="_blank" href="http://' + me.ipaddr + ':' + me.port + '/graph?srcMint=\'+ srcMint + "&dstMint=" + dstMint;';
        txt += '                 owlHTML+=\'">\' ;';
        txt += '                 if (owl!="?") owlHTML += owl + "ms</a></div>";';
        txt += '                 else owlHTML += "?</a></div>";';
        //txt += '               console.log("owlHTML="+owlHTML);'
        //        txt += '               $("."+dstMint+"-"+srcMint).html(owlHTML);'  //set owl value *******************
        txt += '                 $("."+srcMint+"-"+dstMint).html(owlHTML);'; //set owl value *******************
        txt += '          if (isNaN(owl) || isNaN(myMedian)) $("."+srcMint+"-"+dstMint).css("background-color","white").html(" ");'; //no owl or median - blank white
        txt += '          else if ((srcMint!=dstMint) && (' + ACTIVE_INSTRUMENTATION + ')) {';
        /*
        //
        //      highlight bad standard deviations
        //
                txt += "               const n = owls.length;"
                txt += '               const mean = owls.reduce((a,b) => a+b)/n;'
                txt += '               const s = Math.sqrt(owls.map(x => Math.pow(x-mean,2)).reduce((a,b) => a+b)/n);'
        
                txt += '               var percentOfMedian=Math.round((s/myMedian)*100);'
                //txt += '               console.log(srcMint+"-"+dstMint+" owl="+owl+" myMedian="+myMedian+" Idevitation=:"+Ideviation+" stddev="+Math.round(s,2)+" percentOfMedian="+percentOfMedian);'
        
                txt += '               if ((!highlightedCell) && (percentOfMedian>'+YELLOW_TRIGGER+')) $("."+srcMint+"-"+dstMint).css("border-color","yellow").css("border-width","3px");'
                txt += '               if ((!highlightedCell) && (percentOfMedian>'+ORANGE_TRIGGER+')) $("."+srcMint+"-"+dstMint).css("border-color","orange").css("border-width","3px");'
                txt += '               if ((!highlightedCell) && (percentOfMedian>'+RED_TRIGGER+'))    $("."+srcMint+"-"+dstMint).css("border-color",   "red").css("border-width","3px");'
        
         */
        //
        //                      Highlight (overWrite) extraordinary paths
        //
        txt += '                var highlightedCell=0;'; //first color extraordinary relays
        txt += '                for (var altSR in config.mintTable) {'; //first color extraordinary relays
        txt += '                    var altEntry=config.mintTable[altSR];';
        txt += '                    var srcToAlt=getOWL(config,srcMint,altEntry.mint);';
        txt += '                    var altToDst=getOWL(config,altEntry.mint,dstMint);';
        txt += '                    if ((srcToAlt!=null) && (altToDst!=null) && (srcToAlt+altToDst < owl)) {';
        txt += '                        var improvement=owl-(srcToAlt+altToDst);';
        txt += '                        console.log( ">' + BETTER_THRESHOLD + ' ms better than " + srcMint + "-" + dstMint + "=" + owl + "ms  is through " + altEntry.geo + " ms   --->   rcToAlt=" + srcToAlt + " altToDst=" + altToDst + "=" + (srcToAlt+altToDst) + " a savings of " + owl-(srcToAlt+altToDst) + "ms" );';
        txt += '                        if (improvement>' + BETTER_THRESHOLD + ') {';
        txt += '                            $("."+srcMint+"-"+dstMint).css("border-color","black").css("border-width","3px");';
        txt += '                            $("."+srcMint+"-"+altEntry.mint).css("border-color","green").css("border-width","3px");'; //highlight better path
        txt += '                        }';
        txt += '                    }';
        txt += '                }';
        //
        //      highlight variations 
        //
        txt += '               if ((typeof Ideviation == "number") && (Ideviation>' + RED_TRIGGER + '))      $("."+srcMint+"-"+dstMint).css("background-color","lightred");';
        txt += '               else if ((typeof Ideviation == "number") && (Ideviation>' + ORANGE_TRIGGER + ')) $("."+srcMint+"-"+dstMint).css("background-color","orange");';
        txt += '                  else if ((typeof Ideviation == "number") && (Ideviation>' + YELLOW_TRIGGER + ')) $("."+srcMint+"-"+dstMint).css("background-color","yellow");';
        txt += '                    else $("."+srcMint+"-"+dstMint).css("background-color","lightGreen");';
        //txt += '               console.log("FIND EFFICIENCIES - is it faster to go through intermediary for this src-dst pair?");'
        txt += '            }';
        txt += '         }';
        txt += '      }';
        txt += "    };";
        txt += 'var nodeCountLastTime=0;';
        txt += 'function fetchState() {';
        txt += '   $.getJSON(URL, function(config) {';
        txt += '      configs.unshift(config);'; //push onto front of stack
        txt += '      if ( configs.length > ' + MAX_CONFIG_FRAMES + ' ) configs.pop();'; //pop off end of stack (60 seconds worth kept)
        txt += '      if (FREEZEBTN=="FREEZE") renderPage(config);';
        txt += '         var nodeCountNow=config.nodeCount;';
        //txt += '         console.log("nodeCountNow="+nodeCountNow+" nodeCountLastTime="+nodeCountLastTime+" find nodeCount somewhere delivered config in: "+JSON.stringify(config,null,2) );'
        txt += '      if ( nodeCountLastTime >= 1 ) {';
        txt += '         if (nodeCountLastTime!=nodeCountNow) {';
        txt += '             console.log("NEW NODE: HERE I LOCATION RELOAD(): nodeCountNow="+nodeCountNow+" nodeCountLastTime="+nodeCountLastTime );';
        txt += '             location.reload();';
        txt += '         }';
        txt += '      ';
        txt += '      }';
        txt += '         nodeCountLastTime=nodeCountNow;';
        txt += '   });';
        txt += "    setTimeout(fetchState,1000);";
        txt += "}";
        txt += "function getOWL(config,src,dst) { ";
        txt += "        for (var pulse in config.pulses) {";
        txt += "            var pulseEntry=config.pulses[pulse];"; //convenience
        txt += "            if (pulseEntry==null) {console.log('getOWL-could not find pulseEntry');return null;}"; //
        txt += "            if (pulseEntry.srcMint==dst) { "; //find receiver and check owls
        txt += '               var owls=pulseEntry.owls.split(",");';
        //txt += '              '
        txt += '               for (var owl in owls) {';
        txt += '                  var owlMint=owls[owl].split("=")[0];';
        txt += '                  var owl=owls[owl].split("=")[1];';
        txt += '                  if (typeof owl == "undefined") {return null;}';
        txt += '                  if (owlMint==src) {';
        //txt += '                     console.log("getOWL() FOUND: "+src+"-"+dst+"="+owl);'
        txt += '                     return parseInt(owl);';
        //txt += '                   console.log("src="+src+" to dst: "+dst+" pulseEntry.geo="+pulseEntry.geo+" pulseEntry.owl="+pulseEntry.owl);'
        txt += '                  }';
        txt += '               }';
        txt += '            }';
        txt += '       }';
        txt += "    return null;";
        txt += "}";
        txt += "function getOwls(configs,src,dst) { ";
        txt += "    var values=[];"; //receiver pulse tells us measured latency and median to it
        txt += '    if (typeof configs == "undefined" || configs==null ) return 0;';
        txt += "    for (var config in configs) {";
        txt += "        for (var pulse in configs[config].pulses) {";
        txt += "            var pulseEntry=configs[config].pulses[pulse];"; //convenience
        txt += "            if (pulseEntry.srcMint==dst) { "; //find receiver and check owls
        txt += '               var owls=pulseEntry.owls.split(",");';
        txt += '              ';
        txt += '               for (var owl in owls) {';
        txt += '                  var owlMint=owls[owl].split("=")[0];';
        txt += '                  var owl=owls[owl].split("=")[1];';
        txt += '                  if (typeof owl == "undefined") {';
        txt += '                     owl="";';
        txt += '                  }';
        txt += '                  if (owlMint==src) {';
        //txt += '                     console.log("getOWL() FOUND: "+src+"-"+dst+"="+owl);'
        txt += '                     values.push( parseInt(owl) );';
        //txt += '                   console.log("src="+src+" to dst: "+dst+" pulseEntry.geo="+pulseEntry.geo+" pulseEntry.owl="+pulseEntry.owl);'
        txt += '                  }';
        txt += '               }';
        txt += '            }';
        txt += "         }";
        txt += "    }";
        //txt += "    var median = values.sort() [ Math.round(values.length/2) ];"
        //txt += '    console.log("values="+JSON.stringify(values,null,2));'; //get middlish value
        txt += '    return values;';
        txt += "}";
        txt += "setTimeout(fetchState,1000);";
        txt += '</script> ';
        txt += '</head>';
        txt += '<body>';
        var insert = "";
        makeConfigAll(function (config) {
            //console.log(ts()+"config="+dump(config));
            var mintTable = config.mintTable;
            var pulses = config.pulses;
            var gSRlist = config.gSRlist;
            //for (var SR in config.gSRlist) {
            //    var entry=config.gSRlist[SR];
            //    console.log("config.gSRlist="+dump(entry));
            //}
            //
            //    Header
            //
            var mint1 = config.mintTable["mint:1"];
            var genesisIP = "";
            if (mint1)
                genesisIP = mint1.ipaddr;
            var genesisPort = "";
            if (mint1)
                genesisPort = mint1.port;
            if (me.isGenesisNode == "1")
                txt += '<h1>GENESIS NODE for pulseGroup <a href="http://' + me.ipaddr + ":" + me.port + '">' + me.geo + " (" + me.ipaddr + ":" + me.port + " ) </a>" + me.state + " " + me.version.split(".")[2];
            else
                txt += "<h1>" + me.geo + "(" + me.ipaddr + ":" + me.port + ") Wireguard 10.10.0." + me.mint + " " + me.state + " " + me.version + " under " + genesisIP + ":" + genesisPort;
            txt += "</h1>";
            if (me.adminControl)
                txt += "<h3>AdminControl: " + me.adminControl + "</h3>";
            txt += '<p id="dateTime">Updated: ' + dateTime + ' </p>';
            txt += '<p>Connect to this pulseGroup using: docker run -p ' + me.port + ":" + me.port + ' -p ' + me.port + ":" + me.port + "/udp -p 80:80/udp -v ~/wireguard:/etc/wireguard -e GENESIS=" + me.ipaddr + ' -e HOSTNAME=`hostname`  -e WALLET=auto -it williambnorton/darp:latest</p>';
            txt += '<input id = "btnBack" type="submit" value="<"/>';
            txt += '<input id = "btnSubmit" type="submit" value="Freeze"/>';
            txt += '<input id = "btnForward" type="submit" value=">"/>';
            txt += '<input id = "btnSubmit" type="submit" value="JOIN MY PULSEGROUP"/>';
            //         var OWLMatrix=getLiveMatrixTable();
            getMatrixTable(config, null, function (OWLMatrix) {
                //
                //   show OWL Matrix table
                //
                txt += '<br><h2>' + me.group + ' OWL Matrix for pulseGroup: ' + me.group + ' ACTIVE_INSTRUMENTATION:' + ACTIVE_INSTRUMENTATION + '</h2><table>';
                txt += '<tr><th></th>';
                var lastEntry = "";
                var count = 0;
                for (var row in pulses) {
                    lastEntry = pulses[row].geo + ":" + pulses[row].group;
                    count++;
                }
                //   print OWL headers
                for (var col in pulses) {
                    var colEntry = pulses[col];
                    //txt+='<th><a href="http://'+colEntry.ipaddr+":"+me.port+'/">'+colEntry.geo+":"+colEntry.srcMint+"</a></th>"
                    if (count <= 40)
                        txt += '<th><a target="_blank" href="http://' + colEntry.ipaddr + ":" + colEntry.port + '/">' + colEntry.geo + " <b>" + colEntry.srcMint + "<b></a> </th>";
                    else
                        txt += '<th><a target="_blank" href="http://' + colEntry.ipaddr + ":" + colEntry.port + '/">' + colEntry.srcMint + "</a></th>";
                }
                txt += "</tr>";
                //
                //   print OWL matrix
                //
                for (var row in pulses) {
                    var rowEntry = pulses[row];
                    var cellState = "RUNNING"; //unreachable     badkey   alert   
                    txt += '<tr><td><a target="_blank" href="http://' + rowEntry.ipaddr + ":" + rowEntry.port + '/">' + rowEntry.geo + " " + rowEntry.srcMint + '</a></td>'; //heacer on left side
                    for (var col in pulses) {
                        var colEntry = pulses[col]; //
                        var entryLabel = rowEntry.geo + "-" + colEntry.geo;
                        var owl = "";
                        cellState = rowEntry.state;
                        if ((typeof OWLMatrix[rowEntry.geo] != "undefined") &&
                            (typeof OWLMatrix[rowEntry.geo][colEntry.geo] != "undefined")) {
                            owl = OWLMatrix[rowEntry.geo][colEntry.geo];
                        }
                        txt += '<div class="fade-out"><td class="' + rowEntry.srcMint + "-" + colEntry.srcMint + '">' + '<a  target="_blank" href="http://' + me.ipaddr + ':' + me.port + '/graph?src=' + rowEntry.geo + '&dst=' + colEntry.geo + "&group=" + me.group + '" >' + owl + "ms</a>" + "</td></div>";
                    }
                    txt += "</tr>";
                }
                txt += "</table>";
                txt += "<p>Legend: Color highlights deviation from median (over last " + MAX_CONFIG_FRAMES + " seconds).</p><p>Background color shows Yellow " + YELLOW_TRIGGER + "% / Orange " + ORANGE_TRIGGER + "% / Red " + RED_TRIGGER + "% off the median.</p><p>GREEN border is intermediary >" + BETTER_THRESHOLD + "ms better than a direct path (border BLACK).</p></body></html>";
                //
                //  Externalize pulse structures 
                //
                txt += '<br><h2>' + me.group + ' pulseGroup' + '</h2><table>';
                txt += "<tr>";
                txt += "<th>geo</th>";
                txt += "<th>group</th>";
                txt += "<th>ipaddr</th>";
                txt += "<th>port</th>";
                txt += "<th>seq</th>";
                txt += "<th>pulseTimestamp</th>";
                txt += "<th>srcMint</th>";
                txt += "<th>owl</th>";
                //txt += "<th>median</th>"
                //txt+="<th>owls</th>"
                txt += "<th>inOctets</th>";
                txt += "<th>outOctets</th>";
                txt += "<th>inMsgs</th>";
                txt += "<th>outMsgs</th>";
                txt += "<th>pktDrops</th>";
                txt += "<th>pulseSz</th>";
                txt += "<th>owls</th>";
                txt += "<th>bootTimestamp</th>";
                txt += "<th>version</th>";
                txt += "<th>Wallet Balance</th>";
                txt += "</tr>";
                var total = 0; //Add up total balance of all pulses
                //console.log(ts()+"                            pulses="+dump(pulses));
                for (var a in pulses) {
                    var pulseEntry = pulses[a];
                    var srcMint = pulseEntry.srcMint;
                    //console.log(ts()+"a="+a+" pulseTable[pulseEntry]"+dump(pulseEntry));
                    //console.log("pulseEntry="+dump(pulseEntry));
                    txt += "<tr>";
                    //            txt+="<td>"+'<a href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/" >'+mintEntry.geo+"</a></td>"
                    txt += '<td class="' + pulseEntry.geo + ' ' + pulseEntry.srcMint + '">' + '<a href="http://' + pulseEntry.ipaddr + ':' + pulseEntry.port + '/" >' + pulseEntry.geo + '</a>' + "</td>";
                    //txt+="<td>"+pulseEntry.geo+"</td>"
                    txt += "<td >" + pulseEntry.group + "</td>";
                    txt += "<td> " + '<a target="_blank" href="http://' + pulseEntry.ipaddr + ':' + pulseEntry.port + '/me" >' + pulseEntry.ipaddr + "</a></td>";
                    txt += "<td>" + '<a target="_blank" href="http://' + pulseEntry.ipaddr + ':' + pulseEntry.port + '/state" >' + pulseEntry.port + "</a></td>";
                    txt += '<td class="' + pulseEntry.geo + '_seq"' + '>' + pulseEntry.seq + "</td>";
                    var deltaSeconds = Math.round((lib_1.now() - pulseEntry.pulseTimestamp) / 1000) + " secs ago";
                    if (pulseEntry.pulseTimestamp == 0)
                        deltaSeconds = "0";
                    //txt += "<td>" + now()+" "+entry.pulseTimestamp+ "</td>";
                    txt += '<td class="' + pulseEntry.geo + '_pulseTimestamp"' + '>' + deltaSeconds + "</td>";
                    //txt+="<td>"+pulseEntry.pulseTimestamp+"</td>"
                    txt += "<td>" + pulseEntry.srcMint + "</td>";
                    // OWL
                    txt += '<td class="' + pulseEntry.geo + '_owl fade-out"' + '>' + '<a  target="_blank" href="http://' + me.ipaddr + ':' + me.port + '/graph?src=' + pulseEntry.geo + '&dst=' + me.geo + "&group=" + me.group + '" >' + pulseEntry.owl + "</a> ms</td>";
                    //txt += '<td class="'+pulseEntry.geo+'_median"'+'>' + pulseEntry.median + "</td>"
                    //txt+="<td>"+pulseEntry.owls+"</td>"
                    txt += '<td class="' + pulseEntry.geo + '_inOctets"' + '>' + pulseEntry.inOctets + "</td>";
                    txt += '<td class="' + pulseEntry.geo + '_outOctets"' + '>' + pulseEntry.outOctets + "</td>";
                    txt += '<td class="' + pulseEntry.geo + '_inMsgs"' + '>' + pulseEntry.inMsgs + "</td>";
                    txt += '<td class="' + pulseEntry.geo + '_outMsgs"' + '>' + pulseEntry.outMsgs + "</td>";
                    //var pktLoss=parseInt(pulseEntry.seq)-parseInt(pulseEntry.inMsgs);
                    //console.log("pktloss=:"+pktLoss);
                    if (pulseEntry.pktDrops > 1)
                        txt += '<td class="' + pulseEntry.geo + '_pktDrops WARNING"' + '>' + pulseEntry.pktDrops + "</td>";
                    else
                        txt += '<td class="' + pulseEntry.geo + '_pktDrops "' + '>' + pulseEntry.pktDrops + "</td>";
                    if (pulseEntry.lastMsg) {
                        txt += "<td>" + pulseEntry.lastMsg.length + "</td>"; //pulse size
                        txt += '<td class="' + pulseEntry.geo + '_owls"' + '>' + pulseEntry.owls.substring(0, 20) + "</td>";
                        //txt += "<td>" + pulseEntry.lastMsg.substring(0,50) + "</td>"
                    }
                    else {
                        txt += "<td>" + "" + "</td>";
                        txt += "<td>" + "" + "</td>";
                    }
                    var deltaSeconds2 = Math.round((lib_1.now() - pulseEntry.bootTimestamp) / 1000) + " secs ago";
                    if (pulseEntry.bootTimestamp == 0)
                        deltaSeconds2 = "0";
                    //txt += "<td>" + now()+" "+entry.pulseTimestamp+ "</td>";
                    txt += '<td class="' + pulseEntry.geo + '_bootTimestamp"' + '>' + deltaSeconds2 + "</td>";
                    txt += '<td class="' + pulseEntry.geo + '_version"' + '>' + pulseEntry.version + "</td>";
                    var balance = (Math.min(parseInt(pulseEntry.inOctets), parseInt(pulseEntry.outOctets)) / (1000000 * 1000)) * .5; //GB=1000 MB @ 50 cents per
                    total = total + balance;
                    txt += '<td class="' + pulseEntry.geo + '_balance"' + '> $' + balance.toFixed(6) + "</td>";
                    //txt+="<td>"+pulseEntry.lastMsg+"</td>"
                    txt += "</tr>";
                }
                txt += '<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td>Node Total Earnings $' + total.toFixed(6) + '</td></tr>';
                txt += "</table>";
                //
                //  Externalize mintTable 
                //
                //console.log(ts()+"config.mintTable="+dump(config.mintTable));
                txt += '<br><h2>mintTable</h2><table>';
                txt += "<tr>";
                txt += "<th>mint</th>";
                txt += "<th>geo</th>";
                txt += "<th>port</th>";
                txt += "<th>ipaddr</th>";
                txt += "<th>publickey</th>";
                txt += "<th>state</th>";
                txt += "<th>pulseTimestamp</th>";
                txt += "<th>version</th>";
                txt += "<th>wallet</th>";
                //txt+="<th>S</th>"
                txt += "<th>owl</th>";
                //txt+="<th>G</th>"
                //<th>rtt</th>"
                txt += "<th>CONTROLS</th>";
                txt += "<th>adminControl</th>";
                txt += "<th>bootTimestamp</th>";
                txt += "</tr>";
                //console.log(ts()+"                            mintTable="+dump(mintTable));
                for (var a in mintTable) {
                    var mintEntry = mintTable[a];
                    //console.log(ts()+"a="+a+" mintEntry"+dump(mintEntry));
                    txt += "<tr>";
                    //txt+="<td>"+mintEntry+"</td>"
                    txt += "<td>" + mintEntry.mint + "</td>";
                    txt += '<td class="' + mintEntry.state + '">' + '<a target="_blank" href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/" >' + mintEntry.geo + "</a></td>";
                    txt += "<td>" + mintEntry.port + "</td>";
                    txt += "<td>" + '<a target="_blank" href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/me" >' + mintEntry.ipaddr + "</a></td>";
                    txt += "<td>" + mintEntry.publickey.substring(0, 3) + "..." + mintEntry.publickey.substring(40, mintEntry.publickey.length) + "</td>";
                    txt += '<td class="' + mintEntry.geo + '_state' + ' ' + mintEntry.state + '">' + '<a target="_blank" href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/state" >' + mintEntry.state + '</a>' + "</td>";
                    //                   txt += "<td>" + '<a href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/config" >' + mintEntry.state + '</a>' + "</td>"
                    //var deltaT = Math.round((now() - mintEntry.pulseTimestamp) / 1000) + " secs ago";
                    //if (mintEntry.pulseTimestamp == 0) deltaT = "0";
                    //txt += '<td class="'+mintEntry.geo+'_pulseTimestamp"'+'">' + deltaT + "</td>";
                    var deltaSeconds = Math.round((lib_1.now() - mintEntry.pulseTimestamp) / 1000) + " secs ago";
                    if (mintEntry.pulseTimestamp == 0)
                        deltaSeconds = "0";
                    //txt += "<td>" + now()+" "+entry.pulseTimestamp+ "</td>";
                    txt += '<td class="' + mintEntry.geo + '_pulseTimestamp"' + '>' + deltaSeconds + "</td>";
                    //txt+="<td>"+mintEntry.bootTimestamp+"</td>"
                    txt += "<td>" + '<a target="_blank" href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/version" >' + mintEntry.version + "</a></td>";
                    txt += "<td>" + mintEntry.wallet.substring(0, 3) + "..." + mintEntry.wallet.substring(40, mintEntry.wallet.length) + "</td>";
                    //txt+="<td>"+mintEntry.SHOWPULSES+"</td>"
                    //txt += "<td>" + mintEntry.owl + " ms</td>"
                    txt += '<td class="' + mintEntry.geo + '_owl fade-out"' + '>' + '<a target="_blank" href="http://' + me.ipaddr + ':' + me.port + '/graph?src=' + mintEntry.geo + '&dst=' + me.geo + "&group=" + me.group + '" >' + mintEntry.owl + "</a> ms</td>";
                    //txt+="<td>"+mintEntry.isGenesisNode+"</td>"
                    //            txt+="<td>"+mintEntry.rtt+"</td>"
                    var stopButtonURL = "http://" + mintEntry.ipaddr + ":" + mintEntry.port + "/stop";
                    var rebootButtonURL = "http://" + mintEntry.ipaddr + ":" + mintEntry.port + "/reboot";
                    var reloadButtonURL = "http://" + mintEntry.ipaddr + ":" + mintEntry.port + "/reload";
                    var SINGLESTEPButtonURL = "http://" + mintEntry.ipaddr + ":" + mintEntry.port + "/SINGLESTEP";
                    var pulseMsgButtonURL = "http://" + mintEntry.ipaddr + ":" + mintEntry.port + "/pulseMsg";
                    txt += "<td>" + '<FORM>';
                    txt += '<INPUT Type="BUTTON" Value="PULSE1" Onclick="window.location.href=\'' + pulseMsgButtonURL + "'" + '">';
                    txt += '<INPUT Type="BUTTON" Value="RELOAD" Onclick="window.location.href=\'' + reloadButtonURL + "'" + '">';
                    txt += '<INPUT Type="BUTTON" Value="SINGLESTEP" Onclick="window.location.href=\'' + SINGLESTEPButtonURL + "'" + '">';
                    txt += '<INPUT Type="BUTTON" Value="STOP" Onclick="window.location.href=\'' + stopButtonURL + "'" + '">';
                    txt += '<INPUT Type="BUTTON" Value="REBOOT" Onclick="window.location.href=\'' + rebootButtonURL + "'" + '">';
                    txt += '</FORM>' + "</td>";
                    if (mintEntry.adminControl)
                        txt += "<td>" + mintEntry.adminControl + "</td>";
                    else
                        txt += "<td>" + "</td>";
                    //var delta = Math.round((now() - mintEntry.bootTimestamp) / 1000) + " secs ago";
                    //if (pulseEntry.bootTimestamp == 0) delta = "0";
                    //txt += '<td class="'+pulseEntry.geo+'_bootTimestamp"'+'">' + delta + "</td>";
                    var deltaSeconds2 = Math.round((lib_1.now() - mintEntry.bootTimestamp) / 1000) + " secs ago";
                    if (mintEntry.bootTimestamp == 0)
                        deltaSeconds2 = "0";
                    //txt += "<td>" + now()+" "+entry.pulseTimestamp+ "</td>";
                    txt += '<td class="' + mintEntry.geo + '_bootTimestamp"' + '>' + deltaSeconds2 + "</td>";
                    txt += "</tr>";
                }
                txt += "</table>";
                //
                //  Externalize gSRlist Directory
                //
                txt += '<br><h2>gSRlist</h2><table>';
                txt += "<tr><th>pulse</th><th>mint</th></tr>";
                for (var entry in gSRlist) {
                    var mint = gSRlist[entry].split("_")[1];
                    var gEntryLabel = gSRlist[entry].split("_")[0];
                    //console.log(ts()+"mint="+mint);
                    txt += '<tr><td><a target="_blank" href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/" >' + mint + "</a></td><td><a>" + gEntryLabel + "</a></td></tr>";
                }
                txt += "</table>";
                res.setHeader('Content-Type', 'text/html');
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.end(txt + "<p>Legend: Color is deviation from median (last " + MAX_CONFIG_FRAMES + " seconds) Yellow/Orange/Red: " + YELLOW_TRIGGER + "% /" + ORANGE_TRIGGER + "% /" + RED_TRIGGER + "% . GREEN border is a preferred path for relaying instead of a direct path with border BLACK.</p></body></html>"); //
                return;
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
    makeConfigAll(function (config) {
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
    //console.log("fetching '/' ");
    handleShowState(req, res);
    return;
});
//
//  TODO: require parm of geo&mint# - authenticate by checking against our mint:# and geo for that mint 
//
app.get('/mint/:mint', function (req, res) {
    //console.log("fetching '/mint' state");
    //if mint:n lookup shows geo==parm and inMsgs>0 mark him UP
    expressRedisClient.hgetall("mint:" + req.params.mint, function (err, mintEntry) {
        res.end(JSON.stringify(mintEntry, null, 2));
        return;
    });
});
//
// used by members to see if SW needs updating -
// This also serves to retrieve members that we lost from reboot
//
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
app.get('/mintStack', function (req, res) {
    //console.log("EXPRess wbn fetching '/config' ");
    console.log("app.get(/mintStack=" + lib_1.dump(mintStack));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify(mintStack, null, 2));
    return;
});
app.get('/stop', function (req, res) {
    //console.log("EXPRess fetching '/state' state");
    console.log("EXITTING and Stopping the node");
    expressRedisClient.hset("mint:0", "adminControl", "STOP"); //handlepulse will exit 86
    res.redirect(req.get('referer'));
});
app.get('/reboot', function (req, res) {
    //console.log("EXPRess fetching '/state' state");
    console.log("/reboot: THIS SHOULD KICK YOU OUT OF DOCKER");
    expressRedisClient.hset("mint:0", "adminControl", "REBOOT"); //handlepulse will exit 86
    res.redirect(req.get('referer'));
});
app.get('/reload', function (req, res) {
    //console.log("EXPRess fetching '/state' state");
    console.log("EXITTING to reload the system");
    expressRedisClient.hset("mint:0", "adminControl", "RELOAD"); //handlepulse will exit 36
    res.redirect(req.get('referer'));
});
app.get('/config', function (req, res) {
    console.log("EXPRess wbn fetching '/config' ");
    makeConfigAll(function (config) {
        //console.log("app.get(/config =" + dump(config));
        res.setHeader('Content-Type', 'application/json');
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify(config, null, 2));
    });
    return;
});
/** does not work - intention to provide all launch scripts from genesis node
app.get('/forever', function(req, res) {
    //console.log("EXPRess fetching '/state' state");
    var fs=require("fs");
    var script=fs.readFile("/root/darp/express/dockerWatch.bash", function(err,script) {
        console.log("script=:"+script);
        res.end(script);
    })
    return;
 });
**/
app.get('/state', function (req, res) {
    //console.log("EXPRess fetching '/state' state");
    makeConfigAll(function (config) {
        //console.log("app.get('/state' callback config="+dump(config));
        res.setHeader('Content-Type', 'application/json');
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify(config, null, 2));
    });
    return;
});
app.get('/asset-manifest.json', function (req, res) {
    //console.log("EXPRess fetching '/state' state");
    //console.log("app.get('/state' callback config="+dump(config));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify({}, null, 2));
    return;
});
app.get('/graph', function (req, res) {
    console.log("EXPRess request for '/graph' ");
    //makeConfig(function(config) {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader("Access-Control-Allow-Origin", "*");
    handleGraph(req, res);
    //})
    return;
});
//
//      handleGraph() - show a graph of the collected data
//          note - SRC and DST are the ints active at the time of the pulseGroup
//
function handleGraph(req, res) {
    expressRedisClient.hgetall("mint:0", function (err, me) {
        //this should better be done using parm parser of express - passed in
        var DST = me.geo; //set defaults
        var group = me.group; //set defaults
        var SRC = "MAZUAE";
        var ary = req.url.split("?");
        if (ary.length > 1) {
            //console.log("ary length="+ary.length);
            var params = ary[1].split("&");
            if (params.length > 1) {
                //console.log("paramslength="+ary.length+" params="+params[0]+params[1]);   //     this needs redsign
                for (var i = 0; i < params.length; i++) {
                    var leftSide = params[i].split("=")[0];
                    var rightSide = params[i].split("=")[1];
                    switch (leftSide) {
                        case 'src':
                            SRC = rightSide;
                            break;
                        case 'dst':
                            DST = rightSide;
                            break;
                        case 'srcMint':
                            SRC = rightSide;
                            break;
                        case 'dstMint':
                            console.log("handleGraph: SRC=" + SRC + " DST=" + rightSide);
                            expressRedisClient.hgetall("mint:" + rightSide, function (err, destMintEntry) {
                                expressRedisClient.hgetall("mint:" + SRC, function (err, srcMintEntry) {
                                    if (destMintEntry && srcMintEntry) {
                                        SRC = srcMintEntry.geo;
                                        DST = destMintEntry.geo;
                                        console.log("handleGraph: SRC=" + SRC + " DST=" + DST + " about to graph");
                                        grapher(res, SRC, DST);
                                    }
                                });
                            });
                            break;
                    }
                }
            }
        }
        //------------------ SRC and DST are geos    ------------------------------------------
        //return grapher(res,SRC,DST);
    });
}
function grapher(res, SRC, DST) {
    var txt = '';
    txt += '<!DOCTYPE HTML> <html><head title="DARP">';
    txt += '<script src="https://canvasjs.com/assets/script/canvasjs.min.js">';
    txt += '</script>';
    txt += '  <script> window.onload = function () { ';
    //var contents=fs.readFile('canvasjs.min.js', 'utf8');
    //txt+=contents;
    try {
        //lrange all values from redis for srcMint to DstMint
        //expressRedisClient.hgetall("mint:"+SRC, function(err, srcEntry) {
        //expressRedisClient.hgetall("mint:"+DST, function(err, dstEntry) {
        //if (srcEntry!=null && dstEntry!=null) {
        txt += 'var chart = new CanvasJS.Chart("chartContainer", { animationEnabled: true, theme: "light2", title:{ text: "' + SRC + "-" + DST + " " + lib_1.YYMMDD() + '" }, axisY:{ includeZero: false }, data: [{        type: "line",       dataPoints: [ ';
        expressRedisClient.lrange(DST + "-" + SRC, -1 * 60 * 60, -1, function (err, samples) {
            //console.log("EXPRESS: DumpSamples:"+dump(samples));                   
            for (var sample in samples) {
                txt += samples[sample];
            }
            //console.log(ts()+"redis for /graph data request reply="+dump(samples));
            txt += '] }] }); chart.render(); } </script> </head> <body> <div id="chartContainer" style="height: 500px; width: 100%;"></div></body> </html>';
            console.log(lib_1.ts() + "EXPRESS GRAPHER showed graph: ");
            //txt += "<p><a href=" + 'http://' + me.ipaddr + ':' + me.port + '>Back</a></p></body></html>';
            res.end(txt);
        });
        //}
        //});
        //});
    }
    catch (err) {
        console.error(err);
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
app.get('/SINGLESTEP', function (req, res) {
    expressRedisClient.hgetall("mint:0", function (err, me) {
        expressRedisClient.hmset("mint:" + me.mint, {
            state: "SINGLESTEP",
            SHOWPULSES: "0"
        });
        expressRedisClient.hmset("mint:0", {
            state: "SINGLESTEP",
            SHOWPULSES: "0"
        });
        console.log(lib_1.ts() + "pulsed - Now in SINGLESTEP state - no pulsing and show no one's pulses");
        console.log(lib_1.ts() + "SINGLESTEP SINGLESTEP SINGLESTEP SINGLESTEP state - ");
        //      res.redirect('http://'+me.ipaddr+":"+me.port+"/");
        res.redirect(req.get('referer'));
    });
});
//
//
//
app.get('/pulseMsg', function (req, res) {
    expressRedisClient.hgetall("mint:0", function (err, me) {
        expressRedisClient.hmset("mint:0", {
            adminControl: "PULSE",
            SHOWPULSES: "1"
        });
        console.log(lib_1.ts() + "pulse(1) somehow here");
        console.log(lib_1.ts() + "One time PULSE SENT");
        //res.redirect('http://'+me.ipaddr+":"+me.port+"/");
        res.redirect(req.get('referer'));
        //res.end('<meta http-equiv="refresh" content="1;url=http://'+me.ipaddr+":"+me.port+'/ />');
    });
});
//
// nodeFactory
//       Configuration for node - allocate a mint
//
app.get('/nodefactory', function (req, res) {
    console.log(lib_1.ts() + "NODEFACTORY");
    expressRedisClient.hgetall("mint:0", function (err, me) {
        if (me != null) {
            console.log('EXPRESS nodeFactory: config requested with params: ' + lib_1.dump(req.query));
            //console.log("EXPRESS geo="+req.query.geo+" publickey="+req.query.publickey+" query="+JSON.stringify(req.query,null,2)+" port="+req.query.port+" wallet="+req.query.wallet+" version="+req.query.version);
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
            // On Startup, only accept connections from me, and the test is that we have matching publickeys
            console.log(lib_1.ts() + "EXPRESS: mintStack=" + mintStack + " publickey=" + publickey + " me.publickey=" + me.publickey);
            console.log("EXPRESS: Received connection request from " + geo + "(" + incomingIP + ")");
            if ((mintStack == 1 && (publickey == me.publickey)) || (mintStack != 1)) { //check publickey instead!!!!!
                if (geo == "NORTONDARP") {
                    //console.log(ts()+"Filtering"); //this will eventually be a black list or quarentine group
                }
                else {
                    provisionNode(mintStack++, geo, port, incomingIP, publickey, version, wallet, incomingTimestamp, function (config) {
                        console.log(lib_1.ts() + "EXPRESS nodeFactory sending config=" + lib_1.dump(config));
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(config)); //send mint:0 mint:1 *mint:N groupEntry *entryN
                    });
                }
            }
            //} else console.log("EXPRESS: Received pulse from "+geo+"("+incomingIP+") before my genesis node was set up. IGNORING.");
        }
        else
            console.log("EXPRESS has no me out of redis");
    });
});
//
// mkeConfig() - Make a config structure - limited to genesis and new node attempting to connect
//          Once new node starts pulsing, genesis node will respond to mint requests
//             config {
//                gSRlist {
//                pulses {
//                mintTable{
//
function makeConfig(callback) {
    expressRedisClient.hgetall("mint:0", function (err, me) {
        expressRedisClient.hgetall("gSRlist", function (err, gSRlist) {
            //console.log("makeConfig(): "+process.env.VERSION+" gSRlist="+dump(gSRlist));
            fetchConfig(gSRlist, null, function (config) {
                //console.log("getConfig(): callback config="+dump(config));
                callback(config); //call sender
            });
        });
    });
}
//
// mkeConfigALL() - Make a config structure complete:
//             config {
//                gSRlist {
//                pulses {
//                mintTable{
//
function makeConfigAll(callback) {
    expressRedisClient.hgetall("mint:0", function (err, me) {
        expressRedisClient.hgetall("gSRlist", function (err, gSRlist) {
            //console.log("makeConfigAll():  gSRlist="+dump(gSRlist));
            fetchConfigAll(gSRlist, null, function (config) {
                //console.log("getConfig(): callback config="+dump(config));
                callback(config); //call sender
            });
        });
    });
}
//
// fetchConfigAll() - recurcive
//
function fetchConfigAll(gSRlist, config, callback) {
    if (typeof config == "undefined" || config == null) {
        //console.log(ts()+"fetchConfig(): STARTING ECHO: gSRlist="+dump(gSRlist)+" config="+dump(config)+" ");
        var sortedGSRlist = new Array();
        var allStack = [];
        for (var sEntryLabel in gSRlist) {
            if (parseInt(gSRlist[sEntryLabel]) < 10)
                gSRlist[sEntryLabel] = "0" + gSRlist[sEntryLabel];
            allStack.push(gSRlist[sEntryLabel] + "_" + sEntryLabel);
        }
        allStack.sort(); //TODO: This should be done using sorted redis list
        //console.log("fetchConfigAll(): nodeCount="+allStack.length);
        //we need srlist to be an array of objects we can sort
        // { "mint" : mint, "entryLabel" : entryLabel }
        // sort(compareBy('mint'))
        //console.log("allStack: "+dump(allStack));
        config = {
            //gSRlist: gSRlist,
            nodeCount: allStack.length,
            gSRlist: allStack,
            mintTable: {},
            pulses: {},
            entryStack: new Array(),
            ts: "" + lib_1.now()
        };
        for (var index in allStack) {
            //        for (var index in sortedGSRlist) {
            //console.log("pushing "+index);
            config.entryStack.unshift({
                "entryLabel": allStack[index].split("_")[1],
                "mint": allStack[index].split("_")[0]
                //entryLabel: index,
                //mint: gSRlist[index]
            });
        }
        //console.log("fetchConfigAll entryStack="+dump(config.entryStack));
    }
    //Whether first call or susequent, pop entries until pop fails
    var entry = config.entryStack.pop();
    //console.log("EXPRESS() popped entry="+dump(entry));
    if (entry) {
        var mint = parseInt(entry.mint);
        var entryLabel = entry.entryLabel;
        expressRedisClient.hgetall("mint:" + mint, function (err, mintEntry) {
            if (err)
                console.log("ERROR: mintEntry=" + mintEntry);
            if (mintEntry != null) {
                config.mintTable["mint:" + mintEntry.mint] = mintEntry; //set the mintEntry-WORKING
                //console.log("EXPRESS() mint="+mint+" mintEntry="+dump(mintEntry)+" config="+dump(config)+" entryLabel="+entryLabel);
                //                       MAZORE:DEVOPS.1
                var pulseEntryLabel = mintEntry.geo + ":" + mintEntry.group;
                //console.log(ts()+"*************fetchConfigAll got mint "+mintEntry.mint+" now fetching "+pulseEntryLabel);
                expressRedisClient.hgetall(pulseEntryLabel, function (err, pulseEntry) {
                    if (err)
                        console.log(lib_1.ts() + "ERROR fetching pulseEntry");
                    var pulseEntryLabel = pulseEntry.geo + ":" + pulseEntry.group;
                    //console.log(ts()+"**************fetchConfigAll pulseEntryLabel="+pulseEntryLabel+" pulseEntry="+dump(pulseEntry));
                    config.pulses[pulseEntryLabel] = pulseEntry; //set the corresponding mintTable
                    //console.log("EXPRESS() fetchConfigAll RECURSING entryLabel="+entryLabel+" pulseEntry="+dump(pulseEntry)+" config="+dump(config));
                    fetchConfigAll(gSRlist, config, callback); //recurse until we hit bottom
                });
            }
            else {
                console.log("EXPRESS: can't find mint entry: " + mint + " timeout?");
            }
        });
    }
    else {
        delete config.entryStack;
        //console.log(ts()+"fetchConfig(): returning "+dump(config));
        callback(config); //send the config atructure back
    }
}
//
// Fills ofig structure with gSRlist and all associated mints and pulseEnries
//
function fetchConfig(gSRlist, config, callback) {
    if (typeof config == "undefined" || config == null) {
        //console.log(ts()+"fetchConfig(): STARTING ECHO: gSRlist="+dump(gSRlist)+" config="+dump(config)+" ");
        config = {
            gSRlist: gSRlist,
            mintTable: {},
            pulses: {},
            entryStack: new Array(),
            ts: "" + lib_1.now()
        };
        for (var index in gSRlist) {
            //console.log("pushing "+index);
            //config.entryStack.push({ entryLabel:index, mint:gSRlist[index]})
            config.entryStack.unshift({
                entryLabel: index,
                mint: gSRlist[index]
            });
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
                if (pulseEntry) {
                    config.pulses[pulseEntry.geo + ":" + pulseEntry.group] = pulseEntry; //set the corresponding mintTable
                    //config.pulses[entryLabel] = pulseEntry;  //set the corresponding mintTable
                    //console.log("EXPRESS() RECURSING entryLabel="+entryLabel+" pulseEntry="+dump(pulseEntry)+" config="+dump(config));
                    fetchConfig(gSRlist, config, callback); //recurse until we hit bottom
                }
                else {
                    console.log("EXPRESS: " + entryLabel + " does not exist - probably timed out - maybe should remove it from gSRlist too");
                }
            });
        });
    }
    else {
        delete config.entryStack;
        //console.log(ts()+"fetchConfig(): returning "+dump(config));
        callback(config); //send the config atructure back
    }
}
function makeMintEntry(mint, geo, group, port, incomingIP, publickey, version, wallet, incomingTimestamp) {
    return {
        "mint": "" + mint,
        "geo": geo,
        "group": group,
        // wireguard configuration details
        "port": "" + port,
        "ipaddr": incomingIP,
        "publickey": publickey,
        "state": DEFAULT_START_STATE,
        "bootTimestamp": "" + incomingTimestamp,
        "version": version,
        "wallet": wallet,
        "SHOWPULSES": DEFAULT_SHOWPULSES,
        "owl": "",
        "pulseTimestamp": "0",
        "isGenesisNode": (mint == 1) ? "1" : "0",
        "rtt": "" + (lib_1.now() - incomingTimestamp) //=latency + clock delta between pulser and receiver  /** DO NOT NEED */
    };
}
//
//  pulseEntry - contains stats for and relevent fields to configure wireguard
//
function makePulseEntry(mint, geo, group, ipaddr, port, incomingTimestamp, version) {
    return {
        "geo": geo,
        "group": group,
        "ipaddr": ipaddr,
        "port": port,
        //version would go here
        //ttl might be needed for relaying
        "seq": "0",
        "pulseTimestamp": "0",
        "srcMint": "" + mint,
        "owl": "",
        "owls": "1",
        // stats
        "bootTimestamp": "" + incomingTimestamp,
        "version": version,
        "inOctets": "0",
        "outOctets": "0",
        "inMsgs": "0",
        "outMsgs": "0",
        "pktDrops": "0",
        "lastMsg": ""
    };
}
//
// For Genesis node, create
//       mint:0 mint:1 genesisGeo:genesisGroup & add to gSRlist
// For Non-Genesis, create
//
//       mint:0 mint:1 *mint:N genesisGeo:genesisGroup *geoN:genesisGroup and update gSRlist and genesis OWLs
//                         '*' means for non-Genesis nodes
//                         
function provisionNode(newMint, geo, port, incomingIP, publickey, version, wallet, incomingTimestamp, callback) {
    //console.log(ts()+"provisionNode(): newMint="+newMint+" geo="+geo);
    expressRedisClient.hgetall("mint:1", function (err, mint1) {
        //create mint and entry as if this was the genesis node
        var mint0 = makeMintEntry(newMint, geo, geo + ".1", port, incomingIP, publickey, version, wallet, incomingTimestamp);
        if (newMint == 1) {
            expressRedisClient.hmset("mint:0", mint0, function (err, reply) {
                expressRedisClient.hmset("mint:1", mint0, function (err, reply) {
                    var mint1 = mint0; //make a copy for readaibility
                    var genesisPulseGroupEntry = makePulseEntry(newMint, geo, geo + ".1", mint0.ipaddr, mint0.port, incomingTimestamp, version);
                    expressRedisClient.hmset(mint1.geo + ":" + mint1.group, genesisPulseGroupEntry, function (err, reply) {
                        expressRedisClient.hmset("gSRlist", mint1.geo + ":" + mint1.group, "1", function (err, reply) {
                            //makeConfig(function(config) {
                            makeConfig(function (config) {
                                //console.log(ts()+"makeConfig");
                                config.mintTable["mint:0"] = mint0; //    Install this new guy's mint0 into config
                                config.rc = "0";
                                config.isGenesisNode = "1";
                                config.ts = lib_1.now(); //give other side a notion of my clock when I sent this
                                //config.isGenesisNode=(config.mintTable["mint:0"].mint==1)
                                console.log(lib_1.ts() + "EXPRESS:  Sending GENESIS NODE config:" + lib_1.dump(config));
                                callback(config); //parent routine's callback
                            });
                        });
                    }); //Create GENESIS GroupEntry:DEVOPS:DEVOPS.1
                }); //mint:1 is always the GENESIS NODE
            }); //mint:0 always is "me" we are GENESIS NODE
        }
        else {
            expressRedisClient.hgetall("mint:0", function (err, mint0) {
                expressRedisClient.hgetall("mint:1", function (err, mint1) {
                    var mint1 = mint0; //make a copy for readaibility
                    expressRedisClient.hgetall(mint1.geo + ":" + mint1.group, function (err, genesisGroupEntry) {
                        expressRedisClient.hgetall("gSRlist", function (err, gSRlist) {
                            var mintN = makeMintEntry(newMint, geo, mint1.group, port, incomingIP, publickey, version, wallet, incomingTimestamp);
                            expressRedisClient.hmset("mint:" + newMint, mintN, function (err, reply) {
                                var newNodePulseEntry = makePulseEntry(newMint, geo, mint1.group, incomingIP, port, incomingTimestamp, version);
                                expressRedisClient.hmset(geo + ":" + mint1.group, newNodePulseEntry, function (err, reply) {
                                    expressRedisClient.hmset("gSRlist", geo + ":" + mint1.group, "" + newMint, function (err, reply) {
                                        genesisGroupEntry.owls = genesisGroupEntry.owls + "," + newMint;
                                        expressRedisClient.hmset(mint1.geo + ":" + mint1.group, "owls", genesisGroupEntry.owls); //wbn
                                        /* wbn
                                        
                                                                               var config = {
                                                                                   gSRlist: {
                                                                                       [mint1.geo + ":" + mint1.group]: "1",
                                                                                       [geo + ":" + mint1.group]: "" + newMint
                                                                                   },
                                                                                   mintTable: {
                                                                                       "mint:0": mintN, //you are mintN
                                                                                       "mint:1": mint1, //genesis group
                                                                                       ["mint:" + newMint]: mintN //and the actual pulse
                                                                                   },
                                                                                   pulses: {
                                                                                       [mint1.geo + ":" + mint1.group]: genesisGroupEntry,
                                                                                       [geo + ":" + mint1.group]: newNodePulseEntry
                                                                                   },
                                                                                   rc: "0",
                                                                                   isGenesisNode: "0",
                                                                                   ts: "" + now()
                                                                               }
                                        */
                                        makeConfigAll(function (config) {
                                            //console.log("EXPRESS(): makeConfigAll gave us config="+dump(config));
                                            /*
                                                                                        var sortedGSRlist=new Array();
                                                                                        var allStack=[];
                                                                                        for (var sEntryLabel in config.gSRlist) {
                                                                                            var mint      =config.gSRlist[sEntryLabel].split("_")[0];
                                                                                            var entryLabel=config.gSRlist[sEntryLabel].split("_")[1];
                                                                                            allStack.push( { [entryLabel] : mint } );
                                                                                        }
                                                                                        config.gSRlist=allStack.sort(); //TODO: This should be done using sorted redis list
                                            
                                                                                                    //replaces this next bit
                                            
                                            
                                                                                        var old_gSRlist=config.gSRlist;
                                                                                        for (var g in old_gSRlist) {
                                                                                            var entry=old_gSRlist[g];
                                                                                            var myMint=parseInt(entry.split("_")[0]);
                                                                                            var pulseLabel=entry.split("_")[1];
                                                                                            console.log("myMint="+myMint+" pulseLabel="+pulseLabel);
                                                                                            config.gSRlist[ pulseLabel ] = "" + myMint ;    //get rid of leading 0
                                                                                            //config.gSRlist[ gGeo + ":" + mint1.group ] = "1";
                                                                                        }
                                                                                        //config.gSRlist={[new_gSRlist]};
                                            
                                            */
                                            //console.log("EXPRESS(): STARTING WITH config.gSRlist="+config.gSRlist);
                                            //console.log(ts()+"makeConfig now replaces genesis node info with mint0");
                                            config.mintTable["mint:0"] = mintN; //    Install this new guy's mint0 into config
                                            config.mintTable["mint:1"] = mint1;
                                            config.mintTable["mint:" + newMint] = mintN; //    Install this new guy's mint0 into config
                                            config.pulses[mint1.geo + ":" + mint1.group] = genesisGroupEntry;
                                            config.pulses[geo + ":" + mint1.group] = newNodePulseEntry;
                                            config.rc = "0";
                                            config.isGenesisNode = "0";
                                            config.ts = "" + lib_1.now();
                                            //config.ts = now(); //give other side a notion of my clock when I sent this
                                            //config.isGenesisNode=(config.mintTable["mint:0"].mint==1)
                                            console.log(lib_1.ts() + "EXPRESS:  Sending NON-GENESIS config:" + lib_1.dump(config));
                                            wireguard_1.setWireguard();
                                            //console.log("EXPRESS(): about to launch config="+dump(config));
                                            callback(config); //parent routine's callback
                                        });
                                        //console.log(ts()+"newMint="+newMint+" "+dump(config));
                                        //wbn                                       expressRedisClient.hmset(mint1.geo + ":" + mint1.group, "owls", genesisGroupEntry.owls);
                                        //expressRedisClient.hmset(geo+":"+mint1.group, "owls",genesisGroupEntry.owls);
                                        //wbn                                       setWireguard();  //new mint so add the mint to our GENESIS wireguard config
                                        //wbn                                       callback(config);
                                        /*
                                        makeConfig(function (config) {
 
                                           console.log(ts()+"makeConfig");
                                           config.mintTable["mint:0"]=mint0;  //    Install this new guy's mint0 into config
                                           config.rc="0";
                                           config.ts=now();  //give other side a notion of my clock when I sent this
                                           //config.isGenesisNode=(config.mintTable["mint:0"].mint==1)
                                           console.log(ts()+"EXPRESS:  Sending config:"+dump(config));
                                           callback(config);   //parent routine's callback
                                        })
                                        */
                                    });
                                });
                            });
                        });
                    }); //Create GENESIS GroupEntry:DEVOPS:DEVOPS.1
                }); //mint:1 is always the GENESIS NODE
            }); //mint:0 always is "me" we are GENESIS NODE
        }
        //if (newMint==1) expressRedisClient.hmset("mint:1",mint0); //mint:1 is always the GENESIS NODE
        //if (newMint==1) expressRedisClient.hmset(mint1.geo+":"+mint1.group,mint1); //Create GENESIS GroupEntry:DEVOPS:DEVOPS.1
        //if (newMint==1) expressRedisClient.hmset("gSRlist",mint1.geo+":"+mint1.group,"1"); //Add our Genesis Group Entry to the gSRlist
        /**
              //      "isGenesisNode" : "1",
              var mintN=makeMintEntry( newMint,geo,geo+".1",port,incomingIP,publickey,version,wallet, incomingTimestamp )
 
              if (mint1==null) {         //  GENESIS NODE BEING FORMED -
                 console.log(ts()+"SETTING OURSELVES UP AS GENESIS NODE");
 
                 mint1=mint0;            //Genesis mint:1 is mint:0 (me)
                 expressRedisClient.hmset("mint:1",mint1);  //create mint:1 as clone of mint:0
 
                 //create the group entry while we are at it
                 
                 expressRedisClient.hmset([geo+":"+geo+".1"], genesisPulseGroupEntry);
                 expressRedisClient.hmset("gSRlist", geo+":"+geo+".1", "1");
                 console.log(ts()+"At this point we should have mint:0 mint:1 and group Entry defined... newMint="+newMint);
                 expressRedisClient.hgetall("mint:0", function(err,mint0) { console.log("mint0="+dump(mint0));});
                 expressRedisClient.hgetall("mint:1", function(err,mint1) { console.log("mint1="+dump(mint1));});
                 expressRedisClient.hgetall("DEVOPS:DEVOPS.1", function(err,mint1) { console.log("DEVOPS:DEVOPS.1="+dump(mint1));});
              }  //At this point we have mint:0 mint:1 and group Entry defined <-- this is enough for genesi node
              
              //                      Non-Genesis Node - create the newGeo:genesisGroup entry and add to gSRlist
              ////       mint:0 mint:1 *mint:N genesisGeo:genesisGroup *geoN:genesisGroup and update gSRlist and genesis OWLs
 
              if (newMint!=1) {
                 console.log(ts()+"SETTING UP NON-GENESIS NODE to connect with Genesis Node: "+mint1.group);
                 console.log(ts()+"At this point we should have mint:0 mint:1 and group Entry defined... newMint="+newMint);
                 expressRedisClient.hgetall("mint:0", function(err,mint0) { console.log("mint0="+dump(mint0));});
                 expressRedisClient.hgetall("mint:1", function(err,mint1) { console.log("mint1="+dump(mint1));});
                 expressRedisClient.hgetall("DEVOPS:DEVOPS.1", function(err,mint1) { console.log("DEVOPS:DEVOPS.1="+dump(mint1));});
                 mint0.group=mint1.group;  //adjust this node mint:0 to be part of genesis group
                 mintN=makeMintEntry( newMint,geo,mint1.group,port,incomingIP,publickey,version,wallet, incomingTimestamp )
                 expressRedisClient.hmset("mint:"+newMint,mintN);
                 expressRedisClient.hmset("gSRlist", mint1.group, ""+newMint);
 
                 var newMintPulseGroupEntry=makePulseEntry( newMint, geo, mint1.group );
                 expressRedisClient.hmset([geo+":"+mint1.group], newMintPulseGroupEntry);
              }
              expressRedisClient.hgetall("DEVOPS:DEVOPS.1", function(err,genesisGroupEntry) {
                 console.log("DEVOPS:DEVOPS.1="+dump(mint1));});
 
                 console.log(ts()+"genesis newOWLs="+newOWLs);
                 var newOWLs="1";
                 if (newMint!=1) newOWLs=genesisGroup.owls+","+newMint
 
                 makeConfig(function (config) {
                    console.log(ts()+"makeConfig");
                    config.mintTable["mint:0"]=mint0;  //nstall this new guy's mint0
                    config.rc="0";
                    config.ts=now();
                    //config.isGenesisNode=(config.mintTable["mint:0"].mint==1)
                    console.log(ts()+"EXPRESS:  Sending config:"+dump(config));
                    callback(config);   //parent routine's callback
                 })
              //console.log(ts()+"EXPRESS: after makeConfig");
              **/
    });
}
function addMintToGenesisOWLsList(newMint, callback) {
    console.log(lib_1.ts() + "addMintToGenesisOWLsList");
    expressRedisClient.hgetall("mint:0", function (err, me) {
        var newOWLs = "1";
        if (newMint != 1)
            newOWLs = me.owls + "," + newMint;
        console.log(lib_1.ts() + "newOWLs=" + newOWLs);
        expressRedisClient.hmset([me.geo + ":" + me.group], "owls", newOWLs, function (err, reply) {
            callback(newOWLs);
        });
    });
}
function dumpState() {
    expressRedisClient.hgetall("mint:0", function (err, me) {
        console.log(lib_1.ts() + "dumpState mint:0=" + lib_1.dump(me));
        expressRedisClient.hgetall("mint:1", function (err, genesis) {
            console.log(lib_1.ts() + "dumpState mint:1=" + lib_1.dump(genesis));
            expressRedisClient.hgetall("DEVOPS:DEVOPS.1", function (err, genesisGroup) {
                console.log(lib_1.ts() + "dumpState genesisGroupPulseLabel genesisGroup=" + lib_1.dump(genesisGroup));
                expressRedisClient.hgetall("MAZORE:DEVOPS.1", function (err, OREGroup) {
                    console.log(lib_1.ts() + "dumpState MAZORE:DEVOPS=" + lib_1.dump(OREGroup));
                });
            });
        });
    });
}
//
// bind the TCP port for externalizing 
//
expressRedisClient.hget("me", "port", function (err, port) {
    if (!port)
        port = 65013;
    var server = app.listen(port, '0.0.0.0', function () {
        //TODO: add error handling here
        var host = server.address().address;
        var port = server.address().port;
        console.log("Express app listening at http://%s:%s", host, port);
    }); //.on('error', console.log);
});

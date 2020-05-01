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
import { dump, now, mintList, SRList, ts, getMints, getOwls, dumpState, oneTimePulse, MYIP, MYVERSION } from '../lib/lib';
import { callbackify } from 'util';
//import { pulse } from '../pulser/pulser'
console.log("Starting EXPRESS GENESIS="+process.env.GENESIS+" PORT="+process.env.PORT+" HOSTNAME="+process.env.HOSTNAME+" VERSION="+process.env.VERSION);

const expressRedis = require('redis');
var expressRedisClient = expressRedis.createClient(); //creates a new client

expressRedisClient.flushall();    //clean slate

var express = require('express');
var app = express();

var mintStack=1;
const DEFAULT_SHOWPULSES="0"
//const DEFAULT_START_STATE="SINGLESTEP";  //for single stepping through network protocol code
const DEFAULT_START_STATE="RUNNING";  //for single stepping through network protocol code
//const DEFAULT_START_STATE="RUNNING"; console.log(ts()+"EXPRESS: ALL NODES START IN RUNNING Mode");
//const DEFAULT_START_STATE="SINGLESTEP"; console.log(ts()+"EXPRESS: ALL NODES START IN SINGLESTEP (no pulsing) Mode");
/****  NODE SITE CONFIGURATION  ****/

//      Environment is way for environment to control the code
if (! process.env.DARPDIR  ) {
   console.log("No DARPDIR enviropnmental variable specified ");
   process.env.DARPDIR=process.env.HOME+"/darp"
   console.log("DARPDIR defaulted to "+process.env.DARPDIR);
}

if (! process.env.HOSTNAME  ) {
   console.log("No HOSTNAME enviropnmental variable specified ");
   process.env.HOSTNAME=require('os').hostname().split(".")[0];
   console.log("setting HOSTNAME to "+process.env.HOSTNAME);
}

if (! process.env.GENESIS  ) {
   console.log("No GENESIS enviropnmental variable speci.0fied - setting DEFAULT GENESIS and PORT");
   process.env.GENESIS="71.202.2.184"
   process.env.PORT="65013"
}
if (! process.env.PORT) {
   console.log("No PORT enviropnmental variable specified - setting DEFAULT GENESIS PORT");
   process.env.PORT="65013"
}
if (! process.env.VERSION) {
   console.log("No VERSION enviropnmental variable specified - setting to noVersion");
   process.env.VERSION=MYVERSION()
}
console.log(ts()+"process.env.VERSION="+process.env.VERSION);

if (! process.env.MYIP) {
   console.log("No MYIP enviropnmental variable specified - ERROR - but I will try and find an IP myself frmom incoming message");
   process.env.MYIP="noMYIP"
   MYIP();
} else process.env.MYIP=process.env.MYIP.replace(/['"]+/g, ''); //\trim string

var PUBLICKEY=process.env.PUBLICKEY;
if (!PUBLICKEY)
try {
    PUBLICKEY=require('fs').readFileSync('../wireguard/publickey', 'utf8');
    PUBLICKEY=PUBLICKEY.replace(/^\n|\n$/g, '');
    console.log("pulled PUBLICKEY from publickey file: >"+PUBLICKEY+"<");
} catch (err) {
    console.log("PUBLICKEY lookup failed");
    PUBLICKEY="deadbeef00deadbeef00deadbeef0013";
}

var GEO=process.env.HOSTNAME;   //passed into docker
GEO=GEO.toUpperCase().split(".")[0].split(":")[0].split(",")[0].split("+")[0];
var PORT=process.env.PORT||"65013";         //passed into docker
var WALLET=process.env.WALLET || "584e560b06717ae0d76b8067d68a2ffd34d7a390f2b2888f83bc9d15462c04b2";
//from 
//FAT MODEL expressRedisClient.hmset("mint:0","geo",GEO,"port",PORT,"wallet",WALLET,"version",process.env.VERSION,"hotname",process.env.HOSTNAME,"genesis",process.env.GENESIS,"publickey",PUBLICKEY);
expressRedisClient.hmset("mint:0","geo",GEO,"port",PORT,"wallet",WALLET,"version",process.env.VERSION,"hostname",process.env.HOSTNAME,"genesis",process.env.GENESIS,"publickey",PUBLICKEY);

/**** CONFIGURATION SET ****/

expressRedisClient.hgetall("mint:0", function (err,me) {
   console.log("EXPRESS DARP "+me.version);
   console.log("EXPRESS DARP "+me.version);
   console.log("EXPRESS DARP "+me.version+" starting with me="+dump(me));
   console.log("EXPRESS DARP "+me.version);
   console.log("EXPRESS DARP "+me.version);
   if (me!=null){}
   else {
       console.log(ts()+"EXPRESS NO REDIS");
       process.exit(36)
   }
});

function nxnTable(n) {
   var html='<table border="1">'
   for(var i=0; i<n; i++)
      html+="<tr>"
      for( var j=0;j<n;j++) {
         html+='<td id="'+i+'-'+j+'">'+i+"-"+j+'</td>'
      }
      html+="</tr>"


   html+="</table"
   return html
}
//
//
//9=25,8=5,1=3,2=39,3=49,5=36,6=20,7=42	
function getOWLfrom(srcMint,owls) {
   var ary=owls.split(",");
   for(var i=0; i<ary.length; i++) {
      var mint=ary[i].split("=")[0]
      if (mint==srcMint) {
         var owl=ary[i].split("=")[1]
         if (typeof owl != "undefined" && owl!=null) return owl;
         else return ""
      }
   }

}
function getMintRecord(mint,callback) {
   expressRedisClient.hgetall("mint:"+mint, function (err,entry) {
      callback(err,entry)
   });
}
function getIPport(mint,callback) {
   getMintRecord(mint,function (err,mintEntry) {
      callback(err,mintEntry.ipaddr+":"+mintEntry.port)
   })
}

function getMatrixTable(darpMatrix,callback) {
   //scan for darp-<from>-<to>
   var cursor = '0';
   if (darpMatrix==null)
      darpMatrix={};
   expressRedisClient.scan(cursor, 'MATCH', 'darp-*', 'COUNT', '1000', function(err, reply){
//      expressRedisClient.scan(cursor, 'MATCH', '*:DEVOPS.1', 'COUNT', '1000', function(err, reply){
         //console.log(ts()+"SCAN reply="+dump(reply));
   if(err){
        throw err;
    }
    cursor = reply[0];
    //console.log(ts()+"EXPRESS scan() : darp-*="+dump(reply[1]));//INSTRUMENTATION POINT

    for (var n in reply[1]) {
      var ary=reply[1][n].split("-")   ///"darp-1-3=35",
      var src=ary[1], dst=ary[2], owl=ary[3];
      console.log(ts()+"getMatrixTable src="+src+" dst="+dst+" owl="+owl);
      if (typeof darpMatrix[src] == "undefined" ) darpMatrix[src]={} //new Array();
      if (typeof darpMatrix[src][dst] == "undefined" ) darpMatrix[src][dst]={} //new Array();
      //console.log(ts()+"Storing darpMatrix["+src+"]["+dst+"]="+owl);  ///INSTRUMENTATION POINT
      if (darpMatrix[src][dst]=={} ) {
         darpMatrix[src][dst]=owl
      } else {  //overwrite entry? 
         if (darpMatrix[src][dst]=="")
            darpMatrix[src][dst]=owl
      }
    }
    if(cursor === '0'){
      //console.log(ts()+"getMatrixTable(): returning darpMatrix"+dump(darpMatrix));
      callback(darpMatrix);
    }else{
       console.log('EXPRESS getMatrixTable() returned non-"0" reply BUG BUG not sure this will work processing Complete');

      // do your processing
        // reply[1] is an array of matched keys.
        // console.log(reply[1]);
        return getMatrixTable(darpMatrix,callback);  //this only returns one bucket full.............
    }
  });
};
/*
function getLiveMatrixTable() {
    return new Promise(function(resolve, reject) {
      getMatrixTable(null, function(err, data) {
            if (err !== null) reject(err);
            else resolve(data);
        });
    });
}
*/
//
//
//      handleShowState(req,res) - show the node state
//
function handleShowState(req, res) {
   //console.log(ts()+"EXPRESS(): ------------------------------------>  handleShowState()");

   var dateTime = new Date();
   var txt = '<meta http-equiv="refresh" content="' + 10 + '">';

   expressRedisClient.hgetall("mint:0", function (err,me) {
      if (me==null) return console.log("handleShowState(): WEIRD: NULL mint:0");
      if (me.state=="SINGLESTEP") txt = '<meta http-equiv="refresh" content="' + 10 + '">';
      txt += '<html><head>';
   
      txt += '<script> function startTime() { var today = new Date(); var h = today.getHours(); var m = today.getMinutes(); var s = today.getSeconds(); m = checkTime(m); s = checkTime(s); document.getElementById(\'txt\').innerHTML = h + ":" + m + ":" + s; var t = setTimeout(startTime, 500); } function checkTime(i) { if (i < 10) {i = "0" + i};  return i; } </script>';
      txt += '<link rel = "stylesheet" type = "text/css" href = "http://drpeering.com/noia.css" /></head>'
      
      txt += '<body>';
      var insert="";

      makeConfigAll(function(config) {
         //console.log(ts()+"config="+dump(config));
         var mintTable=config.mintTable
         var pulses=config.pulses
         var gSRlist=config.gSRlist

         //
         //    Header
         //
         if (me.isGenesisNode=="1") txt+="<h1>GENESIS NODE "+me.geo+" ("+me.ipaddr+":"+me.port+" ) "+me.version.split(".")[2]+"</h1>";
         else                  txt+="<h1>"+me.geo+"("+me.ipaddr+":"+me.port+") Mint#"+me.mint+" "+me.version+"</h1>";
         txt+="<p>"+dateTime+"</p>"
         txt+='<p>Connect to this pulseGroup using: docker run -p '+me.port+":"+me.port+' -p '+me.port+":"+me.port+"/udp -p 80:80/udp -v ~/wireguard:/etc/wireguard -e GENESIS="+me.ipaddr+' -e HOSTNAME=`hostname`  -e WALLET=auto -it williambnorton/darp:latest</p>'       
         



//         var OWLMatrix=getLiveMatrixTable();
         getMatrixTable(null,function (OWLMatrix) { 
            //
            // show OWL Matrix
            //
            txt+='<br><h2>'+me.group+' OWL Matrix for pulseGroup: '+me.group+'</h2><table border="1">';

            txt+='<tr><th></th>'
            for (var col in pulses) {
               var colEntry=pulses[col];
               //txt+='<th><a href="http://'+colEntry.ipaddr+":"+me.port+'/">'+colEntry.geo+":"+colEntry.srcMint+"</a></th>"
               txt+='<th>'+colEntry.geo+" "+colEntry.srcMint+"</th>"
            }
            txt+="</tr>"

            for (var row in pulses) var lastEntry=pulses[row];
            console.log(ts()+"inside getMatrix.....");
            var fetchStack=new Array();
            for (var row in pulses) {
               var rowEntry=pulses[row];

               txt+='<tr><td>'+rowEntry.geo+" "+rowEntry.srcMint+'</td>';
               for (var col in pulses) {
                  var colEntry=pulses[col];
                  var entryLabel=rowEntry.srcMint+"-"+colEntry.srcMint
                  var owl="";
                  if (( typeof OWLMatrix[rowEntry.srcMint] != "undefined" ) &&
                      ( typeof OWLMatrix[rowEntry.srcMint][colEntry.srcMint] != "undefined") ) {
                     owl=OWLMatrix[rowEntry.srcMint][colEntry.srcMint] 
                  }
                  console.log(ts()+"handleShowState() entryLabel="+entryLabel+" owl="+owl);
                  txt+='<td id="'+entryLabel+'">'+owl+"ms</td>"
               }
               txt+="</tr>"
            }
            txt+="</table>"; 


         //
         //  Externalize pulses 
         //
         txt+='<br><h2>pulseTable</h2><table border="1">';
         txt+="<tr>"
         txt+="<th>geo</th>"
         txt+="<th>group</th>"
         txt+="<th>seq</th>"
         txt+="<th>pulseTimestamp</th>"
         txt+="<th>srcMint</th>"
         txt+="<th>owl</th>"
         //txt+="<th>owls</th>"
         txt+="<th>inOctets</th>"
         txt+="<th>outOctets</th>"
         txt+="<th>inMsgs</th>"
         txt+="<th>outMsgs</th>"
         txt+="<th>pktDrops</th>"
         //txt+="<th>lastMsg</th>"
         txt+="</tr>"
         
         //console.log(ts()+"                            pulses="+dump(pulses));
         for (var a in pulses) {
            var pulseEntry=pulses[a];
            //console.log(ts()+"a="+a+" pulseTable[pulseEntry]"+dump(pulseEntry));
            if (! pulseEntry.seq) console.log(ts()+"NOT A PULSE!!!!!");
            txt+="<tr>"

//            txt+="<td>"+'<a href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/" >'+mintEntry.geo+"</a></td>"

            txt+="<td>"+'<a href="http://' + pulseEntry.ipaddr + ':' + me.port + '/" >' + pulseEntry.geo + '</a>'+"</td>"


            //txt+="<td>"+pulseEntry.geo+"</td>"
            txt+="<td>"+pulseEntry.group+"</td>"
            txt+="<td>"+pulseEntry.seq+"</td>"
            
            var deltaSeconds=Math.round((now()-pulseEntry.pulseTimestamp)/1000)+" secs ago";
            if (pulseEntry.pulseTimestamp==0) deltaSeconds="0";
            //txt += "<td>" + now()+" "+entry.pulseTimestamp+ "</td>";
            txt += "<td>" + deltaSeconds + "</td>";

            //txt+="<td>"+pulseEntry.pulseTimestamp+"</td>"
            txt+="<td>"+pulseEntry.srcMint+"</td>"
            txt+="<td>"+pulseEntry.owl+" ms</td>"
            //txt+="<td>"+pulseEntry.owls+"</td>"
            txt+="<td>"+pulseEntry.inOctets+"</td>"
            txt+="<td>"+pulseEntry.outOctets+"</td>"
            txt+="<td>"+pulseEntry.inMsgs+"</td>"
            txt+="<td>"+pulseEntry.outMsgs+"</td>"
            txt+="<td>"+pulseEntry.pktDrops+"</td>"
            //txt+="<td>"+pulseEntry.lastMsg+"</td>"
            txt+="</tr>"
         }
         txt+="</table>"; 
         //
         //  Externalize mintTable 
         //
         //console.log(ts()+"config.mintTable="+dump(config.mintTable));
         txt+='<br><h2>mintTable</h2><table border="1">';
         txt+="<tr>"
         txt+="<th>mint</th>"
         txt+="<th>geo</th>"
         txt+="<th>port</th>"
         txt+="<th>ipaddr</th>"
         txt+="<th>publickey</th>"
         txt+="<th>state</th>"
         txt+="<th>bootTime</th>"
         txt+="<th>version</th>"
         txt+="<th>wallet</th>"
         //txt+="<th>S</th>"
         txt+="<th>owl</th>"
         //txt+="<th>G</th>"
   //<th>rtt</th>"
         txt+="<th>CONTROLS</th>"
         txt+="</tr>"

         //console.log(ts()+"                            mintTable="+dump(mintTable));
         for (var a in mintTable) {
            var mintEntry=mintTable[a];
            //console.log(ts()+"a="+a+" mintEntry"+dump(mintEntry));

            txt+="<tr>"
            //txt+="<td>"+mintEntry+"</td>"
            txt+="<td>"+mintEntry.mint+"</td>"
            txt+="<td>"+'<a href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/" >'+mintEntry.geo+"</a></td>"
            txt+="<td>"+mintEntry.port+"</td>"
            txt+="<td>"+'<a href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/" >'+mintEntry.ipaddr+"</a></td>"
            txt+="<td>"+mintEntry.publickey.substring(0,3)+"..."+mintEntry.publickey.substring(40,mintEntry.publickey.length)+"</td>"
            txt+="<td>"+'<a href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/config" >' + mintEntry.state + '</a>'+"</td>"

            var delta=Math.round((now()-mintEntry.bootTime)/1000)+" secs ago";
            if (pulseEntry.bootTime==0)delta="0";
            txt += "<td>" + delta + "</td>";



            //txt+="<td>"+mintEntry.bootTime+"</td>"
            txt+="<td>"+'<a href="http://' + mintEntry.ipaddr + ':' + mintEntry.port + '/version" >'+mintEntry.version+"</a></td>"
            txt+="<td>"+mintEntry.wallet.substring(0,3)+"..."+mintEntry.wallet.substring(40,mintEntry.wallet.length)+"</td>"
            //txt+="<td>"+mintEntry.SHOWPULSES+"</td>"
            txt+="<td>"+mintEntry.owl+" ms</td>"
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
            txt+="</tr>"
         }
         txt+="</table>"; 

         //
         //  Externalize gSRlist Directory
         //
         txt+='<br><h2>gSRlist</h2><table border="1">';
         txt+="<tr><th>pulse</th><th>mint</th></tr>"
         for (var entry in gSRlist) {
            var mint=gSRlist[entry];
            //console.log(ts()+"mint="+mint);
            txt+="<tr><td><a>"+entry+"</a></td><td><a>"+mint+"</a></td></tr>"
         }
         txt+="</table>"; 

         res.setHeader('Content-Type', 'text/html');
         res.setHeader("Access-Control-Allow-Origin", "*");

         res.end(txt+"<p>"+/*"RAW /CONFIG: "+JSON.stringify(config, null, 2)+ */"</p></body></html>");
         return
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
   makeConfig(function(config) {
      //console.log("app.get('/state' callback config="+dump(config));
      expressRedisClient.hgetall("mint:0", function(err, me) {
         config.mintTable["mint:0"]=me;
         //var html="<html>"
         res.setHeader('Content-Type', 'application/json');
         res.setHeader("Access-Control-Allow-Origin", "*");
         res.end(JSON.stringify(config, null, 2));
         return
      });
   })
});

//
//
//
app.get('/', function (req, res) {
   //console.log("fetching '/' ");
   handleShowState(req, res);
   return
});
//
//
//
app.get('/mint/:mint', function (req, res) {
   //console.log("fetching '/mint' state");

   expressRedisClient.hgetall("mint:"+req.params.mint, function(err, mintEntry) {
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
   expressRedisClient.hget("mint:0","version",function(err,version){
      //console.log("version="+version);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify(version));
      return;
   })
});
app.get('/stop', function (req, res) {
   //console.log("EXPRess fetching '/state' state");
   console.log("EXITTING and Stopping the node");
   expressRedisClient.hset("mint:0","state","STOP");  //handlepulse will exit 86
   res.redirect(req.get('referer'));

});

app.get('/reload', function (req, res) {
   //console.log("EXPRess fetching '/state' state");
   console.log("EXITTING to reload the system")
   expressRedisClient.hset("mint:0","state","RELOAD");  //handlepulse will exit 36
   res.redirect(req.get('referer'));

});

app.get('/config', function (req, res) {
   console.log("EXPRess wbn fetching '/config' ");
   makeConfigAll( function (config) {
      console.log("app.get(/config pulseRecordTable="+dump(config));
      res.setHeader('Content-Type', 'application/json');
      //res.setHeader('Content-Type', 'text/html');
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify(config,null,2));
   });
   return;
});

app.get('/state', function (req, res) {
   //console.log("EXPRess fetching '/state' state");
   makeConfig(function(config) {
      //console.log("app.get('/state' callback config="+dump(config));
      res.setHeader('Content-Type', 'application/json');
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify(config, null, 2));
   })
   return;
});
//
// 
//
app.get('/me', function (req, res) {
   //res.send('express root dir');
   res.setHeader('Content-Type', 'application/json');
   res.setHeader("Access-Control-Allow-Origin", "*");
   expressRedisClient.hgetall("mint:0", function (err,me){
      res.end(JSON.stringify(me, null, 3));
   });
   return;
})

//
//
//
app.get('/SINGLESTEP', function (req, res) {
   expressRedisClient.hgetall( "mint:0", function (err,me) {
      expressRedisClient.hmset( "mint:"+me.mint, {
         state : "SINGLESTEP",
         SHOWPULSES : "0"
      });
      expressRedisClient.hmset( "mint:0", {
         state : "SINGLESTEP",
         SHOWPULSES : "0"
      });
      console.log(ts()+"pulsed - Now in SINGLESTEP state - no pulsing and show no one's pulses");
      console.log(ts()+"SINGLESTEP SINGLESTEP SINGLESTEP SINGLESTEP state - ");
//      res.redirect('http://'+me.ipaddr+":"+me.port+"/");
      res.redirect(req.get('referer'));

   });
});
//
//
//
app.get('/pulseMsg', function (req, res) {
   expressRedisClient.hgetall( "mint:0", function (err,me) {
       expressRedisClient.hmset( "mint:0", {
         adminControl : "PULSE",
         SHOWPULSES : "1"
      });
      console.log(ts()+"pulse(1) somehow here");
      
      console.log(ts()+"One time PULSE SENT");
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
   console.log(ts()+"NODEFACTORY");

   expressRedisClient.hgetall("mint:0", function (err,me) {
      if (me!=null) {
         console.log('EXPRESS nodeFactory: config requested with params: '+dump(req.query));
         //console.log("EXPRESS geo="+req.query.geo+" publickey="+req.query.publickey+" query="+JSON.stringify(req.query,null,2)+" port="+req.query.port+" wallet="+req.query.wallet+" version="+req.query.version);
         var geo=req.query.geo;
         var publickey=req.query.publickey;
         var port=req.query.port||65013;
         var wallet=req.query.wallet||"";
         var incomingTimestamp=req.query.ts;

         var incomingIP=req.query.myip;  /// for now we believe the node's IP
         var clientIncomingIP=req.headers['x-forwarded-for'] || req.connection.remoteAddress;
         if (incomingIP=="noMYIP") incomingIP=clientIncomingIP;
         if (typeof incomingIP == "undefined") 
            return console.log(ts()+"***********************ERROR: incomingIP unavailable from geo="+geo+" inco,ingIP="+incomingIP+" clientIncomingIP="+clientIncomingIP );;
         var octetCount=incomingIP.split(".").length;

         if (typeof incomingTimestamp == "undefined") {
            console.log("/nodeFactory called with no timestamp");
            res.setHeader('Content-Type', 'application/json');   
            res.end(JSON.stringify({ "rc" : "-1 nodeFactory called with no timestamp. "}));
            return;
         }
         if (octetCount!=4) {
            console.log("EXPRESS(): nodefactory called with bad IP address:"+incomingIP+" returning rc=-1 to config geo="+geo);
            res.setHeader('Content-Type', 'application/json');   
            res.end(JSON.stringify({ "rc" : "-1 nodeFactory called with BAD IP addr: "+incomingIP }));
            return;
         }

         //console.log("req="+dump(req));
         var version=req.query.version;
         //console.log("EXPRESS /nodefactory geo="+geo+" publickey="+publickey+" port="+port+" wallet="+wallet+" incomingIP="+incomingIP+" version="+version);
         //console.log("req="+dump(req.connection));
         // On Startup, only accept connections from me, and the test is that we have matching publickeys
         console.log(ts()+"EXPRESS: mintStack="+mintStack+" publickey="+publickey+" me.publickey="+me.publickey);
         console.log("EXPRESS: Received connection request from "+geo+"("+incomingIP+")" );
         if ((mintStack==1 && (publickey==me.publickey)) || (mintStack!=1)) {   //check publickey instead!!!!!
            if (geo=="NORTONDARP") {
               //console.log(ts()+"Filtering"); //this will eventually be a black list or quarentine group
            } else {
               provisionNode(mintStack++,geo,port,incomingIP,publickey,version,wallet, incomingTimestamp, function (config) {
               console.log(ts()+"EXPRESS nodeFactory sending config="+dump(config));
               res.setHeader('Content-Type', 'application/json');   
               res.end(JSON.stringify( config ));  //send mint:0 mint:1 *mint:N groupEntry *entryN
               }) 
            }
         }
         //} else console.log("EXPRESS: Received pulse from "+geo+"("+incomingIP+") before my genesis node was set up. IGNORING.");
      } else console.log("EXPRESS has no me out of redis");
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
   expressRedisClient.hgetall("mint:0", function(err, me) {
      expressRedisClient.hgetall("gSRlist", function(err,gSRlist) {
         //console.log("makeConfig(): "+process.env.VERSION+" gSRlist="+dump(gSRlist));
         fetchConfig(gSRlist, null, function(config) {
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
   expressRedisClient.hgetall("mint:0", function(err, me) {
      expressRedisClient.hgetall("gSRlist", function(err,gSRlist) {
         //console.log("makeConfigAll():  gSRlist="+dump(gSRlist));

         fetchConfigAll(gSRlist, null, function(config) {
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
   if (typeof config == "undefined" || config==null) {
      //console.log(ts()+"fetchConfig(): STARTING ECHO: gSRlist="+dump(gSRlist)+" config="+dump(config)+" ");
      config={
         gSRlist : gSRlist,
         mintTable : {},
         pulses : {},
         entryStack : new Array()             
      }
      for (var index in gSRlist) {
         //console.log("pushing "+index);
         config.entryStack.unshift({ entryLabel:index, mint:gSRlist[index]})
      }
      //console.log("fetchConfigAll entryStack="+dump(config.entryStack));
   }
   //Whether first call or susequent, pop entries until pop fails
   var entry=config.entryStack.pop();
   //console.log("EXPRESS() popped entry="+dump(entry));
   if (entry) {
      var mint=entry.mint;
      var entryLabel=entry.entryLabel;

      expressRedisClient.hgetall("mint:"+mint, function (err,mintEntry) {   
         if (err) console.log("ERROR: mintEntry="+mintEntry)                     
         config.mintTable["mint:"+mintEntry.mint] = mintEntry;  //set the mintEntry-WORKING
         //console.log("EXPRESS() mint="+mint+" mintEntry="+dump(mintEntry)+" config="+dump(config)+" entryLabel="+entryLabel);
         //                       MAZORE:DEVOPS.1
         var pulseEntryLabel=mintEntry.geo+":"+mintEntry.group;
         //console.log(ts()+"*************fetchConfigAll got mint "+mintEntry.mint+" now fetching "+pulseEntryLabel);

         expressRedisClient.hgetall(pulseEntryLabel, function (err,pulseEntry) {
            if (err) console.log(ts()+"ERROR fetching pulseEntry");
            var pulseEntryLabel=pulseEntry.geo+":"+pulseEntry.group
            //console.log(ts()+"**************fetchConfigAll pulseEntryLabel="+pulseEntryLabel+" pulseEntry="+dump(pulseEntry));
            config.pulses[pulseEntryLabel] = pulseEntry;  //set the corresponding mintTable
            //console.log("EXPRESS() fetchConfigAll RECURSING entryLabel="+entryLabel+" pulseEntry="+dump(pulseEntry)+" config="+dump(config));
            fetchConfigAll(gSRlist,config,callback);  //recurse until we hit bottom
         });
      });
   } else {
      delete config.entryStack;
      //console.log(ts()+"fetchConfig(): returning "+dump(config));
      callback(config);  //send the config atructure back
   }
}
//
// Fills ofig structure with gSRlist and all associated mints and pulseEnries
//
function fetchConfig(gSRlist, config, callback) {
   if (typeof config == "undefined" || config==null) {
      //console.log(ts()+"fetchConfig(): STARTING ECHO: gSRlist="+dump(gSRlist)+" config="+dump(config)+" ");
      config={
         gSRlist : gSRlist,
         mintTable : {},
         pulses : {},
         entryStack : new Array()             
      }
      for (var index in gSRlist) {
         //console.log("pushing "+index);
         //config.entryStack.push({ entryLabel:index, mint:gSRlist[index]})
         config.entryStack.unshift({ entryLabel:index, mint:gSRlist[index]})
      }
      //onsole.log("entryStack="+dump(config.entryStack));
   }
   //Whether first call or susequent, pop entries until pop fails
   var entry=config.entryStack.pop();
   //console.log("EXPRESS() popped entry="+dump(entry));
   if (entry) {
      var mint=entry.mint;
      var entryLabel=entry.entryLabel;
      expressRedisClient.hgetall("mint:"+mint, function (err,mintEntry) {   
         if (err) console.log("ERROR: mintEntry="+mintEntry)                     
         if (mintEntry) config.mintTable["mint:"+mint] = mintEntry;  //set the pulseEntries
         //console.log("EXPRESS() mint="+mint+" mintEntry="+dump(mintEntry)+" config="+dump(config)+" entryLabel="+entryLabel);
         //                       MAZORE:DEVOPS.1
         expressRedisClient.hgetall(entryLabel, function (err,pulseEntry) {
            config.pulses[pulseEntry.geo+":"+pulseEntry.group] = pulseEntry;  //set the corresponding mintTable

            //config.pulses[entryLabel] = pulseEntry;  //set the corresponding mintTable
            //console.log("EXPRESS() RECURSING entryLabel="+entryLabel+" pulseEntry="+dump(pulseEntry)+" config="+dump(config));
            fetchConfig(gSRlist,config,callback);  //recurse until we hit bottom
         });
      });
   } else {
      delete config.entryStack;
      //console.log(ts()+"fetchConfig(): returning "+dump(config));
      callback(config);  //send the config atructure back
   }
}

function makeMintEntry(mint,geo,group,port,incomingIP,publickey,version,wallet, incomingTimestamp) {
   return {    //mint:0 is always "me"
      "mint" : ""+mint,      //mint:1 is always genesis node
      "geo" : geo,
      "group" : group,  //assigning nodes in this group now
      // wireguard configuration details
      "port" : ""+port,
      "ipaddr" : incomingIP,   //set by genesis node on connection
      "publickey" : publickey,
      "state" : DEFAULT_START_STATE,
      "bootTime" : ""+incomingTimestamp,   //RemoteClock on startup
      "version" : version,  //software version
      "wallet" : wallet,
      "SHOWPULSES" : DEFAULT_SHOWPULSES,
      "owl" : "",   //
      "isGenesisNode" : (mint==1)?"1":"0",
      "rtt" : ""+(now()-incomingTimestamp) //=latency + clock delta between pulser and receiver
   }
}

function makePulseEntry(mint,geo,group) {
   return  {  //one record per pulse - index = <geo>:<group>
      "geo" : geo,            //record index (key) is <geo>:<genesisGroup>
      "group": group,      //DEVPOS:DEVOP.1 for genesis node start
      "seq" : "0",         //last sequence number heard
      "pulseTimestamp": "0", //last pulseTimestamp received from this node
      "srcMint" : ""+mint,      //Genesis node would send this 
      "owl" : "",
      "owls" : "1",        //Startup - I am the only one here
      "inOctets": "0",
      "outOctets": "0",
      "inMsgs": "0",
      "outMsgs": "0",
      "pktDrops": "0",   //,     //as detected by missed seq#
      "lastMsg":""
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
function provisionNode(newMint,geo,port,incomingIP,publickey,version,wallet, incomingTimestamp, callback) {
   //console.log(ts()+"provisionNode(): newMint="+newMint+" geo="+geo);

   expressRedisClient.hgetall("mint:1", function (err, mint1) {
      //create mint and entry as if this was the genesis node
      var mint0=makeMintEntry( newMint,geo,geo+".1",port,incomingIP,publickey,version,wallet, incomingTimestamp )
      if (newMint==1) {
         expressRedisClient.hmset("mint:0",mint0, function (err,reply){
            expressRedisClient.hmset("mint:1",mint0, function (err,reply){
               var mint1=mint0; //make a copy for readaibility
               var genesisPulseGroupEntry=makePulseEntry( newMint, geo, geo+".1" );      
               expressRedisClient.hmset(mint1.geo+":"+mint1.group, genesisPulseGroupEntry, function (err,reply){  // genesisGroupPulseEntry
                  expressRedisClient.hmset("gSRlist",mint1.geo+":"+mint1.group,"1", function (err,reply){ //Add our Genesis Group Entry to the gSRlist
                     makeConfig(function (config) {
                        //console.log(ts()+"makeConfig");
                        config.mintTable["mint:0"]=mint0;  //    Install this new guy's mint0 into config
                        config.rc="0";
                        config.isGenesisNode="1";
                        config.ts=now();  //give other side a notion of my clock when I sent this
                        //config.isGenesisNode=(config.mintTable["mint:0"].mint==1)
                        //console.log(ts()+"EXPRESS:  Sending config:"+dump(config));
                        callback(config);   //parent routine's callback
                     })
                  });
               }); //Create GENESIS GroupEntry:DEVOPS:DEVOPS.1
            }); //mint:1 is always the GENESIS NODE
         }); //mint:0 always is "me" we are GENESIS NODE
      }
      else {
         expressRedisClient.hgetall("mint:0", function (err,mint0){
            expressRedisClient.hgetall("mint:1", function (err,mint1){
               var mint1=mint0; //make a copy for readaibility
               expressRedisClient.hgetall(mint1.geo+":"+mint1.group, function (err,genesisGroupEntry){
                  expressRedisClient.hgetall("gSRlist", function (err,gSRlist){ //Add our Genesis Group Entry to the gSRlist
 
                     var mintN=makeMintEntry( newMint,geo,mint1.group,port,incomingIP,publickey,version,wallet, incomingTimestamp )
                     expressRedisClient.hmset("mint:"+newMint, mintN, function (err,reply){
                        var newNodePulseEntry=makePulseEntry(newMint,geo,mint1.group)
                        expressRedisClient.hmset(geo+":"+mint1.group, newNodePulseEntry, function (err,reply){
                           expressRedisClient.hmset("gSRlist",geo+":"+mint1.group,""+newMint, function (err,reply){ //Add our Entry to the genesisGroup in gSRlist
                              genesisGroupEntry.owls=genesisGroupEntry.owls+","+newMint
                              var config={
                                 gSRlist : {
                                    [mint1.geo+":"+mint1.group] : "1",
                                    [geo+":"+mint1.group] : ""+newMint
                                 },                                 
                                 mintTable : {
                                    "mint:0" : mintN, //you are mintN
                                    "mint:1" : mint1, //genesis group
                                    ["mint:"+newMint] : mintN //and the actual pulse
                                 },
                                 pulses : {
                                    [mint1.geo+":"+mint1.group] : genesisGroupEntry,
                                    [geo+":"+mint1.group] : newNodePulseEntry
                                 },
                                 rc : "0",
                                 isGenesisNode : "0",
                                 ts : ""+now()
                              }

                              //console.log(ts()+"newMint="+newMint+" "+dump(config));
                           
                              expressRedisClient.hmset(mint1.geo+":"+mint1.group, "owls",genesisGroupEntry.owls);
                              //expressRedisClient.hmset(geo+":"+mint1.group, "owls",genesisGroupEntry.owls);

                              callback(config)
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
   })
}

function addMintToGenesisOWLsList(newMint, callback) {
   console.log(ts()+"addMintToGenesisOWLsList");
   expressRedisClient.hgetall("mint:0",function(err,me) {
      var newOWLs="1";
      if (newMint!=1) newOWLs=me.owls+","+newMint
      console.log(ts()+"newOWLs="+newOWLs);
      expressRedisClient.hmset([me.geo+":"+me.group],"owls",newOWLs, function (err,reply) {
         callback(newOWLs);
      }); 
   });
}

function dumpState() {
    expressRedisClient.hgetall("mint:0",function(err,me) {
       console.log(ts()+"dumpState mint:0="+dump(me));
       expressRedisClient.hgetall("mint:1",function(err,genesis) {
          console.log(ts()+"dumpState mint:1="+dump(genesis));
          expressRedisClient.hgetall("DEVOPS:DEVOPS.1",function(err,genesisGroup) {
            console.log(ts()+"dumpState genesisGroupPulseLabel genesisGroup="+dump(genesisGroup));
            expressRedisClient.hgetall("MAZORE:DEVOPS.1",function(err,OREGroup) {
                console.log(ts()+"dumpState MAZORE:DEVOPS="+dump(OREGroup));
             })
          })
       })
    })
 }
//
// bind the TCP port for externalizing 
//
expressRedisClient.hget("me","port",function (err,port){
   if (!port) port=65013;
   var server = app.listen(port,'0.0.0.0', function () {
         //TODO: add error handling here
      var host = server.address().address
      var port = server.address().port  
      console.log("Express app listening at http://%s:%s", host, port)
   }) //.on('error', console.log);

});


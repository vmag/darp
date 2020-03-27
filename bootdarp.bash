#!/bin/bash
#		    bootdarp.bash - fetch updated darp software and launch forever script
# 
DARPDIR=$HOME/darp
#If the GENESIS variable ENV VAR does not exist then assume we are genesis node
if [ "$GENESIS" == "" ]; then
   GENESIS=`curl ifconfig.co`
   echo `date` GENESIS set to $GENESIS
fi

#update SW is destructive - should be done after run in docker loop
#when genesis node leanrs of new SW it quits and downloads 
#
#The order of startup is important here
echo `date` >$DARPDIR/forever
while :
do
    rm $DARPDIR/forever
    echo `date` $0 : kill old processes to be restarted
    kill `cat $DARPDIR/*.pid`
    sleep 1
    ./updateSW.bash
    echo `date` SOFTWARE UPDATE COMPLETE
    cd $DARPDIR
    echo `date` RUNNING SOFTWARE VERSION `ls -l *build*`

    #Now we are running in the new code /darp directory
    echo `date` Configuring initial wireguard keys
    cd $DARPDIR/scripts/
    ./configWG.bash
    export PUBLICKEY=`cat $DARPDIR/wireguard/publickey`
    echo PUBLICKEY=$PUBLICKEY
    sleep 1

    cd $DARPDIR
    echo `date` Starting redis
    redis-cli shutdown  #stop server
    redis-server --save "" --appendonly no &  #store nothing
    echo $$ > $DARPDIR/redis-server.pid
    echo `date`" redis started"
    sleep 1

    #
    #   need express (TCP/65013) before config
    #
    cd $DARPDIR
    echo `date` Starting express for nodeFactory and externalize stats
    cd $DARPDIR/express
    node express &
    echo $$>$DARPDIR/express.pid
    sleep 1

    #echo `date` Launching forever script
    #cd /darp/scripts
    #./forever.bash  #Start the system
    cd $DARPDIR
    echo `date` Connecting to GENESIS node to get configuration into redis
    cd $DARPDIR/config
    kill `cat $DARPDIR/config.pid`
    node config &
    echo $$>$DARPDIR/config.pid
    echo `date` Waiting for config to connect
    sleep 1

    cd $DARPDIR
    cd $DARPDIR/pulser
    kill `cat $DARPDIR/pulser.pid`
    node pulser &
    echo $$>$DARPDIR/pulser.pid
    #echo `date` '------------> Please start pulser'

    cd $DARPDIR
    cd $DARPDIR/handlepulse
    kill `cat $DARPDIR/handlepulse.pid`
    node handlepulse 
    $rc=$?
    
    if [ -f $DARPDIR/forever ]; then
        #echo $$>$DARPDIR/handlepulse.pid
        #echo `date` Starting handlepulse
        echo `date` New darp version: `cd /darp;ls build*` installed and running
        sleep 10 
    else 
        echo `handlePulse finished -restarting all`
        exit -1
    fi
done

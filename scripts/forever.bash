#!/bin/bash
#      forever.bash - Run inside the docker
#
#       /etc/wireguard is a mount of ~/wireguard
#       when changes are made they are reflected outside Docker
#       the host watch script will wg-quick when files change in ~/wireguard 
#
#	I expect $HOSTNAME [ $PORT ] [ $WALLET ] environmentals to be set
#
HOSTNAME=`echo $HOSTNAME|awk -F. '{print $1}'`
if [ "$HOSTNAME" == "" ]; then
	HOSTNAME="DEV1";
fi 
GENESIS=`curl "http://drpeering.com/genesisnodes"`
echo GENESIS=$GENESIS
redis-server &          #start up our data server
#
#       Forever loop running in docker
#
echo `date` STARTING Measurement Apparatus
cd

echo $0 Loop started `date` > /tmp/forever
echo $0 `date` > NOIA.log
while [ -f /tmp/forever ]
do
	git clone https://github.com/williambnorton/darp.git
        #clear
        #
        #       Configure Wireguard with new public and private keys
        #
        echo `date` 'Configuring *NEW* Wireguard Public and Private eKeys'
        darp/scripts/configWG.bash
        PUBLICKEY=`cat /etc/wireguard/publickey`

        rm /tmp/forever      #UNCOMMENT TO MAKE IT STOP ON CRASH
        echo `date` Starting SR Simulator on $HOSTNAME
        #echo "http://drpeering.com/noia.php?geo=${HOSTNAME}&publickey=${PUBLICKEY}"
        #curl "http://drpeering.com/noia.php?geo=${HOSTNAME}&publickey=${PUBLICKEY}" > noia.`date +%y%m%d`.js
        #curl "http://drpeering.com/noia.php?geo=${HOSTNAME}&publickey=${PUBLICKEY}" > noia.`date +%y%m%d`.js
	
	echo curl "http://$GENESIS/codenconfig/$HOSTNAME/$PUBLICKEY" # | bash
	exit;
        #
        #       We exitted the code - see if we are to restart
        #
        YYMMDD=`date +%y%m%d`
        node <noia.$YYMMDD.js
        rc=$?
        echo node rc=$rc
        if [ $rc -eq 120 ]; then
                echo `date` "PAUSE MESSAGE RECEIVED"
                echo `date` `hostname` Sleeping for 120 seconds
                sleep 120
        fi
        if [ $rc -eq 36 ]; then
                echo `date` "SOFTWARE RELOAD MESSAGE RECEIVED"
                echo `date` > forever
        fi
        if [ $rc -eq 32 ]; then
                echo `date` "REBOOT MESSAGE RECEIVED"
                rm forever #loop wil not run unless this file exists
                ${SUDO} apt-get update
                ${SUDO} reboot
                exit 1
        fi
        if [ $rc -eq 99 ]; then
                echo `date` "STOP MESSAGE RECEIVED"
                rm forever #loop wil not run unless this file exists
                exit 1
        fi
        echo `date` SLEEPING - should probably gen new keys or docker pull
        sleep 15
	rm -rf darp
done



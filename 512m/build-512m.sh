#!/bin/bash
clean2K()
{
    kill -9 $(ps -ef | grep "lotus "|grep -v color|awk '{print $2}')
    kill -9 $(ps -ef | grep "lotus-miner"|grep -v color|awk '{print $2}')
    redis-cli -n 2 flushdb
    ll $LOTUS_PATH_2K | awk 'BEGIN {print "Start clean 512MiB files"}{if($9 !~ /^v28/ && $9 != "./" && $9 != "../" && $9 != ""){system("rm -fr '$LOTUS_PATH_2K'/"$9)}}END {print "Clean 2k file end"}'
}
build2K()
{
    export LOTUS_PATH=$LOTUS_PATH_2K/lotus

    export LOTUS_MINER_PATH=$LOTUS_PATH_2K/lotusminer

    export LOTUS_REDIS_PATH=127.0.0.1:6379-2-t09190-15

    export CURRENT_MINER_STORAGE_PATH=$CURRENT_MINER_STORAGE_PATH

    export FIL_PROOFS_PARAMETER_CACHE=/nfs/v28

    export FULLNODE_API_INFO=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJBbGxvdyI6WyJyZWFkIiwid3JpdGUiLCJzaWduIiwiYWRtaW4iXX0.3WWg-DgoaFca233ygnFkwlOZmFDS61yGbb34foyDfFk:/ip4/192.168.14.14/tcp/1234/http

    export TMPDIR=$LOTUS_PATH_2K

    if [[ $(grep LOTUS_MINER_PATH ~/.bashrc |wc -l) > 0 ]]
    then
        sed -i /LOTUS_MINER_PATH=/d ~/.bashrc
    fi
    echo "export LOTUS_MINER_PATH=$LOTUS_PATH_2K/lotusminer" >> ~/.bashrc

    if [[ $(grep LOTUS_PATH ~/.bashrc |wc -l) > 0 ]]
    then
        sed -i /LOTUS_PATH=/d ~/.bashrc
    fi
    echo "export LOTUS_PATH=$LOTUS_PATH_2K/lotus" >> ~/.bashrc

    if [[ $(grep TMPDIR ~/.bashrc |wc -l) > 0 ]]
    then
        sed -i /TMPDIR=/d ~/.bashrc
    fi
    echo "export TMPDIR=$LOTUS_PATH_2K" >> ~/.bashrc

    if [[ $(grep CURRENT_MINER_STORAGE_PATH ~/.bashrc |wc -l) > 0 ]]
    then
        sed -i /CURRENT_MINER_STORAGE_PATH=/d ~/.bashrc
    fi
    echo "export CURRENT_MINER_STORAGE_PATH=$CURRENT_MINER_STORAGE_PATH" >> ~/.bashrc

    if [[ $(grep FULLNODE_API_INFO ~/.bashrc |wc -l) > 0 ]]
    then
        sed -i /FULLNODE_API_INFO=/d ~/.bashrc
    fi
    echo "export FULLNODE_API_INFO=$FULLNODE_API_INFO" >> ~/.bashrc

#    env RUSTFLAGS="-C target-cpu=native -g" FIL_PROOFS_USE_GPU_COLUMN_BUILDER=1 FIL_PROOFS_USE_GPU_TREE_BUILDER=1 FFI_BUILD_FROM_SOURCE=1 make clean all  &&

#    export LOTUS_SKIP_GENESIS_CHECK=_yes_

#    ./lotus-seed --sector-dir $LOTUS_PATH_2K/genesis-sectors pre-seal --sector-size 2KiB --num-sectors 2

#    ./lotus-seed genesis new $LOTUS_PATH_2K/localnet.json

#    ./lotus-seed genesis add-miner $LOTUS_PATH_2K/localnet.json $LOTUS_PATH_2K/genesis-sectors/pre-seal-t01000.json

#    nohup ./lotus daemon --lotus-make-genesis=$LOTUS_PATH_2K/dev.gen --genesis-template=$LOTUS_PATH_2K/localnet.json --bootstrap=false  >> $LOTUS_PATH_2K/daemon.log 2>&1 &

#    ./lotus wallet import --as-default $LOTUS_PATH_2K/genesis-sectors/pre-seal-t01000.key

#    while [[ $? != 0  ]]
#    do 
#        sleep 1s
#        ./lotus wallet import --as-default $LOTUS_PATH_2K/genesis-sectors/pre-seal-t01000.key
#    done

    ./lotus-miner init --sector-size=512MiB --owner=$(./lotus wallet default)
    sed -i -e "/127.0.0.1/s/^#\s*//;s/127.0.0.1/${localIp}/" \
        -e '/AllowPreCommit1/s/^#\s*//;/AllowPreCommit1/s/true/false/' \
        -e '/AllowPreCommit2/s/^#\s*//;/AllowPreCommit2/s/true/false/' \
        -e '/AllowCommit/s/^#\s*//;/AllowCommit/s/true/false/' \
        -e '/AllowUnseal/s/^#\s*//;/AllowUnseal/s/true/false/' ${LOTUS_PATH_2K}/lotusminer/config.toml 
    nohup ./lotus-miner run >> $LOTUS_PATH_2K/miner.log 2>&1 &

    ./lotus-miner log set-level --system storageminer error

    ./lotus-miner log set-level --system miner error

    while [[ $? != 0  ]]
    do 
        sleep 1s
        ./lotus-miner log set-level --system storageminer error
        ./lotus-miner log set-level --system miner error
    done
    LOTUS_MINER_JWT_TOKEN=$(./lotus-miner auth api-info --perm admin)
    sed "s#LOTUSSOURCE2K#${LOTUS_SOURCE_2K}#" ${workerDir}/lotus-miner-restart.sh > /usr/local/bin/lotus-miner-restart.sh
    chmod a+x /usr/local/bin/lotus-miner-restart.sh
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[32mlotus-miner重启脚本安装成功\033[0m"


}
# 远程启动worker(所有)
startWorkers()
{
    # 启动P1
    i=0
    PrecommitHostArray=$(echo $PrecommitHost | sed s/,/" "/)
    CommitHostArray=$(echo $CommitHost | sed s/,/" "/)
    for host in ${PrecommitHostArray[@]}
    do
        startWorker Precommit $host
    done
    for host in ${CommitHostArray[@]}
    do
        startWorker Commit $host
    done
}
# 远程启动worker（具体实现）
startWorker()
{
    sed -e s#LOTUSWORKERTASKTYPE#$1# \
        -e s#LOTUSPATHWORKERBIN#$LOTUS_PATH_WORKER_BIN# \
        -e s#LOTUSSOURCE2K#$LOTUS_SOURCE_2K# \
        -e s#LOTUSPATHWORKER2K#$LOTUS_PATH_WORKER_2K# \
        -e s#LOTUSMINERJWTTOKEN#$LOTUS_MINER_JWT_TOKEN# \
        -e s#LOTUSMINERHOSTPLACEHOLDER#$localIp# ${workerDir}/lotus-worker-start.sh > ${workerDir}/lotus-worker-start_tmp.sh

    scp ${workerDir}/lotus-worker-start_tmp.sh root@$2:/root/lotus-worker-start_tmp.sh
    ssh root@$2 "source /root/lotus-worker-start_tmp.sh" &&
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[32m$2 lotus-worker启动成功\033[0m"
}

# 主要逻辑
if [ -z $1 ]
then
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[31m找不到参数1:lotus源码的位置，example:/root/lotus-2k\033[0m"
    
fi
if [ -z $2 ]
then
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[31m找不到参数2:lotus运行产生的文件位置，example:/filecoin\033[0m"
    
fi
if [ -z $3 ]
then
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[31m找不到参数3:Worker节点上二进制文件的位置，example:/root/XDTest\033[0m"
    
fi
if [ -z $4 ]
then
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[31m找不到参数4:当前使用的Storage Path，example:/filecoin/lotusminer\033[0m"
    
fi
if [ -z $5 ]
then
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[31m找不到参数5:Worker节点上运行产生文件的位置，example:/filecoin_2k\033[0m"
    
fi
if [ -z $6 ]
then
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[31m找不到参数6:Precommit Worker的节点，example:192.168.14.42,192.168.14.43\033[0m"
    
fi
if [ -z $7 ]
then
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[31m找不到参数6:Commit Worker的节点，example:192.168.14.63,192.168.14.64\033[0m"
fi
if [ -z $8 ]
then
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[31m找不到参数7:同步节点API_TOKEN，example:FULLNODE_API_INFO=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJBbGxvdyI6WyJyZWFkIiwid3JpdGUiLCJzaWduIiwiYWRtaW4iXX0.AD-7Nd36yzVkx7w36nXTz2V3gjncWuiUKxxEedmOvpQ:/ip4/192.168.14.148/tcp/1234/http"
fi
if [ $# -eq 8 ] 
then
    LOTUS_SOURCE_2K=$1
    LOTUS_PATH_2K=$2
    LOTUS_PATH_WORKER_BIN=$3
    CURRENT_MINER_STORAGE_PATH=$4
    LOTUS_PATH_WORKER_2K=$5
    PrecommitHost=$6
    CommitHost=$7
    localIp=$(ifconfig|grep 'inet 192.168'|awk '{print $2}')
    workerDir=$(pwd)
    cd $LOTUS_SOURCE_2K 
    clean2K
    build2K
    startWorkers
fi

echo -e "[\033[32mfarmer-hoe\033[0m] \033[32m结束\033[0m"

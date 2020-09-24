#//bin/bash
target=/usr/local/bin
LOTUS_SOURCE_2K=LOTUSSOURCE2K
if [[ ! -e $LOTUS_SOURCE_2K/lotus-miner ]]
then
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[31m源码目录不存在二进制文件\033[0m"
else
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[32m开始重启lotus-miner...\033[0m"
    $LOTUS_SOURCE_2K/lotus-miner stop
    while [[ $(ps -ef | grep lotus-miner | grep -v grep |wc -l) >0 ]]
    do 
        sleep 1s
    done
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[32m关闭lotus-miner成功\033[0m"
    nohup $LOTUS_SOURCE_2K/lotus-miner run --nosync >> $TMPDIR/miner.log 2>&1 &
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[32m重启lotus-miner\033[0m"
    $LOTUS_SOURCE_2K/lotus-miner log set-level --system storageminer error >/dev/null 2>&1 

    $LOTUS_SOURCE_2K/lotus-miner log set-level --system miner error >/dev/null 2>&1

    while [[ $? != 0  ]]
    do 
        sleep 1s
        $LOTUS_SOURCE_2K/lotus-miner log set-level --system storageminer error >/dev/null 2>&1 
        $LOTUS_SOURCE_2K/lotus-miner log set-level --system miner error >/dev/null 2>&1 
    done
    echo -e "[\033[32mfarmer-hoe\033[0m] \033[32m设置log级别成功\033[0m"
fi
#/bin/bash
taskType=LOTUSWORKERTASKTYPE
LOTUS_PATH_WORKER_BIN=LOTUSPATHWORKERBIN
LOTUS_SOURCE_2K=LOTUSSOURCE2K
LOTUS_PATH_WORKER_2K=LOTUSPATHWORKER2K
export MINER_STORAGE_PATH=/nfs/lotusminer_public_2k
export LOTUSMINERJWTTOKEN
kill -9 $(ps -ef | grep lotus-worker|grep -v color|grep ${LOTUS_PATH_WORKER_BIN} |awk '{print $2}')
mkdir ${LOTUS_PATH_WORKER_BIN}
mkdir ${LOTUS_PATH_WORKER_2K}
rm -fr ${LOTUS_PATH_WORKER_2K}/worker.log
rm -fr ${LOTUS_PATH_WORKER_2K}/lotusworker/sealed/*
rm -fr ${LOTUS_PATH_WORKER_2K}/lotusworker/unsealed/*
rm -fr ${LOTUS_PATH_WORKER_2K}/lotusworker/cache/*
scp root@LOTUSMINERHOSTPLACEHOLDER:${LOTUS_SOURCE_2K}/lotus-worker ${LOTUS_PATH_WORKER_BIN}/lotus-worker
if [[ $taskType == Precommit ]]
then
    nohup env FIL_PROOFS_PARENT_CACHE=${LOTUS_PATH_WORKER_2K} FIL_PROOFS_USE_GPU_TREE_BUILDER=1 FIL_PROOFS_USE_GPU_COLUMN_BUILDER=1 FIL_PROOFS_MAXIMIZE_CACHING=1  LOTUS_WORKER_PATH=${LOTUS_PATH_WORKER_2K}/lotusworker FIL_PROOFS_PARAMETER_CACHE=/root/v28 TMPDIR=${LOTUS_PATH_WORKER_2K} RUST_LOG=Trace ${LOTUS_PATH_WORKER_BIN}/lotus-worker run --addpiece=true --precommit1=true  --precommit2=true --unseal=false --commit=false --parallel-fetch-limit=15 --listen=$(ifconfig|grep "inet 25.10"|awk '{print $2}'):20827> ${LOTUS_PATH_WORKER_2K}/worker.log 2>&1 &
elif [[ $taskType == Commit ]]
then
    nohup env FIL_PROOFS_PARENT_CACHE=${LOTUS_PATH_WORKER_2K} FIL_PROOFS_USE_GPU_TREE_BUILDER=1 FIL_PROOFS_USE_GPU_COLUMN_BUILDER=1 FIL_PROOFS_MAXIMIZE_CACHING=1  LOTUS_WORKER_PATH=${LOTUS_PATH_WORKER_2K}/lotusworker FIL_PROOFS_PARAMETER_CACHE=/root/v28 TMPDIR=${LOTUS_PATH_WORKER_2K} RUST_LOG=Trace ${LOTUS_PATH_WORKER_BIN}/lotus-worker run --addpiece=false --precommit1=false  --precommit2=false --unseal=false --commit=true --parallel-fetch-limit=15 --listen=$(ifconfig|grep "inet 25.10"|awk '{print $2}'):20827> ${LOTUS_PATH_WORKER_2K}/worker.log 2>&1 &
fi

#/bin/bash
taskType=Commit
LOTUS_PATH_WORKER_BIN=/root/XDTest
LOTUS_SOURCE_2K=/root/lotus-camod
LOTUS_PATH_WORKER_2K=/filecoin
export MINER_STORAGE_PATH=/nfs/lotusminer_public_2k
export MINER_API_INFO=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJBbGxvdyI6WyJyZWFkIiwid3JpdGUiLCJzaWduIiwiYWRtaW4iXX0.GUHLN6jEN1-jOL1P49ojL9NTnABbX4eTgue6Ebb4LqQ:/ip4/127.0.0.1/tcp/2345/http
kill -9 $(ps -ef | grep lotus-worker|grep -v color|grep ${LOTUS_PATH_WORKER_BIN} |awk '{print $2}')
mkdir ${LOTUS_PATH_WORKER_BIN}
mkdir ${LOTUS_PATH_WORKER_2K}
rm -fr ${LOTUS_PATH_WORKER_2K}/worker.log
rm -fr ${LOTUS_PATH_WORKER_2K}/lotusworker/sealed/*
rm -fr ${LOTUS_PATH_WORKER_2K}/lotusworker/unsealed/*
rm -fr ${LOTUS_PATH_WORKER_2K}/lotusworker/cache/*
scp root@192.168.14.50:${LOTUS_SOURCE_2K}/lotus-worker ${LOTUS_PATH_WORKER_BIN}/lotus-worker
if [[ $taskType == Precommit ]]
then
    nohup env FIL_PROOFS_PARENT_CACHE=${LOTUS_PATH_WORKER_2K} FIL_PROOFS_USE_GPU_TREE_BUILDER=1 FIL_PROOFS_USE_GPU_COLUMN_BUILDER=1 FIL_PROOFS_MAXIMIZE_CACHING=1  LOTUS_WORKER_PATH=${LOTUS_PATH_WORKER_2K}/lotusworker FIL_PROOFS_PARAMETER_CACHE=/nfs/v28 TMPDIR=${LOTUS_PATH_WORKER_2K} RUST_LOG=Info ${LOTUS_PATH_WORKER_BIN}/lotus-worker run --addpiece=true --precommit1=true  --precommit2=true --unseal=false --commit=false --parallel-fetch-limit=15 --listen=$(ifconfig|grep "inet 192.168"|awk '{print $2}'):20827> ${LOTUS_PATH_WORKER_2K}/worker.log 2>&1 &
elif [[ $taskType == Commit ]]
then
    nohup env FIL_PROOFS_PARENT_CACHE=${LOTUS_PATH_WORKER_2K} FIL_PROOFS_USE_GPU_TREE_BUILDER=1 FIL_PROOFS_USE_GPU_COLUMN_BUILDER=1 FIL_PROOFS_MAXIMIZE_CACHING=1  LOTUS_WORKER_PATH=${LOTUS_PATH_WORKER_2K}/lotusworker FIL_PROOFS_PARAMETER_CACHE=/nfs/v28 TMPDIR=${LOTUS_PATH_WORKER_2K} RUST_LOG=Info ${LOTUS_PATH_WORKER_BIN}/lotus-worker run --addpiece=false --precommit1=false  --precommit2=false --unseal=false --commit=true --parallel-fetch-limit=15 --listen=$(ifconfig|grep "inet 192.168"|awk '{print $2}'):20827> ${LOTUS_PATH_WORKER_2K}/worker.log 2>&1 &
fi

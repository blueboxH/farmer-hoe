# FARMER-HOE
Helper scripts for [blueboxH/lotus](https://github.com/blueboxH/lotus),function set:
+ ## 2K
    + #### build-2k.sh
        ```
        source build-2k.sh LOTUS_SOURCE_2K LOTUS_PATH_2K LOTUS_PATH_WORKER_BIN LOTUS_PATH_WORKER_2K PrecommitHost CommitHost
        ```
        参数解释：

        *LOTUS_SOURCE_2K* : lotus源码的位置，比如：`/root/lotus-2k`

        *LOTUS_PATH_2K* : lotus daemon以及lotus miner在运行时生成的文件位置，比如：`/filecoin`

        *LOTUS_PATH_WORKER_BIN* : lotus-worker的文件位置（在worker节点上），比如：`/root/XDTest`

        *CURRENT_MINER_STORAGE_PATH* : lotus-miner当前使用的storage路径，比如：`/filecoin/lotusminer`
        
        *LOTUS_PATH_WORKER_2K* : lotus-worker在运行时生成的文件位置（在worker节点上），比如：`/filecoin`

        *PrecommitHost* : 负责Precommit的机器列表，用 `,` 做分隔符，比如：`192.168.14.42,192.168.14.43`

        *CommitHost* : 负责Commit2的机器列表，用 `,` 做分隔符，比如：`192.168.14.63,192.168.14.64`

        备注：
        
        1.挂载点需要自行处理，因为挂载的文件系统不确定。（miner和worker启动前确定好挂载点正确以及lotus-worker-start.sh上的环境变量正确）

    + #### lotus-miner-restart.sh（模板脚本）
        运行build-2k.sh后自动部署，直接运行`lotus-miner-restart.sh`重启miner

    + #### lotus-worker-start.sh（模板脚本）
        被动脚本用于远程启动worker，启动前请检查MINER_STORAGE_PATH变量是否正常（lotus-worker需要自行处理挂载点）


TODO set : [TODO.md](TODO.md)
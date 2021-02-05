let { sm } = require("jssm")
let { DealStatusEnum, DataTransferStatusEnum, lotusClientImport } = require("./utils.js")
const child_process = require("child_process")
const EventEmitter = require('events');
const deal_state_matchine = sm`
Init 'begin' => FileNoDeal 'lotusClientImport' => FileLotusImported 'lotusClientDeal' => FileLotusSending 'lotusSendCompleted' => Completed;
Init 'restoreFileImported' -> FileLotusImported;
Init 'restoreFileLotusSending' -> FileLotusSending;
Init 'restoreCompleted' -> Completed;
Init 'restoreDealFailure' -> FileLotusSendFailure;
FileLotusSending 'fileDealFail' -> FileLotusSendFailure;
FileLotusSendFailure 'reDealFile' -> FileLotusSending;
`
let configs = require('../configuration.json')

let log = require("./log.js")

class DealProcessor extends EventEmitter {
	constructor(id) {
		super()
		this.taskId = id
		this.sm = deal_state_matchine
		this.synced = false
		this.taskStatus = {}
		this.stoping = false
		log.info(`task ${id} started`)
	}
	stop() {
		this.stoping = true
	}
	// 转换状态
	__transition(taskStatus) {
		let targetStatus = ''
		this.taskStatus = taskStatus
		let currentStatus = this.sm.state()
		if (taskStatus.deal_state && taskStatus.transfer_status) {
			let deal_status = DealStatusEnum[taskStatus.deal_state]
			let transfer_status = DataTransferStatusEnum[taskStatus.transfer_status]
			log.debug(`task ${this.taskId} deal_status: ${deal_status} transfer_status: ${ transfer_status }`)
			switch (true) {
				// 交易传输完毕 以及 数据传输完毕
				case ([3, 4].indexOf(deal_status) !== -1) && (transfer_status === 2):
					targetStatus = 'Completed'
					break;
				// 交易传输中 以及数据传输中
				case (deal_status === 2) && (transfer_status === 0):
					targetStatus = 'FileLotusSending'
					break;
				case (deal_status === 1):
					targetStatus = 'FileLotusSendFailure'
					break;
				default:
					break;
			}
		} else if (taskStatus.deal_state) {
			// 交易发出但是还没开始传输 也算传输中
			let deal_status = DealStatusEnum[taskStatus.deal_state]
			log.debug(`task ${this.taskId} deal_status: ${deal_status}`)
			switch (true) {
				// 交易传输完毕 以及 数据传输完毕
				case ([3, 4].indexOf(deal_status) !== -1):
					targetStatus = 'Completed'
					break;
				// 交易传输中 以及数据传输中
				case (deal_status === 2):
					targetStatus = 'FileLotusSending'
					break;
				case (deal_status === 1):
					targetStatus = 'FileLotusSendFailure'
					break;
				default:
					break;
			}

		} else if (taskStatus.data_cid) {
			// 只有Import了文件
			targetStatus = 'FileLotusImported'
		} else {
			// 开始
			targetStatus = 'FileNoDeal'
		}

		if (targetStatus === currentStatus) {
			log.debug(`Task ${this.taskId} Stay status ${currentStatus}`)
			return
		}
		if (this.stoping) {
			log.debug(`Task ${this.taskId} can stop now`)
			process.send({
				type: 'TasksStoped'
			})
			return
		}
		// 触发新状态的回调
		// 注意 每次发出停止指令 要等下一个状态转化且不触发下一个动作就退出 重启后再执行下一个动作，所以这个地方设计为只要状态发生变化就触发动作
		if (this.sm.transition(targetStatus)) {
			log.info(`Task ${this.taskId} Change status to ${this.sm.state()}`)
			this.emit(targetStatus, taskStatus)
			return
		} else {
			log.error(`Task ${this.taskId} Fail to change status ${this.sm.state()} to ${targetStatus}`)
			log.error(`unTransform taskStatus:`, taskStatus)
			return `Task ${this.taskId} Fail to change status ${this.sm.state()} to ${targetStatus}`
		}
	}
	// 恢复状态机状态
	__restoreStatus(taskStatus) {
		return this.__transition(taskStatus)

	}
	__drive(taskStatus) {
		return this.__transition(taskStatus)
	}
	updateStatus(taskStatus) {
		let smError
		if (!this.synced) {
			smError = this.__restoreStatus(taskStatus)
			this.synced = true
		} else {
			smError = this.__drive(taskStatus)
		}
		if (smError) {
			// 状态机错误？
			log.error(`task ${this.taskId} statemachine error`)
		}

	}
}


let dp = new DealProcessor(parseInt(process.argv[2]))
dp.on('FileNoDeal', async function (taskStatus) {
	// just begin
	await lotusClientImport(taskStatus.file_path)

})
dp.on('FileLotusImported', function (taskStatus) {
	// lotus deal
	log.info(`Task ${taskStatus.task_id} start deal file`)
	log.debug(`Task ${taskStatus.task_id} lotus client deal --from ${configs.application_address} ${taskStatus.data_cid} ${taskStatus.miner_id} ${configs.price} 518400`)
	child_process.exec(`lotus client deal --from ${configs.application_address} ${taskStatus.data_cid} ${taskStatus.miner_id} ${taskStatus.price} 518400`, {}, function (error, stdout, stderr) {
		if (error) {
			log.error(`Task ${taskStatus.task_id} generate deal failure, please check configuration: ${stderr}`)
			// retry?
			
			return
		}
		log.info(`Task ${taskStatus.task_id} dealing ${stdout}`)
		// record deal_cid
		process.send({
			type: 'NewDeal',
			payload: stdout.replace("\n", "")
		})
	})
})
dp.on('FileLotusSending', function (taskStatus) {
	// waitSending
	log.info(`Task ${taskStatus.task_id} wait for sending completed`)
})
dp.on('FileLotusSendFailure', function (taskStatus) {
	// deal failure 准备重新发一次交易
	log.info(`Task ${taskStatus.task_id} Deal failure, plan to reDeal file: ${taskStatus.message}`)
	child_process.exec(`lotus client deal --from ${configs.application_address} ${taskStatus.data_cid} ${taskStatus.miner_id} ${taskStatus.price} 518400`, {}, function (error, stdout, stderr) {
		if (error) {
			log.error(`Task ${taskStatus.task_id} generate deal failure, please check configuration: ${stderr}`)
			// retry?

			return
		}
		log.info(`Task ${taskStatus.task_id} dealing ${stdout}`)
		// record deal_cid
		process.send({
			type: 'NewDeal',
			payload: stdout.replace("\n", "")
		})
	})
})
dp.on('Completed', function (taskStatus) {
	// completed and exit

	log.info(`Task ${taskStatus.task_id} completed`)
	process.send({
		type: 'TaskCompleted',
		payload: {
			task_id: taskStatus.task_id
		}
	})
})

process.on('message', function (msg) {
	switch (msg.type) {
		case 'LotusDaemonError':
			dp.stop()
			break;
		case 'updateStatus':
			log.debug(process.pid," receive status",JSON.stringify(msg.payload))
			dp.updateStatus(msg.payload)
			break;
		case 'shutdown':
			dp.stop()
			break;
		default:
			break;
	}
})
process.on('SIGTERM', function () {
	log.debug(`Task ${dp.taskId} receive SIGTERM, stop process`)
	process.exit()
})


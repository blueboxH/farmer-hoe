const child_process = require("child_process")
let db  = require("./db.js")
let { patchDataCid,wait } = require("./utils.js")
const path = require('path')

let log = require("./log.js")


class DealManager{
	constructor(options){
		// 恢复上一次的状态（已通过停止机制保证状态的完整性）
		let tasksStatus = db.getFileDeals()
		this.tasks = tasksStatus.map(e => ({
			task_id:e.task_id,
			task_status:e,
			child_process:null
		}))
		db.setControlStatus('running')
		this.control_status = 'running'
	}
	__getPendingTasks(){
		return this.tasks.filter(e => e.task_status.progressing == 1)
	}
	__getRunningTasks(){
		return this.tasks.filter(e=>e.child_process)
	}
	__getCompletedTasks(){
		return this.tasks.filter(e => e.task_status.progressing == 2)
	}
	__getUnStartTasks(){
		return this.tasks.filter(e => e.task_status.progressing == 0)
	}
	syncDealStatus(tasksStatus){
		db.updateFileDeals(tasksStatus)
	}
	async updateCurrentPendingDealsStatus(){
		// 混合deals 和transfers命令的查询结果 更新到pendingTasks上
		function patchQueryResults(pendingTasks,queryResults) {
			for(let task of pendingTasks){
				if(task.task_status.deal_cid){
					let taskDealStatus = queryResults[1].find(e => (task.task_status.deal_cid === e.deal_cid))
					if (taskDealStatus){
						task.task_status.deal_date = taskDealStatus.date
						task.task_status.deal_state = taskDealStatus.state
						task.task_status.deal_size_in_bytes = taskDealStatus.size
						task.task_status.message = taskDealStatus.message

					}
					let deal_cid_last25 = task.task_status.deal_cid.slice(-25)
					let taskTransferStatus = queryResults[0].find(e => (e.elliptical_deal_cid.endsWith(deal_cid_last25)))
					if (taskTransferStatus){
						task.task_status.transfer_status = taskTransferStatus.transfer_status
					}
				}
				
			}
		}
		let pendingTasks = this.__getPendingTasks()

		await patchDataCid(pendingTasks.map(e=>e.task_status));
		Promise.all([this.queryTransfers(), this.queryDeals()]).then(queryResults=>{
			log.debug("queryResults", queryResults)
			patchQueryResults(pendingTasks, queryResults)
			// sync with sqlite and deals processes
			this.syncDealStatus(pendingTasks.map(e => e.task_status))
			// update status for child_process

			this.__getPendingTasks().forEach(e => {
				e.child_process && e.child_process.send({
					type: 'updateStatus',
					payload: e.task_status
				})
			})
			log.debug(`success update task status for sub processes: `,this.__getPendingTasks())
		}, queryDealsStatusError=>{
			log.error("Query status Error,please check lotus services and application status: " + queryDealsStatusError)
			return
		})

		

	}
	// 处理控制信号
	handleControlStatusChange(){
		let control_status = db.getControlStatus()
		if (this.control_status !== control_status) {
			let [action, ...params] = control_status.split(' ')
			
			//处理信号变化
			switch(action){
				case 'stoping':
					this.__getPendingTasks().forEach(e => {
						e.child_process.send({
							type: 'shutdown'
						})
					})
					break;
				case 'addminer':
					let newTasksStatus = db.getNewTasks(Math.max(...this.tasks.map(e => e.task_id)))
					for (let s of newTasksStatus){
						this.tasks.push({
							task_id:s.task_id,
							task_status:s,
							child_process:null
						})
					}
					db.setControlStatus('running')
					break;
				case 'running':
					break;
			}
		}
		this.control_status = control_status
	}
	// 保持任务线程
	keepTaskProcess(){
		let startProcess = (task)=>{
			if (!task.child_process){
				let cp = child_process.fork(path.resolve(__dirname, './deal.js'), [task.task_id])
				cp.on('message', (msg) => {
					switch (msg.type) {
						case 'NewDeal':
							task.task_status.deal_cid = msg.payload
							break;
						case 'TaskCompleted':

							if (!cp.kill()) {
								log.error(`[DealManager] task ${msg.payload.task_id} send kill signal error`)

							} else {
								task.task_status.progressing = 2
								this.syncDealStatus([task.task_status])
								task.child_process = null
								log.info(`[DealManager] task ${msg.payload.task_id} completed`)
							}
							break;
						case 'TasksStoped':
							if (!cp.kill()) {
								log.error(`[DealManager] task ${task.task_status.task_id} send kill signal error`)

							} else {
								task.child_process = null
								log.info(`[DealManager] task ${task.task_status.task_id} graceful shutdown`)
							}
							break;
						default:
							log.error('unsupported msg from task ', task.task_status.task_id)
							break;
					}
				})
				cp.on('exit', function(code, signal) {
					log.debug(task.task_status.task_id, code, signal)
					if (code !== 0) {
						log.warning('[DealManager] unexcept task process exit,restart process')
						startProcess(task)
					}
				})
				task.child_process = cp
			}
		}
		if (this.control_status !== 'stoping') {
			let pendingTasks = this.__getPendingTasks()
			pendingTasks.forEach(startProcess)
		}else {
			log.info('[DealManager] stoping,skip process keeper')
		}
	}
	// 根据最新的状态更新任务
	async walk(){
		// 处理控制信号
		this.handleControlStatusChange()
		
		// 更新任务状态（线程以及管理线程）
		await this.updateCurrentPendingDealsStatus()
		// 更新任务状态（开启任务、保持任务数量）
		let pendingTasksNum = (this.control_status === 'stoping')?0:4
		let pendingTasks = this.__getPendingTasks()
		let unStartTasks = this.__getUnStartTasks()
		for (let i = 0; i < pendingTasksNum - pendingTasks.length;i++){
			let newTask = unStartTasks.shift()
			if(newTask){
				newTask.task_status.progressing = 1
			}else {
				log.info('reach end of tasks')
				break;
			}
		}
		
		this.keepTaskProcess()
		if(this.control_status === 'stoping' && (this.__getRunningTasks().length === 0)){
			log.info('[DealManager] Graceful shutdown')
			process.exit()
		}
		log.debug("walk circle end")

	}

	// 查询数据传输的状态（所有进行中的交易）
	queryTransfers() {
		return new Promise((resolve, reject) => {
			let queryFilter = this.__getPendingTasks().filter(e=>e.data_cid)

			if(queryFilter.length){
				let queryFilter_str = queryFilter.map(e => e.data_cid.slice(-8)).join('\\|')
				child_process.exec(`lotus client list-transfers --show-failed --completed | grep -e "\\(${queryFilter_str}\\)"`, {
					cwd: process.cwd(),

				}, function(error, stdout, stderr) {
					if (error && error.code !== 1) {
						
						reject(stderr)
						return
					}
					let rows = stdout.split('\n')
					let results = []
					let r = /(?<id>\d+)\s{2,}(?<transfer_status>.+)\s{2,}(?<elliptical_target_peer_id>\S+)\s{2,}(?<elliptical_data_cid>\S+)\s{2,}(?<initiated>\S+)\s{2,}(?<transferred>\S+)\s{2,}(?<elliptical_deal_cid>\S+)/
					for (let i = 0; i < rows.length; i++) {
						let matches = rows[i].match(r)
						matches && results.push(matches.groups)
					}
					log.debug("queryTransfers",results)
					resolve(results)

				})
			}else {
				resolve([])
			}
			
		})
	}
	// 查询Deal的状态（所有进行中的交易）
	queryDeals() {
		return new Promise((resolve, reject) => {
			let queryFilter = this.__getPendingTasks().filter(e => e.task_status.deal_cid)

			if (queryFilter.length){
				let queryFilter_str = queryFilter.map(e => e.task_status.deal_cid).join('\\|')
				log.debug(`lotus client list-deals -v --show-failed | grep -e "\\(${queryFilter_str}\\)"`)
				child_process.exec(`lotus client list-deals -v --show-failed | grep -e "\\(${queryFilter_str}\\)"`, {
					cwd: process.cwd(),

				}, function(error, stdout, stderr) {
					if (error && error.code !== 1) {
						
						reject(stderr)
						return
					}
					let rows = stdout.split('\n')
					let results = []
					let r = /^(?<date>\S+\s+\S+\s+\S+)\s{2,}(?<deal_cid>.+)\s{2,}(?<deal_id>\S+)\s{2,}(?<provider>\S+)\s{2,}(?<state>\S+)\s{2,}(?<on_chain>Y|N)\s{2,}(?<slashed>Y|N)\s{2,}(?<piece_cid>\S+)\s{2,}(?<size>.+)\s{2,}(?<price>.+)\s{2,}(?<duration>.+)\s{2,}(?<verified>\S+)\s{2,}(?<message>.*)$/
					for (let row of rows) {
						let matches = row.match(r)
						log.debug('queryDeal match',matches)
						matches && results.push(matches.groups)
					}
					log.debug("queryDeals", results)
					resolve(results)

				})
			}else {
				resolve([])
			}
			
		})

	}

}
module.exports = DealManager


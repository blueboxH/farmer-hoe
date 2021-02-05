const fs = require("fs")
const path = require("path")
const splitFile = require('split-file');
const child_process = require('child_process')
const lockfile = require("lockfile")

const tmpDir = path.join(__dirname, "../tmp/")
let log = require('./log.js')

function deleteFolderRecursive(url) {
	let files = [];
	/**
	 * 判断给定的路径是否存在
	 */
	if (fs.existsSync(url)) {
		/**
		 * 返回文件和子目录的数组
		 */
		files = fs.readdirSync(url);
		files.forEach(function (file, index) {
			const curPath = path.join(url, file);
			log.debug(`delete ${curPath}`);
			/**
			 * fs.statSync同步读取文件夹文件，如果是文件夹，在重复触发函数
			 */
			if (fs.statSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath);

			} else {
				fs.unlinkSync(curPath);
			}
		});
		/**
		 * 清除文件夹
		 */
		fs.rmdirSync(url);

	} else {
		log.error("给定的路径不存在，请给出正确的路径");
	}
}
/**
  *  @function splite_file 切分文件
  *  @params file 文件名（绝对路径）
  *  @params tempDir 分片文件地址
  */
function split_file(file, size) {
	return new Promise((resolve, reject) => {
		splitFile.splitFileBySize(file, size)
			.then((names) => {
				resolve(names);
			})
			.catch(reject);
	})
}
// 影响处理方式： 0 :未知 交易状态未知 1 :交易拒绝,交易错误 2 :交易传输中 3 :交易已经传输完成 4 :交易生效 5 :交易失效 -1 :无用状态
const DealStatusEnum = {
	'StorageDealUnknown ': 0,
	'StorageDealProposalNotFound': 0,
	'StorageDealProposalRejected': 1,
	'StorageDealProposalAccepted': 2,
	'StorageDealStaged': 2,
	'StorageDealSealing': 3,
	'StorageDealFinalizing': 3,
	'StorageDealAwaitingPreCommit': 3,
	'StorageDealClientFunding': 2,
	'StorageDealActive': 4,
	'StorageDealExpired': 5,
	'StorageDealSlashed': 5,
	'StorageDealRejecting': -1,
	'StorageDealFailing': 1,
	'StorageDealFundsReserved': 2,
	'StorageDealCheckForAcceptance': 2,
	'StorageDealReserveClientFunds': 2,
	'StorageDealValidating': -1,
	'StorageDealAcceptWait': -1,
	'StorageDealStartDataTransfer': 2,
	'StorageDealTransferring': 2,
	'StorageDealWaitingForData': -1,
	'StorageDealVerifyData': 2,
	'StorageDealReserveProviderFunds': 2,
	'StorageDealPublish': 2,
	'StorageDealPublishing': 2,
	'StorageDealError': 1,
	'StorageDealProviderTransferRestart': 2,
	'StorageDealClientTransferRestart': 2

}
// 0 :processsing 1 :失败 2: 成功 -1 :无效状态
const DataTransferStatusEnum = {
	Requested: 0,
	Ongoing: 0,
	TransferFinished: 0,
	ResponderCompleted: 0,
	Finalizing: 0,
	Completing: 0,
	Completed: 2,
	Failing: 1,
	Failed: 1,
	Cancelling: -1,
	Cancelled: -1,
	InitiatorPaused: -1,
	ResponderPaused: -1,
	BothPaused: -1,
	ResponderFinalizing: -1,
	ResponderFinalizingTransferFinished: -1,
	ChannelNotFoundError: -1
}
function patchDataCid(tasksStatus) {
	return new Promise((resolve, reject) => {
		child_process.exec(`lotus client local`, function (error, stdout, stderr) {
			if (error) {
				reject(stderr)
				return
			}
			let r = /\d+:\s(?<data_cid>\S+)\s@(?<file_path>\S+)\s\(import\)/g
			let currentResult;
			while (currentResult = r.exec(stdout)) {
				let tasksFound = tasksStatus.filter(e => (e.file_path === currentResult.groups.file_path))
				for (let task of tasksFound) {
					task.data_cid = currentResult.groups.data_cid
				}

			}
			resolve()
		})
	})
}
function wait(ms) {
	return new Promise((resolve, reject) => {
		setTimeout(resolve, ms)
	})
}
async function lotusClientImport(file_path) {
	let temp_file_path = path.join(tmpDir, "requested_file_path");
	let temp_file_path_lock = path.join(tmpDir, "requested_file_path.lock")
	let sendFlag = false
	lockfile.lockSync(temp_file_path_lock, {
		retries: 5000,
	})
	if (!fs.existsSync(temp_file_path)) {
		fs.writeFileSync(temp_file_path, file_path + ',')
		sendFlag = true
	} else {
		let cached_imported_file_path = fs.readFileSync(temp_file_path, {
			encoding: 'utf8'
		}).split(',');
		if (cached_imported_file_path.findIndex(e => e === file_path) === -1) {
			sendFlag = true
			try {
				fs.appendFileSync(temp_file_path, `${file_path},`);
			} catch (err) {
				/* 处理错误 */
				log.error('record requested_file_path failure')
			}
		} else {
			sendFlag = false
			log.info(`this file is imported or importing: ${ file_path }`)
		}


	}
	if (sendFlag) {
		// 发送 lotus client import
		child_process.exec(`lotus client import ${file_path}`, {}, function (error, stdout, stderr) {
			if (error) {
				log.error(`lotus client error: ${ stderr }`)
				return
			}
			log.info(`lotus imported path: ${file_path} , data_cid: ${stdout}`)
		})
	}

	lockfile.unlockSync(temp_file_path_lock)
}
module.exports = {
	deleteFolderRecursive,
	split_file,
	DealStatusEnum,
	DataTransferStatusEnum,
	patchDataCid,
	lotusClientImport,
	wait
}
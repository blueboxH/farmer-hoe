const { deleteFolderRecursive, split_file, wait } = require("./libs/utils.js")
const db = require("./libs/db.js")
const fs = require("fs")
const path = require("path")
const glob = require("glob")
let log = require("./libs/log.js")
let function_name = process.argv[2]

process.on("exit", function () {
	db.close()
});

(async function () {
	switch (function_name) {
		case "clean":
			clean();
			break;
		case "init":
			await init()
			break;
		case "start":
			await start();
			break;
		case "stop":
			stop();
			break;
		case "addminer":
			addminer();
			break;
		default:
			log.error("ERROR: not allowed operation");
			break;
	}
})()


// function clean
function clean() {
	for (let t of db.getPartialFiles()) {
		try {
			fs.unlinkSync(t.file_path)
		} catch (e) {

		}

	}
	db.close()
	deleteFolderRecursive(path.resolve(__dirname, "tmp"))

}


// function init
async function init() {
	let init_config = require("./configuration.json");
	if (fs.existsSync(path.join(__dirname, "tmp"))) {
		console.log("ERROR: please clean before init")
		return
	}
	fs.mkdirSync(path.join(__dirname, "tmp"))
	db.init({
		target: init_config.target,
		file_part_size: init_config.file_part_size, // in bytes
		file_split: init_config.file_split,		// bool in string
		miners: init_config.miners,
		application_address: init_config.application_address,
		control_status: 'initing'
	})
	console.log("kept configuration and begin calculate files")
	let files = glob.sync(`**/*`, {
		cwd: init_config.target,
		absolute: true
	})
	console.log(files)
	db.recordFiles(files)
	if (init_config.file_split) {
		// split files and record

		let files_to_split = db.findFilesToSplit(init_config.file_part_size)
		for (let file of files_to_split) {
			console.log(`start split file and record ${file.id}`)
			let split_parts = await split_file(file.file_path, init_config.file_part_size)
			db.recordPartialFiles(file, split_parts)
		}

	} else {
		// not split
	}
	// 初始化要完成的deal任务
	let miners = init_config.miners
	let tasks = []
	for (let file of db.getDealFileAll()) {
		for (let miner of miners) {
			tasks.push({
				miner_id: miner.miner_id,
				file_id: file.id,
				price: miner.price
			})
		}
	}
	db.recordDealTasks(tasks)
	db.setControlStatus('inited')
	console.log("prepared and ready to start")

}

// function start
async function start() {
	const DealManager = require("./libs/deal-manager.js")
	let dm = new DealManager()
	while (true) {
		await dm.walk()
		await wait(5000)
	}


}
// function stop
function stop() {
	db.setControlStatus('stoping')
	log.info('send stop signal,wait for graceful shutdown')
}


// function addminer while start running
function addminer() {
	if (process.argv.length < 5) {
		log.error("invalid command params")
	} else {
		let miner_id = process.argv[3]
		let price = process.argv[4]

		let configs = require('./configuration.json')
		configs.miners.push({
			miner_id,
			price
		})
		let fd_configs = fs.openSync('./configuration.json', 'w')
		fs.write(fd_configs, JSON.stringify(configs), function (err) {
			if (err) {
				log.error(err)
			}
		})
		let newTasks = []
		for (let file of db.getDealFileAll()) {
			newTasks.push({
				miner_id,
				file_id: file.id,
				price
			})
		}
		db.recordDealTasks(newTasks)
		db.setControlStatus(`addminer ${miner_id} ${price}`)

	}
}
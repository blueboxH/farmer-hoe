const path = require("path");
const default_config_file_path = path.resolve(__dirname, "../tmp/config.db")
const Database = require('better-sqlite3');
const shortid = require('shortid');
const fs = require("fs")
let log = require('./log.js')

let db;
function __initDB(){
	if (!db && fs.existsSync(default_config_file_path)) {
		db = new Database(default_config_file_path, { verbose: log.debug });
	}
}


/** @function init
  * @param options 配置项
  * 	   options.target 			目标文件夹
  *		   options.temp_dir   		临时文件夹（分片文件位置）
  *		   options.file_part_size   文件分片大小
  *
  */
function init(options){
	db = new Database(default_config_file_path, { verbose: log.debug });
	let init_sql = fs.readFileSync(path.resolve(__dirname, "../sqls/init.sql"), 'utf8');
	db.exec(init_sql)
	let config_stmt = db.prepare("INSERT INTO configs (key,value) VALUES(?,?);")
	config_stmt.run('target', options.target)
	config_stmt.run('file_part_size', options.file_part_size)
	config_stmt.run('miners', options.miners.join(','))
	config_stmt.run('application_address',options.application_address)
	config_stmt.run('control_status', options.control_status)

}
function getConfigs(){
	__initDB()
	let result = {}
	let configs = db.prepare("select * from configs").all()
	for (let c of configs){
		result[c.key] = c.value
	}
	return result
}

function recordFiles(files){
	let fi = db.prepare("INSERT INTO file_index (id,file_name,file_path,file_size,curated_dataset,file_format) VALUES(?,?,?,?,?,?);")
	for(let i of files){
		let stat = fs.statSync(i,{
			bigint:true
		})
		fi.run(shortid.generate(), path.basename(i), i, stat.size,"test dataset",path.extname(i));
	}
	
}
function findFilesToSplit(size){
	let stmt = db.prepare("select * from file_index where slice = 0 and file_size > ?")
	return stmt.all(size)
}
function getFileInfo(id){
	let stmt = db.prepare("select * from file_index where id = ?")
	return stmt.get(id)
}
/** @function recordPartialFile
  * @param mainFile 主文件的参数
  * @param fileparts 分片文件的信息
  *
  */
function recordPartialFiles(mainFile,fileparts){
	__initDB()
	let stmt = db.prepare("INSERT INTO temp_file_index (id,file_id,file_name,file_path,file_size) VALUES(?,?,?,?,?);")
	console.log(mainFile,fileparts)
	for(let part of fileparts){
		let mainFileInfo = getFileInfo(mainFile.id)
		stmt.run(shortid.generate(),mainFileInfo.id,path.basename(part),part,fs.statSync(part,{bigint:true}).size)

	}
	stmt = db.prepare("UPDATE file_index SET slice = ? WHERE id = ?")
	stmt.run(fileparts.length, mainFile.id)
}
// 获取所有分片文件
function getPartialFiles(){
	__initDB()
	let stmt = db.prepare("select file_path from temp_file_index")
	return stmt.all()
	
}
// 获取所有要发送的文件（包括不分片的和分片的）
function getDealFileAll(){
	__initDB()
	let fileAllSql = fs.readFileSync(path.resolve(__dirname, '../sqls/filesAll.sql'), 'utf8')
	let full_stmt = db.prepare(fileAllSql)
	return full_stmt.all()
}
// 获取所有的矿工
function getMiners(){
	__initDB()
	let stmt = db.prepare("select value from configs where key = miners")
	let miners_row = stmt.get()
	let miners = miners_row.value.split(',')
	return miners
}
// 获取所有Deal文件的状态 (根据taskId)
function getFileDeals(ids){
	__initDB()
	let fileDealSql = fs.readFileSync(path.resolve(__dirname,'../sqls/fileDeals.sql'),'utf8')
	if(ids){
		fileDealSql += ` where fd.id IN (?)`
	}
	let full_stmt = db.prepare(fileDealSql)
	if(ids){
		return full_stmt.all(ids.join(','))
	}else {
		return full_stmt.all()
	}
	
}
function recordDealTasks(datas){
	const insert = db.prepare('INSERT INTO file_deal (file_id,miner_id,price ) VALUES (?, ?, ?)');
	const insertMany = db.transaction((datas) => {
		for (const data of datas) insert.run(data.file_id,data.miner_id,data.price);
	});

	insertMany(datas)
}
// 更新task状态（file_deal）
function updateFileDeals(tasksStatus){
	const update = db.prepare('UPDATE file_deal SET data_cid = ?,price = ?,deal_date = ?,deal_size_in_bytes = ?,deal_state = ?,transfer_status = ?,progressing = ?,deal_cid = ? WHERE id = ?');
	const updateMany = db.transaction((tasksStatus) => {
		for (const task of tasksStatus) update.run(task.data_cid, task.price,task.deal_date, task.deal_size_in_bytes, task.deal_state, task.transfer_status, task.progressing, task.deal_cid,task.task_id);
	});

	updateMany(tasksStatus)
	
}
// 获取所有的data_cid
function getAllDataCIDs(){
	__initDB()
	let stmt = db.prepare("select DISTINCT data_cid from file_deal")
	let cid_rows = stmt.all()
	return cid_rows.map(e=>e.data_cid)
}
// 设置控制信号（进行start操作后）
function setControlStatus(signal){
	__initDB()
	let stmt = db.prepare("update configs set value = ? where key = 'control_status'")
	stmt.run(signal)
}
// 获取控制信号
function getControlStatus(){
	__initDB()
	let stmt = db.prepare("select value from configs where key = 'control_status'")
	return stmt.get().value
}
// 添加额外矿工，获取新的任务
function getNewTasks(min_id) {
	return getFileDeals().filter(e=>{
		return e.task_id > min_id
	})
}
// 释放连接
function close(){
	if(db){
		db.close()
	}
}


module.exports = {
	init,
	recordFiles,
	getConfigs,
	findFilesToSplit,
	recordPartialFiles,
	getPartialFiles,
	getFileDeals,
	updateFileDeals,
	getDealFileAll,
	recordDealTasks,
	getNewTasks,
	getAllDataCIDs,
	setControlStatus,
	getControlStatus,
	close
}
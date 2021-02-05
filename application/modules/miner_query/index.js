const https = require("https");
const child_process = require("child_process")

let load_pages = 5
let pageSize = 50;
let page = 0;
let miner_infos = []
// get miner_info per page 
function getNextMinerPage(){
	return new Promise((resolve,reject)=>{
		https.get(`https://filfox.info/api/v1/miner/list/power?pageSize=${pageSize}&page=${page}`, {}, function(response) {
			if (response.statusCode >= 300 || response.statusCode < 200) {
				reject("ERROR: request return a error status code")
				return
			}
			let result = Buffer.alloc(0)
			let totalLength = result.length
			response.on("data", function(d) {
				totalLength += d.length
				result = Buffer.concat([result, d], totalLength)
				return
			})
			response.on("end", function() {
				response.resume();
				if (!response.complete) {
					reject("ERROR: request closed abnormally")
					return
				}
				resolve(JSON.parse(result.toString()))
			})
		})
	})
	
}
// miner query per miner
function query_miner(miner_id){
	return new Promise((resolve,reject)=>{
		let countDown = setTimeout(()=>{
			reject("query 10000ms timeout")
		}, 10000)
		child_process.exec(`sh ./miner_query.sh ${miner_id}`, {
			cwd:process.cwd()
		},function(error,stdout,stderr){
			if(error){
				reject(error)
				return
			}
			if(stderr){
				reject(stderr)
			}else {
				resolve(stdout)
			}
		})
	})
}
// query miners 
function query_miners(miners){
	return new Promise((resolve,reject)=>{
		let count = miners.length
		let i = 0
		let result = []
		miners.forEach(async e => {
			let queryError;
			console.log(`start query miner ${e.address}`)
			let price = await query_miner(e.address).catch(error => {
				queryError = error
				return
			})
			if (queryError) {
				console.log(`end query miner ${e.address}: ${queryError}`)
			}else {
				console.log(`end query miner ${e.address}: ${parseFloat(price)}`)
				e.pricePerGiB = parseFloat(price)
			}
			result.push(e)
			i ++
			if (i === count){
				resolve(result)
			}
		})
	})
}

(async function(){
	while (page < load_pages) {
		let requestError;
		let i = await getNextMinerPage().catch(error=>{
			requestError = error
			console.log(error)
		})
		if(requestError){
			continue
		}
		miner_infos.push(...i.miners)
		page ++
	}
	let result = await query_miners(miner_infos)
	console.log(result)
	console.log(`finish: ${ result.length } count`)
	
})()

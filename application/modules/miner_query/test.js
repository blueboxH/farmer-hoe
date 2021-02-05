const child_process = require("child_process")

child_process.exec(`sh ./miner_query.sh f023001`, {
	cwd: process.cwd()
}, function(error, stdout, stderr) {
	console.log(error,stdout,stderr)
})
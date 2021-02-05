const path = require("path");
const default_config_file_path = path.resolve(__dirname, "../tmp/config.db")
const Database = require('better-sqlite3');
const shortid = require('shortid');
const fs = require("fs");
const { assert } = require("console");

let db;
function __initDB(){
	if (!db && fs.existsSync(default_config_file_path)) {
		db = new Database(default_config_file_path, { verbose: log.debug });
	}
}

describe("SQLite file test",function(){
    it("db file exist test",function(){
        assert.equal(fs.existsSync(default_config_file_path),true);
    })
})
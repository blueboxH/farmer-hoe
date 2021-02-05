CREATE TABLE configs(
   key  TEXT PRIMARY KEY     NOT NULL,
   value           TEXT    NOT NULL
);
-- 需要上传的文件
CREATE TABLE file_index (
	id 					TEXT PRIMARY KEY NOT NULL,
	file_name 			TEXT	NOT NULL,
	file_path			TEXT	NOT NULL,
	file_size			INTEGER,		
	curated_dataset		TEXT	NOT NULL,
	file_format			TEXT,
	slice				INTEGER default 0
);
-- 需要分片的临时文件
CREATE TABLE temp_file_index (
	id 					TEXT PRIMARY KEY NOT NULL,
	file_id 			TEXT	NOT NULL,
	file_name 			TEXT	NOT NULL,
	file_path			TEXT	NOT NULL,
	file_size			INTEGER
);
-- 每个文件deal的信息
CREATE TABLE file_deal (
	id 					INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
	file_id 			TEXT,
	miner_id			TEXT,
	price				TEXT,
	deal_cid			TEXT,
	data_cid			TEXT,
	deal_date			DATETIME,
	deal_size_in_bytes	INTEGER,
	deal_state			TEXT,		-- 交易状态
	transfer_status		TEXT,		-- 传输状态
	progressing 		INTEGER default 0 -- 0 任务未激活 1 进行中 2 已完成 10 Error
);
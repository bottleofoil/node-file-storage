var crypto = require('crypto')
var path = require('path')
var fs = require('fs')
var sqlite3 = require('sqlite3').verbose()

exports.Storage = class Storage {
    
    constructor(storageLoc){
        function mkdir(suffix){
            var loc = path.join(storageLoc, suffix)
            if (!fs.existsSync(loc)){
                fs.mkdirSync(loc)
            }
            return loc
        }
        mkdir("")
        this.tempLoc = mkdir('temp')
        this.filesByHashLoc = mkdir('files')
        var dbLoc = path.join(storageLoc, 'db.sqlite')
        var dbExists = fs.existsSync(dbLoc)
        if (!dbExists) {
            this.db = new sqlite3.Database(dbLoc)
            // name is unique index, because the task required retrieving uploaded file by name, and deleting by name. Generally in production better to use id instead.
            this.db.serialize(() => {
                this.db.run(`CREATE TABLE files (
			        id blob PRIMARY KEY,
			        name text UNIQUE, 
			        sha256 blob
		        )`)
                this.db.run(`CREATE INDEX index_files_sha256 ON files (sha256)`)
            })
        } else {
            this.db = new sqlite3.Database(dbLoc)
        }
    }

    _saveInTempLocation(stream, cb){
        var id = randomTempFileName()
        var loc = path.join(this.tempLoc, id)
        var file = fs.createWriteStream(loc)

        var hash = crypto.createHash('sha256');
        hash.setEncoding("hex")
        stream.pipe(file)
        stream.pipe(hash)
        stream.on("error", (err) => {
            console.error(err)
        })
        file.on("error", (err) => {
            console.error(err)
        })
        hash.on("error", (err) => {
            console.error(err)
        })
        var fileEnd = false        
        var hashEnd = false
        stream.on("end", () => {
        })
        file.on("finish", () => {
            fileEnd = true
            if (hashEnd) {
                done()
            }
        })
        hash.on("finish", () => {
            hashEnd = true
            if (fileEnd) {
                done()
            }
        })
        function done(){
            cb(loc, hash.read())
        }
    }
    save(name, stream, cb){
        this._saveInTempLocation(stream, (loc, sha256Hex) => {            

            this.db.get("SELECT count(*) as count FROM files WHERE sha256=$sha256", {
                $sha256: sha256Hex
            }, (err, row) => {        
                if (err != null){
                    throw err
                }
                var count = row.count
                continueWithCount.call(this, loc, sha256Hex, count)                
            })
            
        })

        function continueWithCount(loc, sha256Hex, count){
            
            // if the file already exists with the same hash do not copy it

            if (count == 0) { // no file with the same hash yet
                fs.renameSync(loc, path.join(this.filesByHashLoc, sha256Hex))
            } else {
                // file already exists, uploaded temp file not needed
                fs.unlinkSync(loc)
            }

            this.db.get("SELECT count(*) as count FROM files WHERE name=$name", {
                $name: name
            }, (err, row) => {        
                if (err != null){
                    throw err
                }
                var count = row.count

                if (count != 0) {
                    cb(null, new ErrDuplicateName)
                    return
                }

                var info = {
                    $id: randomFileID(),
                    $name: name,
                    $sha256: sha256Hex
                }

                this.db.run("INSERT INTO files (id, name, sha256) VALUES ($id,$name,$sha256)", info, (err) => {
                    if (err != null){
                        throw err
                    }                
                })

                cb(info.$id, null)
                return

            })
        }        
    }    
    _getInfoSQL(sqlWhere, params, cb){
        this.db.get(`SELECT id, name, sha256 FROM files WHERE ` + sqlWhere, params, (err, row) => {
            if (err){
                throw err
            }
            if (!row){
                cb(null, new ErrNotFound)
                return
            }
            cb(row, null)
            return
        })
    }
    getInfo(id, cb){
        this._getInfoSQL("id=$id", {$id:id}, cb)
    }
    getInfoByName(name, cb){
        this._getInfoSQL("name=$name", {$name:name}, cb)
    }
    getContents(sha256Hash){
        var loc = path.join(this.filesByHashLoc, sha256Hash)
        return fs.createReadStream(loc)
    }
    delete(info, cb){        
        this.db.get(`SELECT count(*) as count FROM files WHERE sha256=$sha256`, {$sha256:info.sha256}, (err, row) => {
            if (err != null){
                throw err
            }
            var count = row.count
            if (count == 0) {
                throw "no files with provided hash (must not happen)"
            }
            this.db.run(`DELETE FROM files WHERE id = ?`, info.id, (err) => {
                if (err != null){
                    throw err
                }                
            })
            if (count > 1) { // not the last file, no need to delete
                cb(null)
                return
            }
            if (count == 0) {
                throw "count == 0 must return before getting here"
            }

            fs.unlinkSync(path.join(this.filesByHashLoc, info.sha256))
            cb(null)
            return
        })
    }    
}

class ErrDuplicateName extends Error {
    toString(){
        return "duplicate name used when saving file"
    }
}

exports.ErrDuplicateName = ErrDuplicateName

class ErrNotFound extends Error {
    toString(){
        return "requested record was not found"
    }
}

exports.ErrNotFound = ErrNotFound

function randomFileID() {
	return randomIDWithLen(32).toString("hex")
}

function randomTempFileName() {
	return randomIDWithLen(32).toString("hex")
}

function randomIDWithLen(c){
    return crypto.randomBytes(c)
}
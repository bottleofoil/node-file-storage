var commander = require('commander')
var http = require('http')
var logger = require('./logger')
var storage = require('./storage')

function main(){
	commander
		.version("0.0.1")
		.option("--port <port>", "port number for server to use")
		.option("--data-dir <dir>", "directory to save sqlite database and files")
		.parse(process.argv);

	var argPort = +commander.port || 80
	var argDataDir = commander.dataDir || "./files-db"

	var store = new storage.Storage(argDataDir)
	var log = new logger.Logger()
	
	log.info("running server on " + argPort + " data-dir=" + argDataDir)

	http.createServer((req, res) => {
				
		function logReq(msg){
			log.info(req.method + " " + req.url + " " + msg)
		}
		function logReqError(msg){
			log.error(req.method + " " + req.url + " " + msg)
		}
		function respondJSON(obj){
			var b = JSON.stringify(obj)
			res.write(b)
			logReq("json response: " + b)
			res.end()
		}
		function respondWithError(err, code){
			res.writeHead(code)
			logReqError(err)
			respondJSON({error: err.toString()})			
		}

		var reqMethods = {
			logReq: logReq,
			logReqError: logReqError,
			respondJSON: respondJSON,
			respondWithError: respondWithError			
		}

		log.info(req.method + " " + req.url)

		if (req.method == "PUT") {
			handlePUT(store, req, res, reqMethods)
			return
		}
		
		if (req.method == "GET") {
			handleGET(store, req, res, reqMethods)
			return
		}

		if (req.method == "DELETE") {
			handleDELETE(store, req, res, reqMethods)
			return
		}

		logReq("invalid request method: " + req.method)


	}).listen(argPort)	
}

main()

function handlePUT(store, req, res, reqMethods){
	var fileName = fileNameFromURL(req.url)
	var err = validateFileName(fileName)
	if (err) {
		reqMethods.respondWithError(err, 400)
		return
	}
	store.save(fileName, req, (id, err) => {	
		if (err){
			reqMethods.respondWithError(err, 500)
			return
		}
		res.end()	
		return
	})
}

function handleGET(store, req, res, reqMethods){
	var fileName = fileNameFromURL(req.url)
	var err = validateFileName(fileName)
	if (err) {
		res.writeHead(404)
		res.end()
		return
	}
	store.getInfoByName(fileName, (info, err)=>{
		if (err instanceof storage.ErrNotFound){
			res.writeHead(404)
			res.end()
			return
		}
		if (err){
			reqMethods.respondWithError(err, 500)
			return
		}		
		var r = store.getContents(info.sha256)
		r.pipe(res)
		return
	})	
}

function handleDELETE(store, req, res, reqMethods){
	var fileName = fileNameFromURL(req.url)
	var err = validateFileName(fileName)
	if (err) {
		reqMethods.respondWithError(err, 400)
		return
	}
	store.getInfoByName(fileName, (info,err)=>{
		if (err){
			reqMethods.respondWithError(err, 500)
			return			
		}		
		store.delete(info, () => {
			res.end()
			return
		})
	})
}

function fileNameFromURL(url){
	return url.slice(1)
}

// TODO: validate filename to show user friendly error messages, does not matter for security because we store it escaped in the db
function validateFileName(fileName){
	return ""
}
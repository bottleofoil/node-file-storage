exports.Logger = class Logger {
    
    info(msg){
        var n = new Date()
        console.log(n.toString() + " " + msg)
    }

    error(msg){
        this.info("ERROR " + msg)
    }
}
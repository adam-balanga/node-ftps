var spawn = require('child_process').spawn,
	_ = require('underscore');
var events = require('events');
var util = require('util');

var isWin = /^win/.test(process.platform);

var escapeshell = function(cmd) {
  return cmd.replace(/(["\s'$`\\])/g,'\\$1');
};



/*
** Params :
** {
**   host: 'domain.com', // required
**   username: 'Test', // required
**   password: 'Test', // required
**   protocol: 'sftp', // optional, values : 'ftp', 'sftp', 'ftps', ... default: 'ftp'
**   // protocol is added on beginning of host, ex : sftp://domain.com in this case
**   port: '28', // optional
**   // port is added at the end of the host, ex : sftp://domain.com:28 in this case
** }
**
** Usage :
** ftp.cd('to_maleamassage').rm('./test.txt').exec(console.log);
*/


var FTP = function (options) {
    this.initialize(options);
	this.cmds = [];
};
util.inherits(FTP, events.EventEmitter)

FTP.prototype.initialize = function (options) {
	var defaults = {
		host: '',
		username: '',
		password: '',
        path: 'lftp'
	};

	var opts = _.pick(_.extend(defaults, options), 'host', 'username', 'password', 'port', 'path');
	if (!opts.host) throw new Error('You need to set a host.');
	if (!opts.username) throw new Error('You need to set an username.');
	if (!opts.password) throw new Error('You need to set a password.');
	if (typeof options.protocol === 'string' && options.protocol && opts.host.indexOf(options.protocol + '://') !== 0)
		opts.host = options.protocol + '://' + options.host;
  	if (opts.port)
    		opts.host = opts.host + ':' + opts.port;
	this.options = opts;
};

FTP.prototype.exec = function (cmds, callback) {
	if (typeof cmds === 'string')
		cmds = cmds.split(';');
	if (Array.isArray(cmds))
		this.cmds = this.cmds.concat(cmds);
	if (typeof cmds === 'function' && !callback)
		callback = cmds;
	if (!callback)
		throw new Error('callback is missing to exec() function.')
	var cmd = '';
	cmd += 'open -u "'+ escapeshell(this.options.username) + '","' + escapeshell(this.options.password) + '" "' + this.options.host + '";';
	cmd += this.cmds.join(';');
	this.cmds = [];

	var lftp = spawn(this.options.path, ['-c', cmd]);
	var data = "";
	var error = "";
	lftp.stdout.on('data', function (res) {
        console.log('emitting event: ' + String(res));
        this.emit('startedFile', res);
		data += res;
	});
	lftp.stderr.on('data', function (res) {
		error += res;
	});
	lftp.on('error', function ( err ) {
		if (callback)
			callback(err, { error: error || null, data: data });
		callback = null; // Make sure callback is only called once, whether 'exit' event is triggered or not.
	});
	lftp.on('exit', function (code) {
		if (callback)
			callback(null, { error: error || null, data: data });
	});
	return this;
};

FTP.prototype.raw = function (cmd) {
	if (cmd && typeof cmd === 'string')
		this.cmds.push(cmd);
	return this;
};

FTP.prototype.ls = function () { return this.raw('ls'); };
FTP.prototype.pwd = function () { return this.raw('pwd'); };
FTP.prototype.cd = function (directory) { return this.raw('cd ' + escapeshell(directory)); };
FTP.prototype.cat = function (path) { return this.raw('cat ' + escapeshell(path)); };
FTP.prototype.put = function (localPath, remotePath) {
	if (!localPath)
		return this;
	if (!remotePath)
		return this.raw('put '+escapeshell(this.convertPath(localPath)));
	return this.raw('put '+escapeshell(this.convertPath(localPath))+' -o '+escapeshell(remotePath));
};
FTP.prototype.addFile = FTP.prototype.put;
FTP.prototype.get = function (remotePath, localPath) {
	if (!remotePath)
		return this;
	if (!localPath)
		return this.raw('get '+escapeshell(remotePath));
	return this.raw('get '+escapeshell(remotePath)+' -o '+escapeshell(this.convertPath(localPath)));
};
FTP.prototype.getFile = FTP.prototype.get;
FTP.prototype.mv = function (from, to) {
	if (!from || !to)
		return this;
	return this.raw('rm ' + escapeshell(from) + ' ' + escapeshell(to));
};
FTP.prototype.move = FTP.prototype.mv;
FTP.prototype.rm = function () { return this.raw('rm ' + Array.prototype.slice.call(arguments).map(escapeshell).join(' ')); };
FTP.prototype.remove = FTP.prototype.rm;

/**
 * Mirrors a local directory to a remote server.
 * @param localPath the path to mirror locally
 * @param remotePath the location to mirror remotely
 * @returns {*} the ftp object for chaining
 */
FTP.prototype.mirror = function (localPath, remotePath) {
	if (!localPath || !remotePath) { return this; }
	return this.raw("mirror -R -c -vvv '"+this.convertPath(localPath)+"' '"+remotePath+"'");
}

/**
 * Converts windows paths to cygwin compatible paths.
 * @param path the path to convert
 * @returns {*} the original path on non-windows systems and a cygwin path on windows machines.
 */
FTP.prototype.convertPath = function (path) {
    if (!isWin) { return path; }
    var cygPath = path.replace(/^(\w+):\\/, '/cygdrive/$1/').replace(/\\/g, '/');
    console.log(cygPath);
    return cygPath;
}

module.exports = FTP;

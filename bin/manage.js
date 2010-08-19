var  sys = require('sys')
    ,path = require('path')
    ,fs = require('fs')
    ,exec = require('child_process').exec;

var PROJECT_ROOT = process.cwd();

var  redis_pid_file = path.join(PROJECT_ROOT, 'run', 'redis.pid')
    ,redis_db_dir = path.join(PROJECT_ROOT, 'data')
    ,redis_db_file = path.join(redis_db_dir, 'trends.rdb')
    ,redis_config_path = path.join(PROJECT_ROOT, 'config', 'redis.conf')
    ,redis_cmd = path.join(PROJECT_ROOT, 'deps', 'redis', 'src', 'redis-server')
    ,redis_options = {
       'pidfile /var/run/redis.pid': 'pidfile ' + redis_pid_file
      ,'daemonize no': 'daemonize yes'
      ,'dir ./': 'dir '+ redis_db_dir
      ,'save 900 1': 'save 3 1'
      ,'dbfilename dump.rdb': 'dbfilename ' + redis_db_file    
    };

function startRedis(){
  // read redis default configuration parameters
  redis_default_config = path.join('.', 'deps', 'redis', 'redis.conf');
  fs.readFile(redis_default_config, 'utf-8', function (err, data) {
    if (err) throw err;
    var redis_config_raw = data;
    // write redis app-specific configuration parameters
    for (key in redis_options){
      redis_config_raw = redis_config_raw.replace(key, redis_options[key]);
    }
    fs.writeFile(redis_config_path, redis_config_raw, function (err) {
      if (err) throw err;
      // start redis server
      var redis_server_daemon = exec(redis_cmd+' '+redis_config_path);
      process.exit(0);
    });
  });
}

function killRedis(){
  path.exists(redis_pid_file, function(exists){
    if (!exists) process.exit(0);
    fs.readFile(redis_pid_file, 'utf-8', function (err, data) {
      if (err) throw err;
      process.kill(parseInt(data), 'SIGTERM');
    });
  });
}

function printHelp(){
  console.log(
'\nTTWiki Manager v0.1\
\n\
\nUsage: node '+ __filename.substring(__dirname.length+1, __filename.length) +' [command]\n\n\
Commands:\n\
\tdbstart: Start the database daemon.\n\
\tdbstop:  Stop the database daemon.\
\n\n');
}
switch(process.argv[2]){
  case 'dbstart': startRedis(); break;
  case 'dbstop': killRedis(); break;
  case undefined: printHelp(); break;
}
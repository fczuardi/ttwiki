
var sys = require('sys');

function trace(msg){
  console.log('[Child Process '+process.pid+']');
  console.log(msg);
}

trace(JSON.parse(process.env['TRENDS']));
trace(JSON.parse(process.env['AS_OF']));
process.exit(0);
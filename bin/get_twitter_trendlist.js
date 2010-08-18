//= Globals

//== Libraries
var  sys = require('sys')
    ,exec = require('child_process').exec
    ,growl = require('../lib/node-growl/lib/growl')
    ,oauth = require('../lib/node-oauth/lib/oauth');

//== Config
try{
  var tw_config = require('../config/twitter').tokens;
}catch(e){
  console.log('Error: You need to setup your Twitter OAuth tokens. Edit the file /config/twitter-example.js and save it as /config/twitter.js');
  process.exit(1);
}

//== Constants
var  API_URL = 'api.twitter.com'
    ,API_PORT = 443
    ,LOCAL_TRENDS_PATH = '/1/trends/'
    ,LOCAL_WOEID = '23424768' //Brasil
    ,TIME_BETWEEN_TRENDS_REQUESTS = 5*60*1000 // 5 minutes see http://dev.twitter.com/doc/get/trends/:woeid

//== Variables
var  consumer = oauth.createConsumer(tw_config.CONSUMER_KEY, tw_config.CONSUMER_SECRET)
    ,token = oauth.createToken(tw_config.OAUTH_TOKEN, tw_config.OAUTH_TOKEN_SECRET)
    ,signer = oauth.createHmac(consumer, token)
    ,client = oauth.createClient(API_PORT, API_URL , true)
    ,woeid = '23424768' //brasil
    ,response_formats = ['json', 'xml'] //json output sometimes stop working, so we check both
    ,trends_request = {'xml':{},'json':{}}
    ,current_trends = {'xml':{},'json':{}}
    ,last_trends = {'as_of': 0, 'trends': [] }
    ,json_retrieving_interval
    ,xml_retrieving_interval;

//= Main

//== init()
function init(){
  //twitter sometimes stops updating the json list (http://twitter.com/fczuardi/status/21353558458)
  //so we request xml and json alternating and use the most recent list of the two
  getCurrentTrends('xml');
  json_retrieving_interval = setInterval(getCurrentTrends, TIME_BETWEEN_TRENDS_REQUESTS, 'xml');
  setTimeout(function(){
    getCurrentTrends('json');
    json_retrieving_interval = setInterval(getCurrentTrends, TIME_BETWEEN_TRENDS_REQUESTS, 'json');
  }, TIME_BETWEEN_TRENDS_REQUESTS/2);
}

//== getCurrentTrends()
function getCurrentTrends(fmt){
  current_trends[fmt] = {'as_of': 0, 'body': '', 'trends': []}
  trends_request[fmt] = client.request('GET', LOCAL_TRENDS_PATH + LOCAL_WOEID + '.' + fmt, null, null, signer);
  trends_request[fmt].addListener('response', function(response) {
    var response_type = (response.headers['content-type'].indexOf('xml') != -1) ? 'xml' :
                        ((response.headers['content-type'].indexOf('json') != -1) ? 'json' : 'other')
    response.setEncoding('utf8');
    // notify
    growl.notify(response.headers["x-ratelimit-remaining"]+' calls left.', { title: 'TTWiki' }, function(){});
    // error handling
    if (response.statusCode != 200) { return responseError(response, 'error', 'Request failed.', '8309740116819739'); }
    if (response.headers["x-ratelimit-remaining"] < 100) { responseError(response, 'warning', 'We are reaching the limit!!', ('7925415213685483')) }
    if (response_type == 'other') { return responseError(response, 'error', 'Wrong MIME Type.', '20324136363342404'); }
    // what to do when data comes in
    if (response_type == 'xml'){
      parseTrendsXML(response);
    }else {
      parseTrendsJSON(response);
    }
  });
  trends_request[fmt].end(); //make the request
}

//== proccessTrendsXML()
function parseTrendsXML(response) {
  response.addListener('data', function (chunk) {
    current_trends['xml']['body'] += chunk;
  });
  response.addListener('end', function () {
    var as_of_re = /as_of="([^"]*)"/gim;
    var as_of_matches = as_of_re.exec(current_trends['xml']['body']);
    var as_of = Date.parse(as_of_matches[1]);
    if (as_of <= last_trends['as_of']){ 
      console.log(as_of+' so skip');
      return false
    }
    //<trend query="Ursinhos+Carinhosos" url="http://search.twitter.com/search?q=Ursinhos+Carinhosos">Ursinhos Carinhosos</trend>
    var trend_re = /<trend[^>]*>[^<]*<\/trend>/gim;
    var trend_matches = current_trends['xml']['body'].match(trend_re);
    var trend_data_re = /<trend\s*query="([^"]*)"\surl="([^"]*)"[^>]*>([^<]*)<\/trend>/i;
    for (i=0;i<trend_matches.length;i++){
      var trend_data_matches = trend_data_re.exec(trend_matches[i]);
      current_trends['xml']['trends'].push({
         'name': trend_data_matches[3]
        ,'query': trend_data_matches[1]
        ,'url': trend_data_matches[2]
        });
    }
    current_trends['xml']['as_of'] = as_of;
    last_trends = current_trends['xml'];
    trendsParsed(current_trends['xml']);
  });
}

//== proccessTrendsJSON()
function parseTrendsJSON(response){
  response.addListener('data', function (chunk) {
    current_trends['json']['body'] += chunk;
  });
  response.addListener('end', function () {
    //error handling
    try{
      result = JSON.parse(current_trends['json']['body'])[0];
    }catch(e){
      return responseContentError(result, 'error', 'Could not parse JSON.', '05745784239843488');
    }
    if (!result['as_of']){ return responseContentError(result, 'error', 'Response doesn’t have timestamp.', '9761156134773046'); }
    var as_of = Date.parse(result['as_of'])
    if (as_of <= last_trends['as_of']){ return responseContentError(result, 'info', 'The result we have is newer than this one, skip it.', '3963864736724645'); }
    if (!result['trends']){ return responseContentError(result, 'error', 'Response doesn’t have trends list.', '8779761055484414'); }
    //build ranking
    for (i=0;i<result['trends'].length;i++){
      current_trends['json']['trends'].push(result['trends'][i]);
    }
    current_trends['json']['as_of'] = as_of;
    last_trends = current_trends['json'];
    trendsParsed(current_trends['json']);
  });
}

//== trendsParsed()
function trendsParsed(content){
  console.log(JSON.stringify(content['trends']))
  var test_script = exec('node post_redisdb_trendlist.js'
      ,{env: {
         TRENDS: JSON.stringify(content['trends'])
        ,AS_OF: content['as_of']
      }}
      ,function (error, stdout, stderr) {
      if (error !== null) {
        console.log('exec error: ' + error);
      }
      console.log(stdout);
      if (stderr) console.log(stderr);
    });
  //
}

init();

//= Helpers
//== responseError()
function responseError(response, type, msg, code){
  console.log('== %s: %s (%s) ==', type.toUpperCase(), msg, code);
  console.log(response.statusCode);
  console.log(response.headers);
  return false;
}
function responseContentError(result, type, msg, code){
  console.log('== %s: %s (%s) ==', type.toUpperCase(), msg, code);
  if (type == 'error') {
    console.log(result);
  }
  return false;
}
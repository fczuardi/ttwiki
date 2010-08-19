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
    ,MIN_TIME_BETWEEN_TRENDS_REQUESTS = 5*60*1000 // 5 minutes see http://dev.twitter.com/doc/get/trends/:woeid
    ,KNOWN_WOEIDS = {
       '1': 'Worldwide'
      ,'23424768': 'Brazil'
      ,'455827': 'São Paulo'
      ,'23424977': 'United States'
      ,'2487956': 'San Francisco'
    }
    ,KNOWN_COUNTRY_CODES = {
       'BR': '23424768'
      ,'CA': '23424775'
      ,'IE': '23424803'
      ,'MX': '23424900'
      ,'GB': '23424975'
      ,'US': '2487796'
    }
    ,SCRIPT_TITLE = '\nTwitter Trending Topics Client v0.1\n-----------------------------------';
    

//== Variables
var  consumer = oauth.createConsumer(tw_config.CONSUMER_KEY, tw_config.CONSUMER_SECRET)
    ,token = oauth.createToken(tw_config.OAUTH_TOKEN, tw_config.OAUTH_TOKEN_SECRET)
    ,signer = oauth.createHmac(consumer, token)
    ,client = oauth.createClient(API_PORT, API_URL , true)
    ,response_formats = ['json', 'xml'] //json output sometimes stop working, so we check both
    ,trends_request = {'xml':{},'json':{}}
    ,current_trends = {'xml':{},'json':{}}
    ,last_trends = {'as_of': 0, 'trends': [] }
    ,json_retrieving_interval
    ,xml_retrieving_interval;

//== Default options
var options = {
   'run_once' : true
  ,'woeid' : '1'
  ,'verbose' : false
  ,'interval': MIN_TIME_BETWEEN_TRENDS_REQUESTS
}

//= Command Line Options
switch(process.argv[2]){
  case '-h': print_help(); break;
  case undefined: run_once(); break;
}

//== Manual
function print_help(){
  console.log(SCRIPT_TITLE+'\n\
\nSYNOPSIS:\
\n\tnode '+ __filename.substring(__dirname.length+1, __filename.length) +' woeid\
\n\
\nARGUMENTS:\n\
\twoeid: The woeid code for the location you want to get the trendlist. \
Ex:23424768 (Brazil), 1 (Worldwide)\
\n\n');
}

//== Default Header
function print_default_header(){
  console.log(SCRIPT_TITLE+'\n\
\nCheck the HELP page: node '+ __filename.substring(__dirname.length+1, __filename.length) +' -h\
\n');
}

//= Functions
function run_once(){
  options['run_once'] = true;
  print_default_header();
  getCurrentTrends('xml');
  // getCurrentTrends('json');
}

//== init()
function init(){
  //twitter sometimes stops updating the json list (http://twitter.com/fczuardi/status/21353558458)
  //so we request xml and json alternating and use the most recent list of the two
  getCurrentTrends('xml');
  json_retrieving_interval = setInterval(getCurrentTrends, options['interval'], 'xml');
  setTimeout(function(){
    getCurrentTrends('json');
    json_retrieving_interval = setInterval(getCurrentTrends, options['interval'], 'json');
  }, opetions['interval']/2);
}

//== getCurrentTrends()
function getCurrentTrends(fmt){
  current_trends[fmt] = {'as_of': 0, 'body': '', 'remaining_calls': 0, 'trends': []}
  trends_request[fmt] = client.request('GET', LOCAL_TRENDS_PATH + options['woeid'] + '.' + fmt, null, null, signer);
  trends_request[fmt].addListener('response', function(response) {
    var response_type = (response.headers['content-type'].indexOf('xml') != -1) ? 'xml' :
                        ((response.headers['content-type'].indexOf('json') != -1) ? 'json' : 'other')
    response.setEncoding('utf8');
    // notify
    // growl.notify(response.headers["x-ratelimit-remaining"]+' calls left.', { title: 'TTWiki' }, function(){});
    // error handling
    if (response.statusCode != 200) { return responseError(response, 'error', 'Request failed.', '8309740116819739'); }
    if (response.headers["x-ratelimit-remaining"] < 100) { responseError(response, 'warning', 'We are reaching the limit!!', ('7925415213685483')) }
    if (response_type == 'other') { return responseError(response, 'error', 'Wrong MIME Type.', '20324136363342404'); }
    current_trends[fmt]['remaining_calls'] = response.headers["x-ratelimit-remaining"];
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
  if (options['run_once']){
    var as_of_date = new Date(content['as_of']);
      // outputtext += "<b>GMT</b>: "+datum.toGMTString()+"<br/><b>Your timezone</b>: "+;
    console.log('Trending Topics (as of %s)\nLocation: %s\n', as_of_date.toLocaleString(), KNOWN_WOEIDS[options['woeid']])
    for (i=0;i<content['trends'].length;i++){
      console.log('%s. %s - %s', (i+1), entitiesToChar(content['trends'][i]['name']),content['trends'][i]['url']);
    }
    console.log('\n(%s API calls remaining)', content['remaining_calls'])
    sys.puts('\n');
    process.exit(0);
  }
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

//= Helpers
//== entitiesToChar()
function entitiesToChar(text){
  // Convert Decimal numeric character references ex: &#195; to Ã
  text = text.replace(/&#([0-9]{1,7});/g, function(match, submatch) { return String.fromCharCode(submatch);} );
  return text;
}

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
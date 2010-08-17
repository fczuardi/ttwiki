//= Globals

//== Libraries
var  growl = require('./lib/node-growl/lib/growl')
    ,oauth = require('./lib/node-oauth/lib/oauth');

//== Config
try{
  var tw_config = require('./config/twitter').tokens;
}catch(e){
  console.log('Error: You need to setup your Twitter OAuth tokens. Edit the file /config/twitter-example.js and save it as /config/twitter.js');
  process.exit(1);
}

//== Constants
var  API_URL = 'api.twitter.com'
    ,API_PORT = 443
    ,LOCAL_TRENDS_PATH = '/1/trends/'
    ,LOCAL_WOEID = '23424768' //Brasil

//== Variables
var  consumer = oauth.createConsumer(tw_config.CONSUMER_KEY, tw_config.CONSUMER_SECRET)
    ,token = oauth.createToken(tw_config.OAUTH_TOKEN, tw_config.OAUTH_TOKEN_SECRET)
    ,signer = oauth.createHmac(consumer, token)
    ,client = oauth.createClient(API_PORT, API_URL , true)
    ,woeid = '23424768' //brasil
    ,response_formats = ['json', 'xml'] //json output sometimes stop working, so we check both
    ,trends_request = {'xml':{},'json':{}}
    ,current_trends = {'xml':{},'json':{}}
    ,last_trends = {'as_of': 0, 'body': '', 'rank': [] }
    ,json_retrieving_interval
    ,xml_retrieving_interval;

//= Main

//== init()
function init(){
  // http://dev.twitter.com/doc/get/trends/:woeid
  // "This information is cached for 5 minutes. Requesting more frequently than 
  // that will not return any more data, and will count against your rate limit usage."
  getCurrentTrends('xml');
  json_retrieving_interval = setInterval(getCurrentTrends, 5*60*1000, 'xml');
  setTimeout(function(){
    getCurrentTrends('json');
    json_retrieving_interval = setInterval(getCurrentTrends, 5*60*1000, 'json');
  }, 2.5*60*1000);
}

//== getCurrentTrends()
function getCurrentTrends(fmt){
  current_trends[fmt] = {'as_of': 0, 'body': '', 'rank': []}
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
      proccessTrendsXML(response);
    }else {
      proccessTrendsJSON(response);
    }
  });
  trends_request[fmt].end(); //make the request
}
//== proccessTrendsXML()
function proccessTrendsXML(response) {
  response.addListener('data', function (chunk) {
    current_trends['xml']['body'] += chunk;
  });
  response.addListener('end', function () {
    // console.log(current_trends['xml']['body'])
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
    var trend_name_re = /<trend[^>]*>([^<]*)<\/trend>/i;
    for (i=0;i<trend_matches.length;i++){
      current_trends['xml']['rank'].push(trend_name_re.exec(trend_matches[i])[1]);
    }
    console.log(trend_matches);
    console.log(as_of)
    current_trends['xml']['as_of'] = as_of;
    last_trends = current_trends['xml'];
    console.log(current_trends['xml'])
  });
}
//== proccessTrendsJSON()
function proccessTrendsJSON(response){
  response.addListener('data', function (chunk) {
    current_trends['json']['body'] += chunk;
  });
  response.addListener('end', function () {
    // console.log('BODY: ' + current_trends['json']['body']);
    result = JSON.parse(current_trends['json']['body'])[0];
    if (!result['as_of']){ 
      console.log('== ERROR: something went wrong (9761156134773046) ==');
      return false 
    }
    var as_of = Date.parse(result['as_of'])
    if (as_of <= last_trends['as_of']){ 
      console.log(as_of+' so skip');
      return false
    }
    if (!result['trends']){
      console.log('== ERROR: something went wrong (8779761055484414) ==');
      return false
    }
    for (i=0;i<result['trends'].length;i++){
      current_trends['json']['rank'].push(result['trends'][i]['name']);
    }
    current_trends['json']['as_of'] = as_of;
    console.log(current_trends['json']);
    console.log("last_trends['as_of'] == current_trends['as_of'] ? "+(last_trends['as_of'] == current_trends['json']['as_of']));
    console.log("last_trends['body'] == current_trends['body'] ? "+(last_trends['body'] == current_trends['json']['body']));
    last_trends = current_trends['json'];
    console.log(Date.parse(current_trends['json']['as_of']));
    console.log('==================================================');
  });
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
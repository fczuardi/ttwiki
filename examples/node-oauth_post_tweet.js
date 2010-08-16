var sys = require('sys');
var oauth = require('../lib/node-oauth/lib/oauth');

try{
  var twitter_api_tokens = require('../config/twitter').tokens;
}catch(e){
  console.log('Error: You need to setup your Twitter OAuth tokens. Edit the file /config/twitter-example.js and save it as /config/twitter.js');
  process.exit(1);
}
console.log(twitter_api_tokens);


// if you already have the access token and secret…
var key = twitter_api_tokens.consumer_key;
var secret = twitter_api_tokens.consumer_secret;
var atoken = twitter_api_tokens.oauth_token;
var asecret = twitter_api_tokens.oauth_token_secret;

var client = oauth.createClient(443,'api.twitter.com',true);
var consumer = oauth.createConsumer(key, secret);
var token = oauth.createToken(atoken, asecret);
var signer = oauth.createHmac(consumer, token);

var body = { status: ('abacate '+new Date()) };
var request = client.request('POST','/1/statuses/update.json',null,body,signer);
request.write(body);

request.addListener('response', function(response) {
    console.log('STATUS: ' + response.statusCode);
    console.log('HEADERS: ' + JSON.stringify(response.headers));
    response.setEncoding('utf8');
    response.addListener('data', function (chunk) {
      console.log('BODY: ' + chunk);
    });
});
request.end();

try{
  var twitter_api_tokens = require('./config/twitter').tokens;
}catch(e){
  console.log('Error: You need to setup your Twitter OAuth tokens. Edit the file /config/twitter-example.js and save it as /config/twitter.js');
  process.exit(1);
}
console.log(twitter_api_tokens);
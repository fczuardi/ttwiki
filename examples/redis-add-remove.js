var client = require("../lib/redis-node-client/lib/redis-client").createClient();

var trends = [ { name: 'Vox Populi'
     , query: 'Vox+Populi'
     , url: 'http://search.twitter.com/search?q=Vox+Populi'
     }
   , { name: 'Dilma Rousseff'
     , query: 'Dilma+Rousseff'
     , url: 'http://search.twitter.com/search?q=Dilma+Rousseff'
     }
   , { name: 'Veronica Boquete'
     , query: 'Veronica+Boquete'
     , url: 'http://search.twitter.com/search?q=Veronica+Boquete'
     }
   , { name: 'Ana Maria Braga'
     , query: 'Ana+Maria+Braga'
     , url: 'http://search.twitter.com/search?q=Ana+Maria+Braga'
     }
   , { name: 'Black Eyed Peas'
     , query: 'Black+Eyed+Peas'
     , url: 'http://search.twitter.com/search?q=Black+Eyed+Peas'
     }
   , { name: 'Serra comedor'
     , query: 'Serra+comedor'
     , url: 'http://search.twitter.com/search?q=Serra+comedor'
     }
   , { name: 'Luiz Mendon&#231;a'
     , query: 'Luiz+Mendon%C3%A7a'
     , url: 'http://search.twitter.com/search?q=Luiz+Mendon%C3%A7a'
     }
   , { name: 'Hor&#243;scopo Falcon&#233;tico'
     , query: 'Hor%C3%B3scopo+Falcon%C3%A9tico'
     , url: 'http://search.twitter.com/search?q=Hor%C3%B3scopo+Falcon%C3%A9tico'
     }
   , { name: 'Marcelinho Carioca'
     , query: 'Marcelinho+Carioca'
     , url: 'http://search.twitter.com/search?q=Marcelinho+Carioca'
     }
   , { name: 'Marina Silva'
     , query: 'Marina+Silva'
     , url: 'http://search.twitter.com/search?q=Marina+Silva'
     }
   ]

// console.log(JSON.stringify(trends))

var key = 'trendlist:1282138412000';

client.set(key, JSON.stringify(trends), function (err, result) {
    if (err) throw new Error(err);
    console.log('set');
    console.log(result);
});

client.get(key, function (err, result) {
    if (err) throw new Error(err);
    console.log('get');
    console.log(result.toString());
});

client.del(key, function (err, result) {
    if (err) throw new Error(err);
    console.log('del');
    console.log(result);
    process.exit(0);
});

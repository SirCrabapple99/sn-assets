
var Module;

if (typeof Module === 'undefined') Module = eval('(function() { try { return Module || {} } catch(e) { return {} } })()');

if (!Module.expectedDataFileDownloads) {
  Module.expectedDataFileDownloads = 0;
  Module.finishedDataFileDownloads = 0;
}
Module.expectedDataFileDownloads++;
(function() {
 var loadPackage = function(metadata) {

  var PACKAGE_PATH;
  if (typeof window === 'object') {
    PACKAGE_PATH = window['encodeURIComponent'](window.location.pathname.toString().substring(0, window.location.pathname.toString().lastIndexOf('/')) + '/');
  } else if (typeof location !== 'undefined') {
      // worker
      PACKAGE_PATH = encodeURIComponent(location.pathname.toString().substring(0, location.pathname.toString().lastIndexOf('/')) + '/');
    } else {
      throw 'using preloaded data can only be done on a web page or in a web worker';
    }
    var PACKAGE_NAME = 'game.data';
    var REMOTE_PACKAGE_BASE = 'game.data';
    if (typeof Module['locateFilePackage'] === 'function' && !Module['locateFile']) {
      Module['locateFile'] = Module['locateFilePackage'];
      Module.printErr('warning: you defined Module.locateFilePackage, that has been renamed to Module.locateFile (using your locateFilePackage for now)');
    }
    var REMOTE_PACKAGE_NAME = typeof Module['locateFile'] === 'function' ?
    Module['locateFile'](REMOTE_PACKAGE_BASE) :
    ((Module['filePackagePrefixURL'] || '') + REMOTE_PACKAGE_BASE);

    var REMOTE_PACKAGE_SIZE = metadata.remote_package_size;
    var PACKAGE_UUID = metadata.package_uuid;

    function fetchRemotePackage(packageName, packageSize, callback, errback) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', packageName, true);
      xhr.responseType = 'arraybuffer';
      xhr.onprogress = function(event) {
        var url = packageName;
        var size = packageSize;
        if (event.total) size = event.total;
        if (event.loaded) {
          if (!xhr.addedTotal) {
            xhr.addedTotal = true;
            if (!Module.dataFileDownloads) Module.dataFileDownloads = {};
            Module.dataFileDownloads[url] = {
              loaded: event.loaded,
              total: size
            };
          } else {
            Module.dataFileDownloads[url].loaded = event.loaded;
          }
          var total = 0;
          var loaded = 0;
          var num = 0;
          for (var download in Module.dataFileDownloads) {
            var data = Module.dataFileDownloads[download];
            total += data.total;
            loaded += data.loaded;
            num++;
          }
          total = Math.ceil(total * Module.expectedDataFileDownloads/num);
          if (Module['setStatus']) Module['setStatus']('Downloading data... (' + loaded + '/' + total + ')');
        } else if (!Module.dataFileDownloads) {
          if (Module['setStatus']) Module['setStatus']('Downloading data...');
        }
      };
      xhr.onerror = function(event) {
        throw new Error("NetworkError for: " + packageName);
      }
      xhr.onload = function(event) {
        if (xhr.status == 200 || xhr.status == 304 || xhr.status == 206 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
          var packageData = xhr.response;
          callback(packageData);
        } else {
          throw new Error(xhr.statusText + " : " + xhr.responseURL);
        }
      };
      xhr.send(null);
    };

    function handleError(error) {
      console.error('package error:', error);
    };

    function runWithFS() {

      function assert(check, msg) {
        if (!check) throw msg + new Error().stack;
      }
      Module['FS_createPath']('/', 'engine', true, true);
      Module['FS_createPath']('/', 'functions', true, true);
      Module['FS_createPath']('/', 'localization', true, true);
      Module['FS_createPath']('/', 'resources', true, true);
      Module['FS_createPath']('/resources', 'fonts', true, true);
      Module['FS_createPath']('/resources', 'shaders', true, true);
      Module['FS_createPath']('/resources', 'sounds', true, true);
      Module['FS_createPath']('/resources', 'textures', true, true);
      Module['FS_createPath']('/resources/textures', '1x', true, true);
      Module['FS_createPath']('/resources/textures/1x', 'collabs', true, true);
      Module['FS_createPath']('/resources/textures', '2x', true, true);
      Module['FS_createPath']('/resources/textures/2x', 'collabs', true, true);

      function DataRequest(start, end, crunched, audio) {
        this.start = start;
        this.end = end;
        this.crunched = crunched;
        this.audio = audio;
      }
      DataRequest.prototype = {
        requests: {},
        open: function(mode, name) {
          this.name = name;
          this.requests[name] = this;
          Module['addRunDependency']('fp ' + this.name);
        },
        send: function() {},
        onload: function() {
          var byteArray = this.byteArray.subarray(this.start, this.end);

          this.finish(byteArray);

        },
        finish: function(byteArray) {
          var that = this;

        Module['FS_createDataFile'](this.name, null, byteArray, true, true, true); // canOwn this data in the filesystem, it is a slide into the heap that will never change
        Module['removeRunDependency']('fp ' + that.name);

        this.requests[this.name] = null;
      }
    };

    var files = metadata.files;
    for (i = 0; i < files.length; ++i) {
      new DataRequest(files[i].start, files[i].end, files[i].crunched, files[i].audio).open('GET', files[i].filename);
    }


    var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    var IDB_RO = "readonly";
    var IDB_RW = "readwrite";
    var DB_NAME = "EM_PRELOAD_CACHE";
    var DB_VERSION = 1;
    var METADATA_STORE_NAME = 'METADATA';
    var PACKAGE_STORE_NAME = 'PACKAGES';
    function openDatabase(callback, errback) {
      try {
        var openRequest = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        return errback(e);
      }
      openRequest.onupgradeneeded = function(event) {
        var db = event.target.result;

        if(db.objectStoreNames.contains(PACKAGE_STORE_NAME)) {
          db.deleteObjectStore(PACKAGE_STORE_NAME);
        }
        var packages = db.createObjectStore(PACKAGE_STORE_NAME);

        if(db.objectStoreNames.contains(METADATA_STORE_NAME)) {
          db.deleteObjectStore(METADATA_STORE_NAME);
        }
        var metadata = db.createObjectStore(METADATA_STORE_NAME);
      };
      openRequest.onsuccess = function(event) {
        var db = event.target.result;
        callback(db);
      };
      openRequest.onerror = function(error) {
        errback(error);
      };
    };

    /* Check if there's a cached package, and if so whether it's the latest available */
    function checkCachedPackage(db, packageName, callback, errback) {
      var transaction = db.transaction([METADATA_STORE_NAME], IDB_RO);
      var metadata = transaction.objectStore(METADATA_STORE_NAME);

      var getRequest = metadata.get("metadata/" + packageName);
      getRequest.onsuccess = function(event) {
        var result = event.target.result;
        if (!result) {
          return callback(false);
        } else {
          return callback(PACKAGE_UUID === result.uuid);
        }
      };
      getRequest.onerror = function(error) {
        errback(error);
      };
    };

    function fetchCachedPackage(db, packageName, callback, errback) {
      var transaction = db.transaction([PACKAGE_STORE_NAME], IDB_RO);
      var packages = transaction.objectStore(PACKAGE_STORE_NAME);

      var getRequest = packages.get("package/" + packageName);
      getRequest.onsuccess = function(event) {
        var result = event.target.result;
        callback(result);
      };
      getRequest.onerror = function(error) {
        errback(error);
      };
    };

    function cacheRemotePackage(db, packageName, packageData, packageMeta, callback, errback) {
      var transaction_packages = db.transaction([PACKAGE_STORE_NAME], IDB_RW);
      var packages = transaction_packages.objectStore(PACKAGE_STORE_NAME);

      var putPackageRequest = packages.put(packageData, "package/" + packageName);
      putPackageRequest.onsuccess = function(event) {
        var transaction_metadata = db.transaction([METADATA_STORE_NAME], IDB_RW);
        var metadata = transaction_metadata.objectStore(METADATA_STORE_NAME);
        var putMetadataRequest = metadata.put(packageMeta, "metadata/" + packageName);
        putMetadataRequest.onsuccess = function(event) {
          callback(packageData);
        };
        putMetadataRequest.onerror = function(error) {
          errback(error);
        };
      };
      putPackageRequest.onerror = function(error) {
        errback(error);
      };
    };

    function processPackageData(arrayBuffer) {
      Module.finishedDataFileDownloads++;
      assert(arrayBuffer, 'Loading data file failed.');
      assert(arrayBuffer instanceof ArrayBuffer, 'bad input to processPackageData');
      var byteArray = new Uint8Array(arrayBuffer);
      var curr;

        // copy the entire loaded file into a spot in the heap. Files will refer to slices in that. They cannot be freed though
        // (we may be allocating before malloc is ready, during startup).
        if (Module['SPLIT_MEMORY']) Module.printErr('warning: you should run the file packager with --no-heap-copy when SPLIT_MEMORY is used, otherwise copying into the heap may fail due to the splitting');
        var ptr = Module['getMemory'](byteArray.length);
        Module['HEAPU8'].set(byteArray, ptr);
        DataRequest.prototype.byteArray = Module['HEAPU8'].subarray(ptr, ptr+byteArray.length);

        var files = metadata.files;
        for (i = 0; i < files.length; ++i) {
          DataRequest.prototype.requests[files[i].filename].onload();
        }
        Module['removeRunDependency']('datafile_game.data');

      };
      Module['addRunDependency']('datafile_game.data');

      if (!Module.preloadResults) Module.preloadResults = {};

      function preloadFallback(error) {
        console.error(error);
        console.error('falling back to default preload behavior');
        fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE, processPackageData, handleError);
      };

      openDatabase(
        function(db) {
          checkCachedPackage(db, PACKAGE_PATH + PACKAGE_NAME,
            function(useCached) {
              Module.preloadResults[PACKAGE_NAME] = {fromCache: useCached};
              if (useCached) {
                console.info('loading ' + PACKAGE_NAME + ' from cache');
                fetchCachedPackage(db, PACKAGE_PATH + PACKAGE_NAME, processPackageData, preloadFallback);
              } else {
                console.info('loading ' + PACKAGE_NAME + ' from remote');
                fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE,
                  function(packageData) {
                    cacheRemotePackage(db, PACKAGE_PATH + PACKAGE_NAME, packageData, {uuid:PACKAGE_UUID}, processPackageData,
                      function(error) {
                        console.error(error);
                        processPackageData(packageData);
                      });
                  }
                  , preloadFallback);
              }
            }
            , preloadFallback);
        }
        , preloadFallback);

      if (Module['setStatus']) Module['setStatus']('Downloading...');

    }
    if (Module['calledRun']) {
      runWithFS();
    } else {
      if (!Module['preRun']) Module['preRun'] = [];
      Module["preRun"].push(runWithFS); // FS is not initialized yet, wait for it
    }

  }
  loadPackage({"package_uuid":"a51fd060-d647-454d-9116-85a46ba24c39","remote_package_size":40938221,"files":[{"filename":"/back.lua","crunched":0,"start":0,"end":12555,"audio":false},{"filename":"/bit.lua","crunched":0,"start":12555,"end":14060,"audio":false},{"filename":"/blind.lua","crunched":0,"start":14060,"end":41594,"audio":false},{"filename":"/card.lua","crunched":0,"start":41594,"end":284145,"audio":false},{"filename":"/card_character.lua","crunched":0,"start":284145,"end":289503,"audio":false},{"filename":"/cardarea.lua","crunched":0,"start":289503,"end":321585,"audio":false},{"filename":"/challenges.lua","crunched":0,"start":321585,"end":345517,"audio":false},{"filename":"/conf.lua","crunched":0,"start":345517,"end":345727,"audio":false},{"filename":"/engine/animatedsprite.lua","crunched":0,"start":345727,"end":348999,"audio":false},{"filename":"/engine/controller.lua","crunched":0,"start":348999,"end":409653,"audio":false},{"filename":"/engine/event.lua","crunched":0,"start":409653,"end":416687,"audio":false},{"filename":"/engine/http_manager.lua","crunched":0,"start":416687,"end":417357,"audio":false},{"filename":"/engine/moveable.lua","crunched":0,"start":417357,"end":437888,"audio":false},{"filename":"/engine/node.lua","crunched":0,"start":437888,"end":453605,"audio":false},{"filename":"/engine/object.lua","crunched":0,"start":453605,"end":454271,"audio":false},{"filename":"/engine/particles.lua","crunched":0,"start":454271,"end":460866,"audio":false},{"filename":"/engine/profile.lua","crunched":0,"start":460866,"end":465439,"audio":false},{"filename":"/engine/save_manager.lua","crunched":0,"start":465439,"end":469259,"audio":false},{"filename":"/engine/sound_manager.lua","crunched":0,"start":469259,"end":476824,"audio":false},{"filename":"/engine/sprite.lua","crunched":0,"start":476824,"end":484790,"audio":false},{"filename":"/engine/string_packer.lua","crunched":0,"start":484790,"end":487570,"audio":false},{"filename":"/engine/text.lua","crunched":0,"start":487570,"end":502526,"audio":false},{"filename":"/engine/ui.lua","crunched":0,"start":502526,"end":547823,"audio":false},{"filename":"/engine/web_random.lua","crunched":0,"start":547823,"end":553140,"audio":false},{"filename":"/functions/UI_definitions.lua","crunched":0,"start":553140,"end":902963,"audio":false},{"filename":"/functions/button_callbacks.lua","crunched":0,"start":902963,"end":1020399,"audio":false},{"filename":"/functions/common_events.lua","crunched":0,"start":1020399,"end":1151057,"audio":false},{"filename":"/functions/misc_functions.lua","crunched":0,"start":1151057,"end":1224307,"audio":false},{"filename":"/functions/state_events.lua","crunched":0,"start":1224307,"end":1300269,"audio":false},{"filename":"/functions/test_functions.lua","crunched":0,"start":1300269,"end":1308418,"audio":false},{"filename":"/game.lua","crunched":0,"start":1308418,"end":1546362,"audio":false},{"filename":"/globals.lua","crunched":0,"start":1546362,"end":1562571,"audio":false},{"filename":"/localization/de.lua","crunched":0,"start":1562571,"end":1717252,"audio":false},{"filename":"/localization/en-us.lua","crunched":0,"start":1717252,"end":1863938,"audio":false},{"filename":"/localization/es_419.lua","crunched":0,"start":1863938,"end":2017500,"audio":false},{"filename":"/localization/es_ES.lua","crunched":0,"start":2017500,"end":2171170,"audio":false},{"filename":"/localization/fr.lua","crunched":0,"start":2171170,"end":2328720,"audio":false},{"filename":"/localization/id.lua","crunched":0,"start":2328720,"end":2480377,"audio":false},{"filename":"/localization/it.lua","crunched":0,"start":2480377,"end":2632243,"audio":false},{"filename":"/localization/ja.lua","crunched":0,"start":2632243,"end":2800640,"audio":false},{"filename":"/localization/ko.lua","crunched":0,"start":2800640,"end":2960713,"audio":false},{"filename":"/localization/nl.lua","crunched":0,"start":2960713,"end":3113484,"audio":false},{"filename":"/localization/pl.lua","crunched":0,"start":3113484,"end":3268370,"audio":false},{"filename":"/localization/pt_BR.lua","crunched":0,"start":3268370,"end":3421752,"audio":false},{"filename":"/localization/ru.lua","crunched":0,"start":3421752,"end":3603623,"audio":false},{"filename":"/localization/zh_CN.lua","crunched":0,"start":3603623,"end":3751030,"audio":false},{"filename":"/localization/zh_TW.lua","crunched":0,"start":3751030,"end":3898072,"audio":false},{"filename":"/main.lua","crunched":0,"start":3898072,"end":3910342,"audio":false},{"filename":"/resources/fonts/GoNotoCurrent-Bold.ttf","crunched":0,"start":3910342,"end":18444386,"audio":false},{"filename":"/resources/fonts/NotoSans-Bold.ttf","crunched":0,"start":18444386,"end":19026990,"audio":false},{"filename":"/resources/fonts/m6x11plus.ttf","crunched":0,"start":19026990,"end":19062055,"audio":false},{"filename":"/resources/gamecontrollerdb.txt","crunched":0,"start":19062055,"end":19459879,"audio":false},{"filename":"/resources/shaders/CRT.fs","crunched":0,"start":19459879,"end":19467149,"audio":false},{"filename":"/resources/shaders/background.fs","crunched":0,"start":19467149,"end":19469669,"audio":false},{"filename":"/resources/shaders/booster.fs","crunched":0,"start":19469669,"end":19474992,"audio":false},{"filename":"/resources/shaders/debuff.fs","crunched":0,"start":19474992,"end":19480156,"audio":false},{"filename":"/resources/shaders/dissolve.fs","crunched":0,"start":19480156,"end":19484425,"audio":false},{"filename":"/resources/shaders/flame.fs","crunched":0,"start":19484425,"end":19487270,"audio":false},{"filename":"/resources/shaders/flash.fs","crunched":0,"start":19487270,"end":19488171,"audio":false},{"filename":"/resources/shaders/foil.fs","crunched":0,"start":19488171,"end":19494106,"audio":false},{"filename":"/resources/shaders/gold_seal.fs","crunched":0,"start":19494106,"end":19494907,"audio":false},{"filename":"/resources/shaders/holo.fs","crunched":0,"start":19494907,"end":19500914,"audio":false},{"filename":"/resources/shaders/hologram.fs","crunched":0,"start":19500914,"end":19506676,"audio":false},{"filename":"/resources/shaders/negative.fs","crunched":0,"start":19506676,"end":19511570,"audio":false},{"filename":"/resources/shaders/negative_shine.fs","crunched":0,"start":19511570,"end":19516480,"audio":false},{"filename":"/resources/shaders/played.fs","crunched":0,"start":19516480,"end":19521270,"audio":false},{"filename":"/resources/shaders/polychrome.fs","crunched":0,"start":19521270,"end":19527096,"audio":false},{"filename":"/resources/shaders/skew.fs","crunched":0,"start":19527096,"end":19527767,"audio":false},{"filename":"/resources/shaders/splash.fs","crunched":0,"start":19527767,"end":19530374,"audio":false},{"filename":"/resources/shaders/vortex.fs","crunched":0,"start":19530374,"end":19531185,"audio":false},{"filename":"/resources/shaders/voucher.fs","crunched":0,"start":19531185,"end":19536014,"audio":false},{"filename":"/resources/sounds/ambientFire1.ogg","crunched":0,"start":19536014,"end":20014345,"audio":true},{"filename":"/resources/sounds/ambientFire2.ogg","crunched":0,"start":20014345,"end":20522842,"audio":true},{"filename":"/resources/sounds/ambientFire3.ogg","crunched":0,"start":20522842,"end":21026399,"audio":true},{"filename":"/resources/sounds/ambientOrgan1.ogg","crunched":0,"start":21026399,"end":21407352,"audio":true},{"filename":"/resources/sounds/button.ogg","crunched":0,"start":21407352,"end":21415485,"audio":true},{"filename":"/resources/sounds/cancel.ogg","crunched":0,"start":21415485,"end":21425565,"audio":true},{"filename":"/resources/sounds/card1.ogg","crunched":0,"start":21425565,"end":21439503,"audio":true},{"filename":"/resources/sounds/card3.ogg","crunched":0,"start":21439503,"end":21451375,"audio":true},{"filename":"/resources/sounds/cardFan2.ogg","crunched":0,"start":21451375,"end":21467844,"audio":true},{"filename":"/resources/sounds/cardSlide1.ogg","crunched":0,"start":21467844,"end":21478772,"audio":true},{"filename":"/resources/sounds/cardSlide2.ogg","crunched":0,"start":21478772,"end":21488655,"audio":true},{"filename":"/resources/sounds/chips1.ogg","crunched":0,"start":21488655,"end":21497639,"audio":true},{"filename":"/resources/sounds/chips2.ogg","crunched":0,"start":21497639,"end":21509756,"audio":true},{"filename":"/resources/sounds/coin1.ogg","crunched":0,"start":21509756,"end":21521065,"audio":true},{"filename":"/resources/sounds/coin2.ogg","crunched":0,"start":21521065,"end":21530791,"audio":true},{"filename":"/resources/sounds/coin3.ogg","crunched":0,"start":21530791,"end":21542454,"audio":true},{"filename":"/resources/sounds/coin4.ogg","crunched":0,"start":21542454,"end":21552979,"audio":true},{"filename":"/resources/sounds/coin5.ogg","crunched":0,"start":21552979,"end":21566081,"audio":true},{"filename":"/resources/sounds/coin6.ogg","crunched":0,"start":21566081,"end":21584132,"audio":true},{"filename":"/resources/sounds/coin7.ogg","crunched":0,"start":21584132,"end":21595447,"audio":true},{"filename":"/resources/sounds/crumple1.ogg","crunched":0,"start":21595447,"end":21609631,"audio":true},{"filename":"/resources/sounds/crumple2.ogg","crunched":0,"start":21609631,"end":21623967,"audio":true},{"filename":"/resources/sounds/crumple3.ogg","crunched":0,"start":21623967,"end":21637251,"audio":true},{"filename":"/resources/sounds/crumple4.ogg","crunched":0,"start":21637251,"end":21650383,"audio":true},{"filename":"/resources/sounds/crumple5.ogg","crunched":0,"start":21650383,"end":21664189,"audio":true},{"filename":"/resources/sounds/crumpleLong1.ogg","crunched":0,"start":21664189,"end":21715327,"audio":true},{"filename":"/resources/sounds/crumpleLong2.ogg","crunched":0,"start":21715327,"end":21770069,"audio":true},{"filename":"/resources/sounds/explosion1.ogg","crunched":0,"start":21770069,"end":21818495,"audio":true},{"filename":"/resources/sounds/explosion_buildup1.ogg","crunched":0,"start":21818495,"end":21850346,"audio":true},{"filename":"/resources/sounds/explosion_release1.ogg","crunched":0,"start":21850346,"end":21882344,"audio":true},{"filename":"/resources/sounds/foil1.ogg","crunched":0,"start":21882344,"end":21891110,"audio":true},{"filename":"/resources/sounds/foil2.ogg","crunched":0,"start":21891110,"end":21900652,"audio":true},{"filename":"/resources/sounds/generic1.ogg","crunched":0,"start":21900652,"end":21907787,"audio":true},{"filename":"/resources/sounds/glass1.ogg","crunched":0,"start":21907787,"end":21924741,"audio":true},{"filename":"/resources/sounds/glass2.ogg","crunched":0,"start":21924741,"end":21941538,"audio":true},{"filename":"/resources/sounds/glass3.ogg","crunched":0,"start":21941538,"end":21958110,"audio":true},{"filename":"/resources/sounds/glass4.ogg","crunched":0,"start":21958110,"end":21975614,"audio":true},{"filename":"/resources/sounds/glass5.ogg","crunched":0,"start":21975614,"end":21992749,"audio":true},{"filename":"/resources/sounds/glass6.ogg","crunched":0,"start":21992749,"end":22010794,"audio":true},{"filename":"/resources/sounds/gold_seal.ogg","crunched":0,"start":22010794,"end":22024078,"audio":true},{"filename":"/resources/sounds/gong.ogg","crunched":0,"start":22024078,"end":22042223,"audio":true},{"filename":"/resources/sounds/highlight1.ogg","crunched":0,"start":22042223,"end":22049410,"audio":true},{"filename":"/resources/sounds/highlight2.ogg","crunched":0,"start":22049410,"end":22062794,"audio":true},{"filename":"/resources/sounds/holo1.ogg","crunched":0,"start":22062794,"end":22075349,"audio":true},{"filename":"/resources/sounds/introPad1.ogg","crunched":0,"start":22075349,"end":22409367,"audio":true},{"filename":"/resources/sounds/magic_crumple.ogg","crunched":0,"start":22409367,"end":22495496,"audio":true},{"filename":"/resources/sounds/magic_crumple2.ogg","crunched":0,"start":22495496,"end":22530826,"audio":true},{"filename":"/resources/sounds/magic_crumple3.ogg","crunched":0,"start":22530826,"end":22555256,"audio":true},{"filename":"/resources/sounds/multhit1.ogg","crunched":0,"start":22555256,"end":22567338,"audio":true},{"filename":"/resources/sounds/multhit2.ogg","crunched":0,"start":22567338,"end":22582290,"audio":true},{"filename":"/resources/sounds/music1.ogg","crunched":0,"start":22582290,"end":25521032,"audio":true},{"filename":"/resources/sounds/music2.ogg","crunched":0,"start":25521032,"end":28136301,"audio":true},{"filename":"/resources/sounds/music3.ogg","crunched":0,"start":28136301,"end":30647359,"audio":true},{"filename":"/resources/sounds/music4.ogg","crunched":0,"start":30647359,"end":33455756,"audio":true},{"filename":"/resources/sounds/music5.ogg","crunched":0,"start":33455756,"end":36301584,"audio":true},{"filename":"/resources/sounds/negative.ogg","crunched":0,"start":36301584,"end":36314782,"audio":true},{"filename":"/resources/sounds/other1.ogg","crunched":0,"start":36314782,"end":36326930,"audio":true},{"filename":"/resources/sounds/paper1.ogg","crunched":0,"start":36326930,"end":36332202,"audio":true},{"filename":"/resources/sounds/polychrome1.ogg","crunched":0,"start":36332202,"end":36362223,"audio":true},{"filename":"/resources/sounds/slice1.ogg","crunched":0,"start":36362223,"end":36370720,"audio":true},{"filename":"/resources/sounds/splash_buildup.ogg","crunched":0,"start":36370720,"end":36710279,"audio":true},{"filename":"/resources/sounds/tarot1.ogg","crunched":0,"start":36710279,"end":36719400,"audio":true},{"filename":"/resources/sounds/tarot2.ogg","crunched":0,"start":36719400,"end":36730222,"audio":true},{"filename":"/resources/sounds/timpani.ogg","crunched":0,"start":36730222,"end":36744413,"audio":true},{"filename":"/resources/sounds/voice1.ogg","crunched":0,"start":36744413,"end":36751497,"audio":true},{"filename":"/resources/sounds/voice10.ogg","crunched":0,"start":36751497,"end":36758588,"audio":true},{"filename":"/resources/sounds/voice11.ogg","crunched":0,"start":36758588,"end":36765577,"audio":true},{"filename":"/resources/sounds/voice2.ogg","crunched":0,"start":36765577,"end":36772597,"audio":true},{"filename":"/resources/sounds/voice3.ogg","crunched":0,"start":36772597,"end":36779696,"audio":true},{"filename":"/resources/sounds/voice4.ogg","crunched":0,"start":36779696,"end":36787059,"audio":true},{"filename":"/resources/sounds/voice5.ogg","crunched":0,"start":36787059,"end":36794254,"audio":true},{"filename":"/resources/sounds/voice6.ogg","crunched":0,"start":36794254,"end":36801373,"audio":true},{"filename":"/resources/sounds/voice7.ogg","crunched":0,"start":36801373,"end":36808434,"audio":true},{"filename":"/resources/sounds/voice8.ogg","crunched":0,"start":36808434,"end":36815598,"audio":true},{"filename":"/resources/sounds/voice9.ogg","crunched":0,"start":36815598,"end":36822764,"audio":true},{"filename":"/resources/sounds/whoosh.ogg","crunched":0,"start":36822764,"end":36832676,"audio":true},{"filename":"/resources/sounds/whoosh1.ogg","crunched":0,"start":36832676,"end":36845578,"audio":true},{"filename":"/resources/sounds/whoosh2.ogg","crunched":0,"start":36845578,"end":36858426,"audio":true},{"filename":"/resources/sounds/whoosh_long.ogg","crunched":0,"start":36858426,"end":36972607,"audio":true},{"filename":"/resources/sounds/win.ogg","crunched":0,"start":36972607,"end":37009173,"audio":true},{"filename":"/resources/textures/1x/8BitDeck.png","crunched":0,"start":37009173,"end":37056051,"audio":false},{"filename":"/resources/textures/1x/8BitDeck_opt2.png","crunched":0,"start":37056051,"end":37118188,"audio":false},{"filename":"/resources/textures/1x/BlindChips.png","crunched":0,"start":37118188,"end":37202000,"audio":false},{"filename":"/resources/textures/1x/Enhancers.png","crunched":0,"start":37202000,"end":37277952,"audio":false},{"filename":"/resources/textures/1x/Jokers.png","crunched":0,"start":37277952,"end":37782639,"audio":false},{"filename":"/resources/textures/1x/ShopSignAnimation.png","crunched":0,"start":37782639,"end":37793437,"audio":false},{"filename":"/resources/textures/1x/Tarots.png","crunched":0,"start":37793437,"end":37889768,"audio":false},{"filename":"/resources/textures/1x/Vouchers.png","crunched":0,"start":37889768,"end":37960477,"audio":false},{"filename":"/resources/textures/1x/balatro.png","crunched":0,"start":37960477,"end":37987354,"audio":false},{"filename":"/resources/textures/1x/balatro_alt.png","crunched":0,"start":37987354,"end":38008180,"audio":false},{"filename":"/resources/textures/1x/boosters.png","crunched":0,"start":38008180,"end":38178798,"audio":false},{"filename":"/resources/textures/1x/chips.png","crunched":0,"start":38178798,"end":38187053,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AC_1.png","crunched":0,"start":38187053,"end":38195432,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AC_2.png","crunched":0,"start":38195432,"end":38203747,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AU_1.png","crunched":0,"start":38203747,"end":38208779,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AU_2.png","crunched":0,"start":38208779,"end":38216083,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_BUG_1.png","crunched":0,"start":38216083,"end":38227235,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_BUG_2.png","crunched":0,"start":38227235,"end":38239955,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_C7_1.png","crunched":0,"start":38239955,"end":38249758,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_C7_2.png","crunched":0,"start":38249758,"end":38259437,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CL_1.png","crunched":0,"start":38259437,"end":38265920,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CL_2.png","crunched":0,"start":38265920,"end":38274182,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CR_1.png","crunched":0,"start":38274182,"end":38282349,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CR_2.png","crunched":0,"start":38282349,"end":38291350,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CYP_1.png","crunched":0,"start":38291350,"end":38298614,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CYP_2.png","crunched":0,"start":38298614,"end":38305936,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_D2_1.png","crunched":0,"start":38305936,"end":38313650,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_D2_2.png","crunched":0,"start":38313650,"end":38322491,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DBD_1.png","crunched":0,"start":38322491,"end":38331178,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DBD_2.png","crunched":0,"start":38331178,"end":38340267,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DS_1.png","crunched":0,"start":38340267,"end":38348065,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DS_2.png","crunched":0,"start":38348065,"end":38355796,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DTD_1.png","crunched":0,"start":38355796,"end":38363230,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DTD_2.png","crunched":0,"start":38363230,"end":38369192,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_EG_1.png","crunched":0,"start":38369192,"end":38373925,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_EG_2.png","crunched":0,"start":38373925,"end":38379124,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_FO_1.png","crunched":0,"start":38379124,"end":38388369,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_FO_2.png","crunched":0,"start":38388369,"end":38397927,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_PC_1.png","crunched":0,"start":38397927,"end":38405597,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_PC_2.png","crunched":0,"start":38405597,"end":38413094,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_R_1.png","crunched":0,"start":38413094,"end":38424802,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_R_2.png","crunched":0,"start":38424802,"end":38437603,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SK_1.png","crunched":0,"start":38437603,"end":38449487,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SK_2.png","crunched":0,"start":38449487,"end":38461128,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STP_1.png","crunched":0,"start":38461128,"end":38469566,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STP_2.png","crunched":0,"start":38469566,"end":38477991,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STS_1.png","crunched":0,"start":38477991,"end":38487152,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STS_2.png","crunched":0,"start":38487152,"end":38497251,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SV_1.png","crunched":0,"start":38497251,"end":38505129,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SV_2.png","crunched":0,"start":38505129,"end":38513711,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TBoI_1.png","crunched":0,"start":38513711,"end":38521148,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TBoI_2.png","crunched":0,"start":38521148,"end":38528620,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TW_1.png","crunched":0,"start":38528620,"end":38536187,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TW_2.png","crunched":0,"start":38536187,"end":38543534,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_VS_1.png","crunched":0,"start":38543534,"end":38548526,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_VS_2.png","crunched":0,"start":38548526,"end":38556332,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_WF_1.png","crunched":0,"start":38556332,"end":38562962,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_WF_2.png","crunched":0,"start":38562962,"end":38570391,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_XR_1.png","crunched":0,"start":38570391,"end":38582537,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_XR_2.png","crunched":0,"start":38582537,"end":38593157,"audio":false},{"filename":"/resources/textures/1x/gamepad_ui.png","crunched":0,"start":38593157,"end":38613084,"audio":false},{"filename":"/resources/textures/1x/icons.png","crunched":0,"start":38613084,"end":38621640,"audio":false},{"filename":"/resources/textures/1x/localthunk-logo.png","crunched":0,"start":38621640,"end":38631267,"audio":false},{"filename":"/resources/textures/1x/playstack-logo.png","crunched":0,"start":38631267,"end":38703993,"audio":false},{"filename":"/resources/textures/1x/stickers.png","crunched":0,"start":38703993,"end":38708377,"audio":false},{"filename":"/resources/textures/1x/tags.png","crunched":0,"start":38708377,"end":38715712,"audio":false},{"filename":"/resources/textures/1x/ui_assets.png","crunched":0,"start":38715712,"end":38717180,"audio":false},{"filename":"/resources/textures/1x/ui_assets_opt2.png","crunched":0,"start":38717180,"end":38718632,"audio":false},{"filename":"/resources/textures/2x/8BitDeck.png","crunched":0,"start":38718632,"end":38783030,"audio":false},{"filename":"/resources/textures/2x/8BitDeck_opt2.png","crunched":0,"start":38783030,"end":38863600,"audio":false},{"filename":"/resources/textures/2x/BlindChips.png","crunched":0,"start":38863600,"end":38998106,"audio":false},{"filename":"/resources/textures/2x/Enhancers.png","crunched":0,"start":38998106,"end":39091991,"audio":false},{"filename":"/resources/textures/2x/Jokers.png","crunched":0,"start":39091991,"end":39704515,"audio":false},{"filename":"/resources/textures/2x/ShopSignAnimation.png","crunched":0,"start":39704515,"end":39720170,"audio":false},{"filename":"/resources/textures/2x/Tarots.png","crunched":0,"start":39720170,"end":39839832,"audio":false},{"filename":"/resources/textures/2x/Vouchers.png","crunched":0,"start":39839832,"end":39924433,"audio":false},{"filename":"/resources/textures/2x/balatro.png","crunched":0,"start":39924433,"end":39959767,"audio":false},{"filename":"/resources/textures/2x/balatro_alt.png","crunched":0,"start":39959767,"end":39986835,"audio":false},{"filename":"/resources/textures/2x/boosters.png","crunched":0,"start":39986835,"end":40198498,"audio":false},{"filename":"/resources/textures/2x/chips.png","crunched":0,"start":40198498,"end":40208380,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AC_1.png","crunched":0,"start":40208380,"end":40218285,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AC_2.png","crunched":0,"start":40218285,"end":40228153,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AU_1.png","crunched":0,"start":40228153,"end":40236127,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AU_2.png","crunched":0,"start":40236127,"end":40246422,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_BUG_1.png","crunched":0,"start":40246422,"end":40259820,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_BUG_2.png","crunched":0,"start":40259820,"end":40274550,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_C7_1.png","crunched":0,"start":40274550,"end":40286270,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_C7_2.png","crunched":0,"start":40286270,"end":40298002,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CL_1.png","crunched":0,"start":40298002,"end":40308495,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CL_2.png","crunched":0,"start":40308495,"end":40318261,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CR_1.png","crunched":0,"start":40318261,"end":40328112,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CR_2.png","crunched":0,"start":40328112,"end":40338852,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CYP_1.png","crunched":0,"start":40338852,"end":40350344,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CYP_2.png","crunched":0,"start":40350344,"end":40361910,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_D2_1.png","crunched":0,"start":40361910,"end":40372416,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_D2_2.png","crunched":0,"start":40372416,"end":40382985,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DBD_1.png","crunched":0,"start":40382985,"end":40393163,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DBD_2.png","crunched":0,"start":40393163,"end":40403907,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DS_1.png","crunched":0,"start":40403907,"end":40413531,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DS_2.png","crunched":0,"start":40413531,"end":40423116,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DTD_1.png","crunched":0,"start":40423116,"end":40432682,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DTD_2.png","crunched":0,"start":40432682,"end":40440099,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_EG_1.png","crunched":0,"start":40440099,"end":40445940,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_EG_2.png","crunched":0,"start":40445940,"end":40452338,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_FO_1.png","crunched":0,"start":40452338,"end":40463260,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_FO_2.png","crunched":0,"start":40463260,"end":40474541,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_PC_1.png","crunched":0,"start":40474541,"end":40483628,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_PC_2.png","crunched":0,"start":40483628,"end":40492663,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_R_1.png","crunched":0,"start":40492663,"end":40506477,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_R_2.png","crunched":0,"start":40506477,"end":40521535,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SK_1.png","crunched":0,"start":40521535,"end":40535259,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SK_2.png","crunched":0,"start":40535259,"end":40548648,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STP_1.png","crunched":0,"start":40548648,"end":40558690,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STP_2.png","crunched":0,"start":40558690,"end":40568688,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STS_1.png","crunched":0,"start":40568688,"end":40579747,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STS_2.png","crunched":0,"start":40579747,"end":40591901,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SV_1.png","crunched":0,"start":40591901,"end":40603514,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SV_2.png","crunched":0,"start":40603514,"end":40616111,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TBoI_1.png","crunched":0,"start":40616111,"end":40626835,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TBoI_2.png","crunched":0,"start":40626835,"end":40637558,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TW_1.png","crunched":0,"start":40637558,"end":40648785,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TW_2.png","crunched":0,"start":40648785,"end":40659711,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_VS_1.png","crunched":0,"start":40659711,"end":40667130,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_VS_2.png","crunched":0,"start":40667130,"end":40676396,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_WF_1.png","crunched":0,"start":40676396,"end":40687679,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_WF_2.png","crunched":0,"start":40687679,"end":40700441,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_XR_1.png","crunched":0,"start":40700441,"end":40714670,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_XR_2.png","crunched":0,"start":40714670,"end":40727562,"audio":false},{"filename":"/resources/textures/2x/gamepad_ui.png","crunched":0,"start":40727562,"end":40752427,"audio":false},{"filename":"/resources/textures/2x/icons.png","crunched":0,"start":40752427,"end":40763997,"audio":false},{"filename":"/resources/textures/2x/localthunk-logo.png","crunched":0,"start":40763997,"end":40784560,"audio":false},{"filename":"/resources/textures/2x/playstack-logo.png","crunched":0,"start":40784560,"end":40891948,"audio":false},{"filename":"/resources/textures/2x/stickers.png","crunched":0,"start":40891948,"end":40898686,"audio":false},{"filename":"/resources/textures/2x/tags.png","crunched":0,"start":40898686,"end":40909537,"audio":false},{"filename":"/resources/textures/2x/ui_assets.png","crunched":0,"start":40909537,"end":40911294,"audio":false},{"filename":"/resources/textures/2x/ui_assets_opt2.png","crunched":0,"start":40911294,"end":40913048,"audio":false},{"filename":"/tag.lua","crunched":0,"start":40913048,"end":40938187,"audio":false},{"filename":"/version.jkr","crunched":0,"start":40938187,"end":40938221,"audio":false}]});

})();

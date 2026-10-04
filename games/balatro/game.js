
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
  loadPackage({"package_uuid":"4f929f6f-819c-4a84-88c9-9b405f9ebc70","remote_package_size":40939235,"files":[{"filename":"/back.lua","crunched":0,"start":0,"end":12555,"audio":false},{"filename":"/bit.lua","crunched":0,"start":12555,"end":14060,"audio":false},{"filename":"/blind.lua","crunched":0,"start":14060,"end":41594,"audio":false},{"filename":"/card.lua","crunched":0,"start":41594,"end":284145,"audio":false},{"filename":"/card_character.lua","crunched":0,"start":284145,"end":289503,"audio":false},{"filename":"/cardarea.lua","crunched":0,"start":289503,"end":321585,"audio":false},{"filename":"/challenges.lua","crunched":0,"start":321585,"end":345517,"audio":false},{"filename":"/conf.lua","crunched":0,"start":345517,"end":345727,"audio":false},{"filename":"/engine/animatedsprite.lua","crunched":0,"start":345727,"end":348999,"audio":false},{"filename":"/engine/controller.lua","crunched":0,"start":348999,"end":409653,"audio":false},{"filename":"/engine/event.lua","crunched":0,"start":409653,"end":416687,"audio":false},{"filename":"/engine/http_manager.lua","crunched":0,"start":416687,"end":417357,"audio":false},{"filename":"/engine/moveable.lua","crunched":0,"start":417357,"end":437888,"audio":false},{"filename":"/engine/node.lua","crunched":0,"start":437888,"end":453605,"audio":false},{"filename":"/engine/object.lua","crunched":0,"start":453605,"end":454271,"audio":false},{"filename":"/engine/particles.lua","crunched":0,"start":454271,"end":460866,"audio":false},{"filename":"/engine/profile.lua","crunched":0,"start":460866,"end":465439,"audio":false},{"filename":"/engine/save_manager.lua","crunched":0,"start":465439,"end":469259,"audio":false},{"filename":"/engine/sound_manager.lua","crunched":0,"start":469259,"end":476824,"audio":false},{"filename":"/engine/sprite.lua","crunched":0,"start":476824,"end":484790,"audio":false},{"filename":"/engine/string_packer.lua","crunched":0,"start":484790,"end":487570,"audio":false},{"filename":"/engine/text.lua","crunched":0,"start":487570,"end":502526,"audio":false},{"filename":"/engine/ui.lua","crunched":0,"start":502526,"end":547823,"audio":false},{"filename":"/engine/web_random.lua","crunched":0,"start":547823,"end":553140,"audio":false},{"filename":"/functions/UI_definitions.lua","crunched":0,"start":553140,"end":902963,"audio":false},{"filename":"/functions/button_callbacks.lua","crunched":0,"start":902963,"end":1020399,"audio":false},{"filename":"/functions/common_events.lua","crunched":0,"start":1020399,"end":1151057,"audio":false},{"filename":"/functions/misc_functions.lua","crunched":0,"start":1151057,"end":1224307,"audio":false},{"filename":"/functions/state_events.lua","crunched":0,"start":1224307,"end":1300269,"audio":false},{"filename":"/functions/test_functions.lua","crunched":0,"start":1300269,"end":1308418,"audio":false},{"filename":"/game.lua","crunched":0,"start":1308418,"end":1546362,"audio":false},{"filename":"/globals.lua","crunched":0,"start":1546362,"end":1562571,"audio":false},{"filename":"/localization/de.lua","crunched":0,"start":1562571,"end":1717252,"audio":false},{"filename":"/localization/en-us.lua","crunched":0,"start":1717252,"end":1863938,"audio":false},{"filename":"/localization/es_419.lua","crunched":0,"start":1863938,"end":2017500,"audio":false},{"filename":"/localization/es_ES.lua","crunched":0,"start":2017500,"end":2171170,"audio":false},{"filename":"/localization/fr.lua","crunched":0,"start":2171170,"end":2328720,"audio":false},{"filename":"/localization/id.lua","crunched":0,"start":2328720,"end":2480377,"audio":false},{"filename":"/localization/it.lua","crunched":0,"start":2480377,"end":2632243,"audio":false},{"filename":"/localization/ja.lua","crunched":0,"start":2632243,"end":2800640,"audio":false},{"filename":"/localization/ko.lua","crunched":0,"start":2800640,"end":2960713,"audio":false},{"filename":"/localization/nl.lua","crunched":0,"start":2960713,"end":3113484,"audio":false},{"filename":"/localization/pl.lua","crunched":0,"start":3113484,"end":3268370,"audio":false},{"filename":"/localization/pt_BR.lua","crunched":0,"start":3268370,"end":3421752,"audio":false},{"filename":"/localization/ru.lua","crunched":0,"start":3421752,"end":3603623,"audio":false},{"filename":"/localization/zh_CN.lua","crunched":0,"start":3603623,"end":3751030,"audio":false},{"filename":"/localization/zh_TW.lua","crunched":0,"start":3751030,"end":3898072,"audio":false},{"filename":"/main.lua","crunched":0,"start":3898072,"end":3911356,"audio":false},{"filename":"/resources/fonts/GoNotoCurrent-Bold.ttf","crunched":0,"start":3911356,"end":18445400,"audio":false},{"filename":"/resources/fonts/NotoSans-Bold.ttf","crunched":0,"start":18445400,"end":19028004,"audio":false},{"filename":"/resources/fonts/m6x11plus.ttf","crunched":0,"start":19028004,"end":19063069,"audio":false},{"filename":"/resources/gamecontrollerdb.txt","crunched":0,"start":19063069,"end":19460893,"audio":false},{"filename":"/resources/shaders/CRT.fs","crunched":0,"start":19460893,"end":19468163,"audio":false},{"filename":"/resources/shaders/background.fs","crunched":0,"start":19468163,"end":19470683,"audio":false},{"filename":"/resources/shaders/booster.fs","crunched":0,"start":19470683,"end":19476006,"audio":false},{"filename":"/resources/shaders/debuff.fs","crunched":0,"start":19476006,"end":19481170,"audio":false},{"filename":"/resources/shaders/dissolve.fs","crunched":0,"start":19481170,"end":19485439,"audio":false},{"filename":"/resources/shaders/flame.fs","crunched":0,"start":19485439,"end":19488284,"audio":false},{"filename":"/resources/shaders/flash.fs","crunched":0,"start":19488284,"end":19489185,"audio":false},{"filename":"/resources/shaders/foil.fs","crunched":0,"start":19489185,"end":19495120,"audio":false},{"filename":"/resources/shaders/gold_seal.fs","crunched":0,"start":19495120,"end":19495921,"audio":false},{"filename":"/resources/shaders/holo.fs","crunched":0,"start":19495921,"end":19501928,"audio":false},{"filename":"/resources/shaders/hologram.fs","crunched":0,"start":19501928,"end":19507690,"audio":false},{"filename":"/resources/shaders/negative.fs","crunched":0,"start":19507690,"end":19512584,"audio":false},{"filename":"/resources/shaders/negative_shine.fs","crunched":0,"start":19512584,"end":19517494,"audio":false},{"filename":"/resources/shaders/played.fs","crunched":0,"start":19517494,"end":19522284,"audio":false},{"filename":"/resources/shaders/polychrome.fs","crunched":0,"start":19522284,"end":19528110,"audio":false},{"filename":"/resources/shaders/skew.fs","crunched":0,"start":19528110,"end":19528781,"audio":false},{"filename":"/resources/shaders/splash.fs","crunched":0,"start":19528781,"end":19531388,"audio":false},{"filename":"/resources/shaders/vortex.fs","crunched":0,"start":19531388,"end":19532199,"audio":false},{"filename":"/resources/shaders/voucher.fs","crunched":0,"start":19532199,"end":19537028,"audio":false},{"filename":"/resources/sounds/ambientFire1.ogg","crunched":0,"start":19537028,"end":20015359,"audio":true},{"filename":"/resources/sounds/ambientFire2.ogg","crunched":0,"start":20015359,"end":20523856,"audio":true},{"filename":"/resources/sounds/ambientFire3.ogg","crunched":0,"start":20523856,"end":21027413,"audio":true},{"filename":"/resources/sounds/ambientOrgan1.ogg","crunched":0,"start":21027413,"end":21408366,"audio":true},{"filename":"/resources/sounds/button.ogg","crunched":0,"start":21408366,"end":21416499,"audio":true},{"filename":"/resources/sounds/cancel.ogg","crunched":0,"start":21416499,"end":21426579,"audio":true},{"filename":"/resources/sounds/card1.ogg","crunched":0,"start":21426579,"end":21440517,"audio":true},{"filename":"/resources/sounds/card3.ogg","crunched":0,"start":21440517,"end":21452389,"audio":true},{"filename":"/resources/sounds/cardFan2.ogg","crunched":0,"start":21452389,"end":21468858,"audio":true},{"filename":"/resources/sounds/cardSlide1.ogg","crunched":0,"start":21468858,"end":21479786,"audio":true},{"filename":"/resources/sounds/cardSlide2.ogg","crunched":0,"start":21479786,"end":21489669,"audio":true},{"filename":"/resources/sounds/chips1.ogg","crunched":0,"start":21489669,"end":21498653,"audio":true},{"filename":"/resources/sounds/chips2.ogg","crunched":0,"start":21498653,"end":21510770,"audio":true},{"filename":"/resources/sounds/coin1.ogg","crunched":0,"start":21510770,"end":21522079,"audio":true},{"filename":"/resources/sounds/coin2.ogg","crunched":0,"start":21522079,"end":21531805,"audio":true},{"filename":"/resources/sounds/coin3.ogg","crunched":0,"start":21531805,"end":21543468,"audio":true},{"filename":"/resources/sounds/coin4.ogg","crunched":0,"start":21543468,"end":21553993,"audio":true},{"filename":"/resources/sounds/coin5.ogg","crunched":0,"start":21553993,"end":21567095,"audio":true},{"filename":"/resources/sounds/coin6.ogg","crunched":0,"start":21567095,"end":21585146,"audio":true},{"filename":"/resources/sounds/coin7.ogg","crunched":0,"start":21585146,"end":21596461,"audio":true},{"filename":"/resources/sounds/crumple1.ogg","crunched":0,"start":21596461,"end":21610645,"audio":true},{"filename":"/resources/sounds/crumple2.ogg","crunched":0,"start":21610645,"end":21624981,"audio":true},{"filename":"/resources/sounds/crumple3.ogg","crunched":0,"start":21624981,"end":21638265,"audio":true},{"filename":"/resources/sounds/crumple4.ogg","crunched":0,"start":21638265,"end":21651397,"audio":true},{"filename":"/resources/sounds/crumple5.ogg","crunched":0,"start":21651397,"end":21665203,"audio":true},{"filename":"/resources/sounds/crumpleLong1.ogg","crunched":0,"start":21665203,"end":21716341,"audio":true},{"filename":"/resources/sounds/crumpleLong2.ogg","crunched":0,"start":21716341,"end":21771083,"audio":true},{"filename":"/resources/sounds/explosion1.ogg","crunched":0,"start":21771083,"end":21819509,"audio":true},{"filename":"/resources/sounds/explosion_buildup1.ogg","crunched":0,"start":21819509,"end":21851360,"audio":true},{"filename":"/resources/sounds/explosion_release1.ogg","crunched":0,"start":21851360,"end":21883358,"audio":true},{"filename":"/resources/sounds/foil1.ogg","crunched":0,"start":21883358,"end":21892124,"audio":true},{"filename":"/resources/sounds/foil2.ogg","crunched":0,"start":21892124,"end":21901666,"audio":true},{"filename":"/resources/sounds/generic1.ogg","crunched":0,"start":21901666,"end":21908801,"audio":true},{"filename":"/resources/sounds/glass1.ogg","crunched":0,"start":21908801,"end":21925755,"audio":true},{"filename":"/resources/sounds/glass2.ogg","crunched":0,"start":21925755,"end":21942552,"audio":true},{"filename":"/resources/sounds/glass3.ogg","crunched":0,"start":21942552,"end":21959124,"audio":true},{"filename":"/resources/sounds/glass4.ogg","crunched":0,"start":21959124,"end":21976628,"audio":true},{"filename":"/resources/sounds/glass5.ogg","crunched":0,"start":21976628,"end":21993763,"audio":true},{"filename":"/resources/sounds/glass6.ogg","crunched":0,"start":21993763,"end":22011808,"audio":true},{"filename":"/resources/sounds/gold_seal.ogg","crunched":0,"start":22011808,"end":22025092,"audio":true},{"filename":"/resources/sounds/gong.ogg","crunched":0,"start":22025092,"end":22043237,"audio":true},{"filename":"/resources/sounds/highlight1.ogg","crunched":0,"start":22043237,"end":22050424,"audio":true},{"filename":"/resources/sounds/highlight2.ogg","crunched":0,"start":22050424,"end":22063808,"audio":true},{"filename":"/resources/sounds/holo1.ogg","crunched":0,"start":22063808,"end":22076363,"audio":true},{"filename":"/resources/sounds/introPad1.ogg","crunched":0,"start":22076363,"end":22410381,"audio":true},{"filename":"/resources/sounds/magic_crumple.ogg","crunched":0,"start":22410381,"end":22496510,"audio":true},{"filename":"/resources/sounds/magic_crumple2.ogg","crunched":0,"start":22496510,"end":22531840,"audio":true},{"filename":"/resources/sounds/magic_crumple3.ogg","crunched":0,"start":22531840,"end":22556270,"audio":true},{"filename":"/resources/sounds/multhit1.ogg","crunched":0,"start":22556270,"end":22568352,"audio":true},{"filename":"/resources/sounds/multhit2.ogg","crunched":0,"start":22568352,"end":22583304,"audio":true},{"filename":"/resources/sounds/music1.ogg","crunched":0,"start":22583304,"end":25522046,"audio":true},{"filename":"/resources/sounds/music2.ogg","crunched":0,"start":25522046,"end":28137315,"audio":true},{"filename":"/resources/sounds/music3.ogg","crunched":0,"start":28137315,"end":30648373,"audio":true},{"filename":"/resources/sounds/music4.ogg","crunched":0,"start":30648373,"end":33456770,"audio":true},{"filename":"/resources/sounds/music5.ogg","crunched":0,"start":33456770,"end":36302598,"audio":true},{"filename":"/resources/sounds/negative.ogg","crunched":0,"start":36302598,"end":36315796,"audio":true},{"filename":"/resources/sounds/other1.ogg","crunched":0,"start":36315796,"end":36327944,"audio":true},{"filename":"/resources/sounds/paper1.ogg","crunched":0,"start":36327944,"end":36333216,"audio":true},{"filename":"/resources/sounds/polychrome1.ogg","crunched":0,"start":36333216,"end":36363237,"audio":true},{"filename":"/resources/sounds/slice1.ogg","crunched":0,"start":36363237,"end":36371734,"audio":true},{"filename":"/resources/sounds/splash_buildup.ogg","crunched":0,"start":36371734,"end":36711293,"audio":true},{"filename":"/resources/sounds/tarot1.ogg","crunched":0,"start":36711293,"end":36720414,"audio":true},{"filename":"/resources/sounds/tarot2.ogg","crunched":0,"start":36720414,"end":36731236,"audio":true},{"filename":"/resources/sounds/timpani.ogg","crunched":0,"start":36731236,"end":36745427,"audio":true},{"filename":"/resources/sounds/voice1.ogg","crunched":0,"start":36745427,"end":36752511,"audio":true},{"filename":"/resources/sounds/voice10.ogg","crunched":0,"start":36752511,"end":36759602,"audio":true},{"filename":"/resources/sounds/voice11.ogg","crunched":0,"start":36759602,"end":36766591,"audio":true},{"filename":"/resources/sounds/voice2.ogg","crunched":0,"start":36766591,"end":36773611,"audio":true},{"filename":"/resources/sounds/voice3.ogg","crunched":0,"start":36773611,"end":36780710,"audio":true},{"filename":"/resources/sounds/voice4.ogg","crunched":0,"start":36780710,"end":36788073,"audio":true},{"filename":"/resources/sounds/voice5.ogg","crunched":0,"start":36788073,"end":36795268,"audio":true},{"filename":"/resources/sounds/voice6.ogg","crunched":0,"start":36795268,"end":36802387,"audio":true},{"filename":"/resources/sounds/voice7.ogg","crunched":0,"start":36802387,"end":36809448,"audio":true},{"filename":"/resources/sounds/voice8.ogg","crunched":0,"start":36809448,"end":36816612,"audio":true},{"filename":"/resources/sounds/voice9.ogg","crunched":0,"start":36816612,"end":36823778,"audio":true},{"filename":"/resources/sounds/whoosh.ogg","crunched":0,"start":36823778,"end":36833690,"audio":true},{"filename":"/resources/sounds/whoosh1.ogg","crunched":0,"start":36833690,"end":36846592,"audio":true},{"filename":"/resources/sounds/whoosh2.ogg","crunched":0,"start":36846592,"end":36859440,"audio":true},{"filename":"/resources/sounds/whoosh_long.ogg","crunched":0,"start":36859440,"end":36973621,"audio":true},{"filename":"/resources/sounds/win.ogg","crunched":0,"start":36973621,"end":37010187,"audio":true},{"filename":"/resources/textures/1x/8BitDeck.png","crunched":0,"start":37010187,"end":37057065,"audio":false},{"filename":"/resources/textures/1x/8BitDeck_opt2.png","crunched":0,"start":37057065,"end":37119202,"audio":false},{"filename":"/resources/textures/1x/BlindChips.png","crunched":0,"start":37119202,"end":37203014,"audio":false},{"filename":"/resources/textures/1x/Enhancers.png","crunched":0,"start":37203014,"end":37278966,"audio":false},{"filename":"/resources/textures/1x/Jokers.png","crunched":0,"start":37278966,"end":37783653,"audio":false},{"filename":"/resources/textures/1x/ShopSignAnimation.png","crunched":0,"start":37783653,"end":37794451,"audio":false},{"filename":"/resources/textures/1x/Tarots.png","crunched":0,"start":37794451,"end":37890782,"audio":false},{"filename":"/resources/textures/1x/Vouchers.png","crunched":0,"start":37890782,"end":37961491,"audio":false},{"filename":"/resources/textures/1x/balatro.png","crunched":0,"start":37961491,"end":37988368,"audio":false},{"filename":"/resources/textures/1x/balatro_alt.png","crunched":0,"start":37988368,"end":38009194,"audio":false},{"filename":"/resources/textures/1x/boosters.png","crunched":0,"start":38009194,"end":38179812,"audio":false},{"filename":"/resources/textures/1x/chips.png","crunched":0,"start":38179812,"end":38188067,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AC_1.png","crunched":0,"start":38188067,"end":38196446,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AC_2.png","crunched":0,"start":38196446,"end":38204761,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AU_1.png","crunched":0,"start":38204761,"end":38209793,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AU_2.png","crunched":0,"start":38209793,"end":38217097,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_BUG_1.png","crunched":0,"start":38217097,"end":38228249,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_BUG_2.png","crunched":0,"start":38228249,"end":38240969,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_C7_1.png","crunched":0,"start":38240969,"end":38250772,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_C7_2.png","crunched":0,"start":38250772,"end":38260451,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CL_1.png","crunched":0,"start":38260451,"end":38266934,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CL_2.png","crunched":0,"start":38266934,"end":38275196,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CR_1.png","crunched":0,"start":38275196,"end":38283363,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CR_2.png","crunched":0,"start":38283363,"end":38292364,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CYP_1.png","crunched":0,"start":38292364,"end":38299628,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CYP_2.png","crunched":0,"start":38299628,"end":38306950,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_D2_1.png","crunched":0,"start":38306950,"end":38314664,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_D2_2.png","crunched":0,"start":38314664,"end":38323505,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DBD_1.png","crunched":0,"start":38323505,"end":38332192,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DBD_2.png","crunched":0,"start":38332192,"end":38341281,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DS_1.png","crunched":0,"start":38341281,"end":38349079,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DS_2.png","crunched":0,"start":38349079,"end":38356810,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DTD_1.png","crunched":0,"start":38356810,"end":38364244,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DTD_2.png","crunched":0,"start":38364244,"end":38370206,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_EG_1.png","crunched":0,"start":38370206,"end":38374939,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_EG_2.png","crunched":0,"start":38374939,"end":38380138,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_FO_1.png","crunched":0,"start":38380138,"end":38389383,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_FO_2.png","crunched":0,"start":38389383,"end":38398941,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_PC_1.png","crunched":0,"start":38398941,"end":38406611,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_PC_2.png","crunched":0,"start":38406611,"end":38414108,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_R_1.png","crunched":0,"start":38414108,"end":38425816,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_R_2.png","crunched":0,"start":38425816,"end":38438617,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SK_1.png","crunched":0,"start":38438617,"end":38450501,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SK_2.png","crunched":0,"start":38450501,"end":38462142,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STP_1.png","crunched":0,"start":38462142,"end":38470580,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STP_2.png","crunched":0,"start":38470580,"end":38479005,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STS_1.png","crunched":0,"start":38479005,"end":38488166,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STS_2.png","crunched":0,"start":38488166,"end":38498265,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SV_1.png","crunched":0,"start":38498265,"end":38506143,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SV_2.png","crunched":0,"start":38506143,"end":38514725,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TBoI_1.png","crunched":0,"start":38514725,"end":38522162,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TBoI_2.png","crunched":0,"start":38522162,"end":38529634,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TW_1.png","crunched":0,"start":38529634,"end":38537201,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TW_2.png","crunched":0,"start":38537201,"end":38544548,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_VS_1.png","crunched":0,"start":38544548,"end":38549540,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_VS_2.png","crunched":0,"start":38549540,"end":38557346,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_WF_1.png","crunched":0,"start":38557346,"end":38563976,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_WF_2.png","crunched":0,"start":38563976,"end":38571405,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_XR_1.png","crunched":0,"start":38571405,"end":38583551,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_XR_2.png","crunched":0,"start":38583551,"end":38594171,"audio":false},{"filename":"/resources/textures/1x/gamepad_ui.png","crunched":0,"start":38594171,"end":38614098,"audio":false},{"filename":"/resources/textures/1x/icons.png","crunched":0,"start":38614098,"end":38622654,"audio":false},{"filename":"/resources/textures/1x/localthunk-logo.png","crunched":0,"start":38622654,"end":38632281,"audio":false},{"filename":"/resources/textures/1x/playstack-logo.png","crunched":0,"start":38632281,"end":38705007,"audio":false},{"filename":"/resources/textures/1x/stickers.png","crunched":0,"start":38705007,"end":38709391,"audio":false},{"filename":"/resources/textures/1x/tags.png","crunched":0,"start":38709391,"end":38716726,"audio":false},{"filename":"/resources/textures/1x/ui_assets.png","crunched":0,"start":38716726,"end":38718194,"audio":false},{"filename":"/resources/textures/1x/ui_assets_opt2.png","crunched":0,"start":38718194,"end":38719646,"audio":false},{"filename":"/resources/textures/2x/8BitDeck.png","crunched":0,"start":38719646,"end":38784044,"audio":false},{"filename":"/resources/textures/2x/8BitDeck_opt2.png","crunched":0,"start":38784044,"end":38864614,"audio":false},{"filename":"/resources/textures/2x/BlindChips.png","crunched":0,"start":38864614,"end":38999120,"audio":false},{"filename":"/resources/textures/2x/Enhancers.png","crunched":0,"start":38999120,"end":39093005,"audio":false},{"filename":"/resources/textures/2x/Jokers.png","crunched":0,"start":39093005,"end":39705529,"audio":false},{"filename":"/resources/textures/2x/ShopSignAnimation.png","crunched":0,"start":39705529,"end":39721184,"audio":false},{"filename":"/resources/textures/2x/Tarots.png","crunched":0,"start":39721184,"end":39840846,"audio":false},{"filename":"/resources/textures/2x/Vouchers.png","crunched":0,"start":39840846,"end":39925447,"audio":false},{"filename":"/resources/textures/2x/balatro.png","crunched":0,"start":39925447,"end":39960781,"audio":false},{"filename":"/resources/textures/2x/balatro_alt.png","crunched":0,"start":39960781,"end":39987849,"audio":false},{"filename":"/resources/textures/2x/boosters.png","crunched":0,"start":39987849,"end":40199512,"audio":false},{"filename":"/resources/textures/2x/chips.png","crunched":0,"start":40199512,"end":40209394,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AC_1.png","crunched":0,"start":40209394,"end":40219299,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AC_2.png","crunched":0,"start":40219299,"end":40229167,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AU_1.png","crunched":0,"start":40229167,"end":40237141,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AU_2.png","crunched":0,"start":40237141,"end":40247436,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_BUG_1.png","crunched":0,"start":40247436,"end":40260834,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_BUG_2.png","crunched":0,"start":40260834,"end":40275564,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_C7_1.png","crunched":0,"start":40275564,"end":40287284,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_C7_2.png","crunched":0,"start":40287284,"end":40299016,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CL_1.png","crunched":0,"start":40299016,"end":40309509,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CL_2.png","crunched":0,"start":40309509,"end":40319275,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CR_1.png","crunched":0,"start":40319275,"end":40329126,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CR_2.png","crunched":0,"start":40329126,"end":40339866,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CYP_1.png","crunched":0,"start":40339866,"end":40351358,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CYP_2.png","crunched":0,"start":40351358,"end":40362924,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_D2_1.png","crunched":0,"start":40362924,"end":40373430,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_D2_2.png","crunched":0,"start":40373430,"end":40383999,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DBD_1.png","crunched":0,"start":40383999,"end":40394177,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DBD_2.png","crunched":0,"start":40394177,"end":40404921,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DS_1.png","crunched":0,"start":40404921,"end":40414545,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DS_2.png","crunched":0,"start":40414545,"end":40424130,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DTD_1.png","crunched":0,"start":40424130,"end":40433696,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DTD_2.png","crunched":0,"start":40433696,"end":40441113,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_EG_1.png","crunched":0,"start":40441113,"end":40446954,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_EG_2.png","crunched":0,"start":40446954,"end":40453352,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_FO_1.png","crunched":0,"start":40453352,"end":40464274,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_FO_2.png","crunched":0,"start":40464274,"end":40475555,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_PC_1.png","crunched":0,"start":40475555,"end":40484642,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_PC_2.png","crunched":0,"start":40484642,"end":40493677,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_R_1.png","crunched":0,"start":40493677,"end":40507491,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_R_2.png","crunched":0,"start":40507491,"end":40522549,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SK_1.png","crunched":0,"start":40522549,"end":40536273,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SK_2.png","crunched":0,"start":40536273,"end":40549662,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STP_1.png","crunched":0,"start":40549662,"end":40559704,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STP_2.png","crunched":0,"start":40559704,"end":40569702,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STS_1.png","crunched":0,"start":40569702,"end":40580761,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STS_2.png","crunched":0,"start":40580761,"end":40592915,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SV_1.png","crunched":0,"start":40592915,"end":40604528,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SV_2.png","crunched":0,"start":40604528,"end":40617125,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TBoI_1.png","crunched":0,"start":40617125,"end":40627849,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TBoI_2.png","crunched":0,"start":40627849,"end":40638572,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TW_1.png","crunched":0,"start":40638572,"end":40649799,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TW_2.png","crunched":0,"start":40649799,"end":40660725,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_VS_1.png","crunched":0,"start":40660725,"end":40668144,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_VS_2.png","crunched":0,"start":40668144,"end":40677410,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_WF_1.png","crunched":0,"start":40677410,"end":40688693,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_WF_2.png","crunched":0,"start":40688693,"end":40701455,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_XR_1.png","crunched":0,"start":40701455,"end":40715684,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_XR_2.png","crunched":0,"start":40715684,"end":40728576,"audio":false},{"filename":"/resources/textures/2x/gamepad_ui.png","crunched":0,"start":40728576,"end":40753441,"audio":false},{"filename":"/resources/textures/2x/icons.png","crunched":0,"start":40753441,"end":40765011,"audio":false},{"filename":"/resources/textures/2x/localthunk-logo.png","crunched":0,"start":40765011,"end":40785574,"audio":false},{"filename":"/resources/textures/2x/playstack-logo.png","crunched":0,"start":40785574,"end":40892962,"audio":false},{"filename":"/resources/textures/2x/stickers.png","crunched":0,"start":40892962,"end":40899700,"audio":false},{"filename":"/resources/textures/2x/tags.png","crunched":0,"start":40899700,"end":40910551,"audio":false},{"filename":"/resources/textures/2x/ui_assets.png","crunched":0,"start":40910551,"end":40912308,"audio":false},{"filename":"/resources/textures/2x/ui_assets_opt2.png","crunched":0,"start":40912308,"end":40914062,"audio":false},{"filename":"/tag.lua","crunched":0,"start":40914062,"end":40939201,"audio":false},{"filename":"/version.jkr","crunched":0,"start":40939201,"end":40939235,"audio":false}]});

})();

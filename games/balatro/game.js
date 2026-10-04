
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
  loadPackage({"package_uuid":"e47ee194-45d5-481d-a0ff-ef415abeb98c","remote_package_size":40938188,"files":[{"filename":"/back.lua","crunched":0,"start":0,"end":12555,"audio":false},{"filename":"/bit.lua","crunched":0,"start":12555,"end":14060,"audio":false},{"filename":"/blind.lua","crunched":0,"start":14060,"end":41594,"audio":false},{"filename":"/card.lua","crunched":0,"start":41594,"end":284145,"audio":false},{"filename":"/card_character.lua","crunched":0,"start":284145,"end":289503,"audio":false},{"filename":"/cardarea.lua","crunched":0,"start":289503,"end":321585,"audio":false},{"filename":"/challenges.lua","crunched":0,"start":321585,"end":345517,"audio":false},{"filename":"/conf.lua","crunched":0,"start":345517,"end":345727,"audio":false},{"filename":"/engine/animatedsprite.lua","crunched":0,"start":345727,"end":348999,"audio":false},{"filename":"/engine/controller.lua","crunched":0,"start":348999,"end":409653,"audio":false},{"filename":"/engine/event.lua","crunched":0,"start":409653,"end":416687,"audio":false},{"filename":"/engine/http_manager.lua","crunched":0,"start":416687,"end":417357,"audio":false},{"filename":"/engine/moveable.lua","crunched":0,"start":417357,"end":437888,"audio":false},{"filename":"/engine/node.lua","crunched":0,"start":437888,"end":453605,"audio":false},{"filename":"/engine/object.lua","crunched":0,"start":453605,"end":454271,"audio":false},{"filename":"/engine/particles.lua","crunched":0,"start":454271,"end":460866,"audio":false},{"filename":"/engine/profile.lua","crunched":0,"start":460866,"end":465439,"audio":false},{"filename":"/engine/save_manager.lua","crunched":0,"start":465439,"end":469259,"audio":false},{"filename":"/engine/sound_manager.lua","crunched":0,"start":469259,"end":476824,"audio":false},{"filename":"/engine/sprite.lua","crunched":0,"start":476824,"end":484790,"audio":false},{"filename":"/engine/string_packer.lua","crunched":0,"start":484790,"end":487570,"audio":false},{"filename":"/engine/text.lua","crunched":0,"start":487570,"end":502526,"audio":false},{"filename":"/engine/ui.lua","crunched":0,"start":502526,"end":547823,"audio":false},{"filename":"/engine/web_random.lua","crunched":0,"start":547823,"end":553140,"audio":false},{"filename":"/functions/UI_definitions.lua","crunched":0,"start":553140,"end":902963,"audio":false},{"filename":"/functions/button_callbacks.lua","crunched":0,"start":902963,"end":1020366,"audio":false},{"filename":"/functions/common_events.lua","crunched":0,"start":1020366,"end":1151024,"audio":false},{"filename":"/functions/misc_functions.lua","crunched":0,"start":1151024,"end":1224274,"audio":false},{"filename":"/functions/state_events.lua","crunched":0,"start":1224274,"end":1300236,"audio":false},{"filename":"/functions/test_functions.lua","crunched":0,"start":1300236,"end":1308385,"audio":false},{"filename":"/game.lua","crunched":0,"start":1308385,"end":1546329,"audio":false},{"filename":"/globals.lua","crunched":0,"start":1546329,"end":1562538,"audio":false},{"filename":"/localization/de.lua","crunched":0,"start":1562538,"end":1717219,"audio":false},{"filename":"/localization/en-us.lua","crunched":0,"start":1717219,"end":1863905,"audio":false},{"filename":"/localization/es_419.lua","crunched":0,"start":1863905,"end":2017467,"audio":false},{"filename":"/localization/es_ES.lua","crunched":0,"start":2017467,"end":2171137,"audio":false},{"filename":"/localization/fr.lua","crunched":0,"start":2171137,"end":2328687,"audio":false},{"filename":"/localization/id.lua","crunched":0,"start":2328687,"end":2480344,"audio":false},{"filename":"/localization/it.lua","crunched":0,"start":2480344,"end":2632210,"audio":false},{"filename":"/localization/ja.lua","crunched":0,"start":2632210,"end":2800607,"audio":false},{"filename":"/localization/ko.lua","crunched":0,"start":2800607,"end":2960680,"audio":false},{"filename":"/localization/nl.lua","crunched":0,"start":2960680,"end":3113451,"audio":false},{"filename":"/localization/pl.lua","crunched":0,"start":3113451,"end":3268337,"audio":false},{"filename":"/localization/pt_BR.lua","crunched":0,"start":3268337,"end":3421719,"audio":false},{"filename":"/localization/ru.lua","crunched":0,"start":3421719,"end":3603590,"audio":false},{"filename":"/localization/zh_CN.lua","crunched":0,"start":3603590,"end":3750997,"audio":false},{"filename":"/localization/zh_TW.lua","crunched":0,"start":3750997,"end":3898039,"audio":false},{"filename":"/main.lua","crunched":0,"start":3898039,"end":3910309,"audio":false},{"filename":"/resources/fonts/GoNotoCurrent-Bold.ttf","crunched":0,"start":3910309,"end":18444353,"audio":false},{"filename":"/resources/fonts/NotoSans-Bold.ttf","crunched":0,"start":18444353,"end":19026957,"audio":false},{"filename":"/resources/fonts/m6x11plus.ttf","crunched":0,"start":19026957,"end":19062022,"audio":false},{"filename":"/resources/gamecontrollerdb.txt","crunched":0,"start":19062022,"end":19459846,"audio":false},{"filename":"/resources/shaders/CRT.fs","crunched":0,"start":19459846,"end":19467116,"audio":false},{"filename":"/resources/shaders/background.fs","crunched":0,"start":19467116,"end":19469636,"audio":false},{"filename":"/resources/shaders/booster.fs","crunched":0,"start":19469636,"end":19474959,"audio":false},{"filename":"/resources/shaders/debuff.fs","crunched":0,"start":19474959,"end":19480123,"audio":false},{"filename":"/resources/shaders/dissolve.fs","crunched":0,"start":19480123,"end":19484392,"audio":false},{"filename":"/resources/shaders/flame.fs","crunched":0,"start":19484392,"end":19487237,"audio":false},{"filename":"/resources/shaders/flash.fs","crunched":0,"start":19487237,"end":19488138,"audio":false},{"filename":"/resources/shaders/foil.fs","crunched":0,"start":19488138,"end":19494073,"audio":false},{"filename":"/resources/shaders/gold_seal.fs","crunched":0,"start":19494073,"end":19494874,"audio":false},{"filename":"/resources/shaders/holo.fs","crunched":0,"start":19494874,"end":19500881,"audio":false},{"filename":"/resources/shaders/hologram.fs","crunched":0,"start":19500881,"end":19506643,"audio":false},{"filename":"/resources/shaders/negative.fs","crunched":0,"start":19506643,"end":19511537,"audio":false},{"filename":"/resources/shaders/negative_shine.fs","crunched":0,"start":19511537,"end":19516447,"audio":false},{"filename":"/resources/shaders/played.fs","crunched":0,"start":19516447,"end":19521237,"audio":false},{"filename":"/resources/shaders/polychrome.fs","crunched":0,"start":19521237,"end":19527063,"audio":false},{"filename":"/resources/shaders/skew.fs","crunched":0,"start":19527063,"end":19527734,"audio":false},{"filename":"/resources/shaders/splash.fs","crunched":0,"start":19527734,"end":19530341,"audio":false},{"filename":"/resources/shaders/vortex.fs","crunched":0,"start":19530341,"end":19531152,"audio":false},{"filename":"/resources/shaders/voucher.fs","crunched":0,"start":19531152,"end":19535981,"audio":false},{"filename":"/resources/sounds/ambientFire1.ogg","crunched":0,"start":19535981,"end":20014312,"audio":true},{"filename":"/resources/sounds/ambientFire2.ogg","crunched":0,"start":20014312,"end":20522809,"audio":true},{"filename":"/resources/sounds/ambientFire3.ogg","crunched":0,"start":20522809,"end":21026366,"audio":true},{"filename":"/resources/sounds/ambientOrgan1.ogg","crunched":0,"start":21026366,"end":21407319,"audio":true},{"filename":"/resources/sounds/button.ogg","crunched":0,"start":21407319,"end":21415452,"audio":true},{"filename":"/resources/sounds/cancel.ogg","crunched":0,"start":21415452,"end":21425532,"audio":true},{"filename":"/resources/sounds/card1.ogg","crunched":0,"start":21425532,"end":21439470,"audio":true},{"filename":"/resources/sounds/card3.ogg","crunched":0,"start":21439470,"end":21451342,"audio":true},{"filename":"/resources/sounds/cardFan2.ogg","crunched":0,"start":21451342,"end":21467811,"audio":true},{"filename":"/resources/sounds/cardSlide1.ogg","crunched":0,"start":21467811,"end":21478739,"audio":true},{"filename":"/resources/sounds/cardSlide2.ogg","crunched":0,"start":21478739,"end":21488622,"audio":true},{"filename":"/resources/sounds/chips1.ogg","crunched":0,"start":21488622,"end":21497606,"audio":true},{"filename":"/resources/sounds/chips2.ogg","crunched":0,"start":21497606,"end":21509723,"audio":true},{"filename":"/resources/sounds/coin1.ogg","crunched":0,"start":21509723,"end":21521032,"audio":true},{"filename":"/resources/sounds/coin2.ogg","crunched":0,"start":21521032,"end":21530758,"audio":true},{"filename":"/resources/sounds/coin3.ogg","crunched":0,"start":21530758,"end":21542421,"audio":true},{"filename":"/resources/sounds/coin4.ogg","crunched":0,"start":21542421,"end":21552946,"audio":true},{"filename":"/resources/sounds/coin5.ogg","crunched":0,"start":21552946,"end":21566048,"audio":true},{"filename":"/resources/sounds/coin6.ogg","crunched":0,"start":21566048,"end":21584099,"audio":true},{"filename":"/resources/sounds/coin7.ogg","crunched":0,"start":21584099,"end":21595414,"audio":true},{"filename":"/resources/sounds/crumple1.ogg","crunched":0,"start":21595414,"end":21609598,"audio":true},{"filename":"/resources/sounds/crumple2.ogg","crunched":0,"start":21609598,"end":21623934,"audio":true},{"filename":"/resources/sounds/crumple3.ogg","crunched":0,"start":21623934,"end":21637218,"audio":true},{"filename":"/resources/sounds/crumple4.ogg","crunched":0,"start":21637218,"end":21650350,"audio":true},{"filename":"/resources/sounds/crumple5.ogg","crunched":0,"start":21650350,"end":21664156,"audio":true},{"filename":"/resources/sounds/crumpleLong1.ogg","crunched":0,"start":21664156,"end":21715294,"audio":true},{"filename":"/resources/sounds/crumpleLong2.ogg","crunched":0,"start":21715294,"end":21770036,"audio":true},{"filename":"/resources/sounds/explosion1.ogg","crunched":0,"start":21770036,"end":21818462,"audio":true},{"filename":"/resources/sounds/explosion_buildup1.ogg","crunched":0,"start":21818462,"end":21850313,"audio":true},{"filename":"/resources/sounds/explosion_release1.ogg","crunched":0,"start":21850313,"end":21882311,"audio":true},{"filename":"/resources/sounds/foil1.ogg","crunched":0,"start":21882311,"end":21891077,"audio":true},{"filename":"/resources/sounds/foil2.ogg","crunched":0,"start":21891077,"end":21900619,"audio":true},{"filename":"/resources/sounds/generic1.ogg","crunched":0,"start":21900619,"end":21907754,"audio":true},{"filename":"/resources/sounds/glass1.ogg","crunched":0,"start":21907754,"end":21924708,"audio":true},{"filename":"/resources/sounds/glass2.ogg","crunched":0,"start":21924708,"end":21941505,"audio":true},{"filename":"/resources/sounds/glass3.ogg","crunched":0,"start":21941505,"end":21958077,"audio":true},{"filename":"/resources/sounds/glass4.ogg","crunched":0,"start":21958077,"end":21975581,"audio":true},{"filename":"/resources/sounds/glass5.ogg","crunched":0,"start":21975581,"end":21992716,"audio":true},{"filename":"/resources/sounds/glass6.ogg","crunched":0,"start":21992716,"end":22010761,"audio":true},{"filename":"/resources/sounds/gold_seal.ogg","crunched":0,"start":22010761,"end":22024045,"audio":true},{"filename":"/resources/sounds/gong.ogg","crunched":0,"start":22024045,"end":22042190,"audio":true},{"filename":"/resources/sounds/highlight1.ogg","crunched":0,"start":22042190,"end":22049377,"audio":true},{"filename":"/resources/sounds/highlight2.ogg","crunched":0,"start":22049377,"end":22062761,"audio":true},{"filename":"/resources/sounds/holo1.ogg","crunched":0,"start":22062761,"end":22075316,"audio":true},{"filename":"/resources/sounds/introPad1.ogg","crunched":0,"start":22075316,"end":22409334,"audio":true},{"filename":"/resources/sounds/magic_crumple.ogg","crunched":0,"start":22409334,"end":22495463,"audio":true},{"filename":"/resources/sounds/magic_crumple2.ogg","crunched":0,"start":22495463,"end":22530793,"audio":true},{"filename":"/resources/sounds/magic_crumple3.ogg","crunched":0,"start":22530793,"end":22555223,"audio":true},{"filename":"/resources/sounds/multhit1.ogg","crunched":0,"start":22555223,"end":22567305,"audio":true},{"filename":"/resources/sounds/multhit2.ogg","crunched":0,"start":22567305,"end":22582257,"audio":true},{"filename":"/resources/sounds/music1.ogg","crunched":0,"start":22582257,"end":25520999,"audio":true},{"filename":"/resources/sounds/music2.ogg","crunched":0,"start":25520999,"end":28136268,"audio":true},{"filename":"/resources/sounds/music3.ogg","crunched":0,"start":28136268,"end":30647326,"audio":true},{"filename":"/resources/sounds/music4.ogg","crunched":0,"start":30647326,"end":33455723,"audio":true},{"filename":"/resources/sounds/music5.ogg","crunched":0,"start":33455723,"end":36301551,"audio":true},{"filename":"/resources/sounds/negative.ogg","crunched":0,"start":36301551,"end":36314749,"audio":true},{"filename":"/resources/sounds/other1.ogg","crunched":0,"start":36314749,"end":36326897,"audio":true},{"filename":"/resources/sounds/paper1.ogg","crunched":0,"start":36326897,"end":36332169,"audio":true},{"filename":"/resources/sounds/polychrome1.ogg","crunched":0,"start":36332169,"end":36362190,"audio":true},{"filename":"/resources/sounds/slice1.ogg","crunched":0,"start":36362190,"end":36370687,"audio":true},{"filename":"/resources/sounds/splash_buildup.ogg","crunched":0,"start":36370687,"end":36710246,"audio":true},{"filename":"/resources/sounds/tarot1.ogg","crunched":0,"start":36710246,"end":36719367,"audio":true},{"filename":"/resources/sounds/tarot2.ogg","crunched":0,"start":36719367,"end":36730189,"audio":true},{"filename":"/resources/sounds/timpani.ogg","crunched":0,"start":36730189,"end":36744380,"audio":true},{"filename":"/resources/sounds/voice1.ogg","crunched":0,"start":36744380,"end":36751464,"audio":true},{"filename":"/resources/sounds/voice10.ogg","crunched":0,"start":36751464,"end":36758555,"audio":true},{"filename":"/resources/sounds/voice11.ogg","crunched":0,"start":36758555,"end":36765544,"audio":true},{"filename":"/resources/sounds/voice2.ogg","crunched":0,"start":36765544,"end":36772564,"audio":true},{"filename":"/resources/sounds/voice3.ogg","crunched":0,"start":36772564,"end":36779663,"audio":true},{"filename":"/resources/sounds/voice4.ogg","crunched":0,"start":36779663,"end":36787026,"audio":true},{"filename":"/resources/sounds/voice5.ogg","crunched":0,"start":36787026,"end":36794221,"audio":true},{"filename":"/resources/sounds/voice6.ogg","crunched":0,"start":36794221,"end":36801340,"audio":true},{"filename":"/resources/sounds/voice7.ogg","crunched":0,"start":36801340,"end":36808401,"audio":true},{"filename":"/resources/sounds/voice8.ogg","crunched":0,"start":36808401,"end":36815565,"audio":true},{"filename":"/resources/sounds/voice9.ogg","crunched":0,"start":36815565,"end":36822731,"audio":true},{"filename":"/resources/sounds/whoosh.ogg","crunched":0,"start":36822731,"end":36832643,"audio":true},{"filename":"/resources/sounds/whoosh1.ogg","crunched":0,"start":36832643,"end":36845545,"audio":true},{"filename":"/resources/sounds/whoosh2.ogg","crunched":0,"start":36845545,"end":36858393,"audio":true},{"filename":"/resources/sounds/whoosh_long.ogg","crunched":0,"start":36858393,"end":36972574,"audio":true},{"filename":"/resources/sounds/win.ogg","crunched":0,"start":36972574,"end":37009140,"audio":true},{"filename":"/resources/textures/1x/8BitDeck.png","crunched":0,"start":37009140,"end":37056018,"audio":false},{"filename":"/resources/textures/1x/8BitDeck_opt2.png","crunched":0,"start":37056018,"end":37118155,"audio":false},{"filename":"/resources/textures/1x/BlindChips.png","crunched":0,"start":37118155,"end":37201967,"audio":false},{"filename":"/resources/textures/1x/Enhancers.png","crunched":0,"start":37201967,"end":37277919,"audio":false},{"filename":"/resources/textures/1x/Jokers.png","crunched":0,"start":37277919,"end":37782606,"audio":false},{"filename":"/resources/textures/1x/ShopSignAnimation.png","crunched":0,"start":37782606,"end":37793404,"audio":false},{"filename":"/resources/textures/1x/Tarots.png","crunched":0,"start":37793404,"end":37889735,"audio":false},{"filename":"/resources/textures/1x/Vouchers.png","crunched":0,"start":37889735,"end":37960444,"audio":false},{"filename":"/resources/textures/1x/balatro.png","crunched":0,"start":37960444,"end":37987321,"audio":false},{"filename":"/resources/textures/1x/balatro_alt.png","crunched":0,"start":37987321,"end":38008147,"audio":false},{"filename":"/resources/textures/1x/boosters.png","crunched":0,"start":38008147,"end":38178765,"audio":false},{"filename":"/resources/textures/1x/chips.png","crunched":0,"start":38178765,"end":38187020,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AC_1.png","crunched":0,"start":38187020,"end":38195399,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AC_2.png","crunched":0,"start":38195399,"end":38203714,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AU_1.png","crunched":0,"start":38203714,"end":38208746,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AU_2.png","crunched":0,"start":38208746,"end":38216050,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_BUG_1.png","crunched":0,"start":38216050,"end":38227202,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_BUG_2.png","crunched":0,"start":38227202,"end":38239922,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_C7_1.png","crunched":0,"start":38239922,"end":38249725,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_C7_2.png","crunched":0,"start":38249725,"end":38259404,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CL_1.png","crunched":0,"start":38259404,"end":38265887,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CL_2.png","crunched":0,"start":38265887,"end":38274149,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CR_1.png","crunched":0,"start":38274149,"end":38282316,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CR_2.png","crunched":0,"start":38282316,"end":38291317,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CYP_1.png","crunched":0,"start":38291317,"end":38298581,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CYP_2.png","crunched":0,"start":38298581,"end":38305903,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_D2_1.png","crunched":0,"start":38305903,"end":38313617,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_D2_2.png","crunched":0,"start":38313617,"end":38322458,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DBD_1.png","crunched":0,"start":38322458,"end":38331145,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DBD_2.png","crunched":0,"start":38331145,"end":38340234,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DS_1.png","crunched":0,"start":38340234,"end":38348032,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DS_2.png","crunched":0,"start":38348032,"end":38355763,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DTD_1.png","crunched":0,"start":38355763,"end":38363197,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DTD_2.png","crunched":0,"start":38363197,"end":38369159,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_EG_1.png","crunched":0,"start":38369159,"end":38373892,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_EG_2.png","crunched":0,"start":38373892,"end":38379091,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_FO_1.png","crunched":0,"start":38379091,"end":38388336,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_FO_2.png","crunched":0,"start":38388336,"end":38397894,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_PC_1.png","crunched":0,"start":38397894,"end":38405564,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_PC_2.png","crunched":0,"start":38405564,"end":38413061,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_R_1.png","crunched":0,"start":38413061,"end":38424769,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_R_2.png","crunched":0,"start":38424769,"end":38437570,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SK_1.png","crunched":0,"start":38437570,"end":38449454,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SK_2.png","crunched":0,"start":38449454,"end":38461095,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STP_1.png","crunched":0,"start":38461095,"end":38469533,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STP_2.png","crunched":0,"start":38469533,"end":38477958,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STS_1.png","crunched":0,"start":38477958,"end":38487119,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STS_2.png","crunched":0,"start":38487119,"end":38497218,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SV_1.png","crunched":0,"start":38497218,"end":38505096,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SV_2.png","crunched":0,"start":38505096,"end":38513678,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TBoI_1.png","crunched":0,"start":38513678,"end":38521115,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TBoI_2.png","crunched":0,"start":38521115,"end":38528587,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TW_1.png","crunched":0,"start":38528587,"end":38536154,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TW_2.png","crunched":0,"start":38536154,"end":38543501,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_VS_1.png","crunched":0,"start":38543501,"end":38548493,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_VS_2.png","crunched":0,"start":38548493,"end":38556299,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_WF_1.png","crunched":0,"start":38556299,"end":38562929,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_WF_2.png","crunched":0,"start":38562929,"end":38570358,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_XR_1.png","crunched":0,"start":38570358,"end":38582504,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_XR_2.png","crunched":0,"start":38582504,"end":38593124,"audio":false},{"filename":"/resources/textures/1x/gamepad_ui.png","crunched":0,"start":38593124,"end":38613051,"audio":false},{"filename":"/resources/textures/1x/icons.png","crunched":0,"start":38613051,"end":38621607,"audio":false},{"filename":"/resources/textures/1x/localthunk-logo.png","crunched":0,"start":38621607,"end":38631234,"audio":false},{"filename":"/resources/textures/1x/playstack-logo.png","crunched":0,"start":38631234,"end":38703960,"audio":false},{"filename":"/resources/textures/1x/stickers.png","crunched":0,"start":38703960,"end":38708344,"audio":false},{"filename":"/resources/textures/1x/tags.png","crunched":0,"start":38708344,"end":38715679,"audio":false},{"filename":"/resources/textures/1x/ui_assets.png","crunched":0,"start":38715679,"end":38717147,"audio":false},{"filename":"/resources/textures/1x/ui_assets_opt2.png","crunched":0,"start":38717147,"end":38718599,"audio":false},{"filename":"/resources/textures/2x/8BitDeck.png","crunched":0,"start":38718599,"end":38782997,"audio":false},{"filename":"/resources/textures/2x/8BitDeck_opt2.png","crunched":0,"start":38782997,"end":38863567,"audio":false},{"filename":"/resources/textures/2x/BlindChips.png","crunched":0,"start":38863567,"end":38998073,"audio":false},{"filename":"/resources/textures/2x/Enhancers.png","crunched":0,"start":38998073,"end":39091958,"audio":false},{"filename":"/resources/textures/2x/Jokers.png","crunched":0,"start":39091958,"end":39704482,"audio":false},{"filename":"/resources/textures/2x/ShopSignAnimation.png","crunched":0,"start":39704482,"end":39720137,"audio":false},{"filename":"/resources/textures/2x/Tarots.png","crunched":0,"start":39720137,"end":39839799,"audio":false},{"filename":"/resources/textures/2x/Vouchers.png","crunched":0,"start":39839799,"end":39924400,"audio":false},{"filename":"/resources/textures/2x/balatro.png","crunched":0,"start":39924400,"end":39959734,"audio":false},{"filename":"/resources/textures/2x/balatro_alt.png","crunched":0,"start":39959734,"end":39986802,"audio":false},{"filename":"/resources/textures/2x/boosters.png","crunched":0,"start":39986802,"end":40198465,"audio":false},{"filename":"/resources/textures/2x/chips.png","crunched":0,"start":40198465,"end":40208347,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AC_1.png","crunched":0,"start":40208347,"end":40218252,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AC_2.png","crunched":0,"start":40218252,"end":40228120,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AU_1.png","crunched":0,"start":40228120,"end":40236094,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AU_2.png","crunched":0,"start":40236094,"end":40246389,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_BUG_1.png","crunched":0,"start":40246389,"end":40259787,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_BUG_2.png","crunched":0,"start":40259787,"end":40274517,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_C7_1.png","crunched":0,"start":40274517,"end":40286237,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_C7_2.png","crunched":0,"start":40286237,"end":40297969,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CL_1.png","crunched":0,"start":40297969,"end":40308462,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CL_2.png","crunched":0,"start":40308462,"end":40318228,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CR_1.png","crunched":0,"start":40318228,"end":40328079,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CR_2.png","crunched":0,"start":40328079,"end":40338819,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CYP_1.png","crunched":0,"start":40338819,"end":40350311,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CYP_2.png","crunched":0,"start":40350311,"end":40361877,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_D2_1.png","crunched":0,"start":40361877,"end":40372383,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_D2_2.png","crunched":0,"start":40372383,"end":40382952,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DBD_1.png","crunched":0,"start":40382952,"end":40393130,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DBD_2.png","crunched":0,"start":40393130,"end":40403874,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DS_1.png","crunched":0,"start":40403874,"end":40413498,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DS_2.png","crunched":0,"start":40413498,"end":40423083,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DTD_1.png","crunched":0,"start":40423083,"end":40432649,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DTD_2.png","crunched":0,"start":40432649,"end":40440066,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_EG_1.png","crunched":0,"start":40440066,"end":40445907,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_EG_2.png","crunched":0,"start":40445907,"end":40452305,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_FO_1.png","crunched":0,"start":40452305,"end":40463227,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_FO_2.png","crunched":0,"start":40463227,"end":40474508,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_PC_1.png","crunched":0,"start":40474508,"end":40483595,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_PC_2.png","crunched":0,"start":40483595,"end":40492630,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_R_1.png","crunched":0,"start":40492630,"end":40506444,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_R_2.png","crunched":0,"start":40506444,"end":40521502,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SK_1.png","crunched":0,"start":40521502,"end":40535226,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SK_2.png","crunched":0,"start":40535226,"end":40548615,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STP_1.png","crunched":0,"start":40548615,"end":40558657,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STP_2.png","crunched":0,"start":40558657,"end":40568655,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STS_1.png","crunched":0,"start":40568655,"end":40579714,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STS_2.png","crunched":0,"start":40579714,"end":40591868,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SV_1.png","crunched":0,"start":40591868,"end":40603481,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SV_2.png","crunched":0,"start":40603481,"end":40616078,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TBoI_1.png","crunched":0,"start":40616078,"end":40626802,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TBoI_2.png","crunched":0,"start":40626802,"end":40637525,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TW_1.png","crunched":0,"start":40637525,"end":40648752,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TW_2.png","crunched":0,"start":40648752,"end":40659678,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_VS_1.png","crunched":0,"start":40659678,"end":40667097,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_VS_2.png","crunched":0,"start":40667097,"end":40676363,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_WF_1.png","crunched":0,"start":40676363,"end":40687646,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_WF_2.png","crunched":0,"start":40687646,"end":40700408,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_XR_1.png","crunched":0,"start":40700408,"end":40714637,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_XR_2.png","crunched":0,"start":40714637,"end":40727529,"audio":false},{"filename":"/resources/textures/2x/gamepad_ui.png","crunched":0,"start":40727529,"end":40752394,"audio":false},{"filename":"/resources/textures/2x/icons.png","crunched":0,"start":40752394,"end":40763964,"audio":false},{"filename":"/resources/textures/2x/localthunk-logo.png","crunched":0,"start":40763964,"end":40784527,"audio":false},{"filename":"/resources/textures/2x/playstack-logo.png","crunched":0,"start":40784527,"end":40891915,"audio":false},{"filename":"/resources/textures/2x/stickers.png","crunched":0,"start":40891915,"end":40898653,"audio":false},{"filename":"/resources/textures/2x/tags.png","crunched":0,"start":40898653,"end":40909504,"audio":false},{"filename":"/resources/textures/2x/ui_assets.png","crunched":0,"start":40909504,"end":40911261,"audio":false},{"filename":"/resources/textures/2x/ui_assets_opt2.png","crunched":0,"start":40911261,"end":40913015,"audio":false},{"filename":"/tag.lua","crunched":0,"start":40913015,"end":40938154,"audio":false},{"filename":"/version.jkr","crunched":0,"start":40938154,"end":40938188,"audio":false}]});

})();

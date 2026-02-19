(function () {
    'use strict';

    if (window.__LuaToolsBootstrapLoaded) {
        return;
    }
    window.__LuaToolsBootstrapLoaded = true;

    function reportLoadError(error) {
        try {
            if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                Millennium.callServerMethod('luatools', 'Logger.error', { message: String(error) });
            }
        } catch (_) {
        }
        try {
            console.error('[LuaTools]', error);
        } catch (_) {
        }
    }

    function loadScriptSequential(paths, index) {
        if (!Array.isArray(paths) || index >= paths.length) {
            return Promise.resolve();
        }

        var path = paths[index];
        if (!path) {
            return loadScriptSequential(paths, index + 1);
        }

        if (document.querySelector('script[data-luatools-module="' + path + '"]')) {
            return loadScriptSequential(paths, index + 1);
        }

        return new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.async = false;
            script.defer = false;
            script.src = path;
            script.setAttribute('data-luatools-module', path);
            script.onload = function () { resolve(); };
            script.onerror = function () {
                reject(new Error('Failed to load LuaTools module: ' + path));
            };
            (document.head || document.documentElement || document.body).appendChild(script);
        }).then(function () {
            return loadScriptSequential(paths, index + 1);
        });
    }

    loadScriptSequential([
        'LuaTools/modules/luatools.app.js'
    ], 0).catch(reportLoadError);
})();

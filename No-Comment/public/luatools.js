(function () {
    'use strict';

    if (window.__NoCommentBootstrapLoaded) {
        return;
    }
    window.__NoCommentBootstrapLoaded = true;

    function reportLoadError(error) {
        try {
            if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                Millennium.callServerMethod('No-Comment', 'Logger.error', { message: String(error) });
            }
        } catch (_) {
        }
        try {
            console.error('[NoComment]', error);
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

        if (document.querySelector('script[data-NoComment-module="' + path + '"]')) {
            return loadScriptSequential(paths, index + 1);
        }

        return new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.async = false;
            script.defer = false;
            script.src = path;
            script.setAttribute('data-NoComment-module', path);
            script.onload = function () { resolve(); };
            script.onerror = function () {
                reject(new Error('Failed to load NoComment module: ' + path));
            };
            (document.head || document.documentElement || document.body).appendChild(script);
        }).then(function () {
            return loadScriptSequential(paths, index + 1);
        });
    }

    loadScriptSequential([
        'No-Comment/modules/NoComment.app.js'
    ], 0).catch(reportLoadError);
})();

    function ensureStyles() {
        if (!document.getElementById('NoComment-spacing-styles')) {
            const style = document.createElement('style');
            style.id = 'NoComment-spacing-styles';
            style.textContent = '.NoComment-button{ margin-left:6px !important; }';
            document.head.appendChild(style);
        }
    }

    function updateButtonTranslations() {
        try {
            const button = document.querySelector('.NoComment-button');
            if (button) {
                const addViaText = lt('Add via NoComment');
                button.title = addViaText;
                button.setAttribute('data-tooltip-text', addViaText);
                const span = button.querySelector('span');
                if (span) {
                    span.textContent = addViaText;
                }
            }
            if (typeof refreshStoreButtonTranslations === 'function') {
                refreshStoreButtonTranslations();
            }
        } catch (err) {
            backendLog('NoComment: updateButtonTranslations error: ' + err);
        }
    }

    function addNoCommentButton() {
        // Store pages are handled by the dedicated store button flow in 020_store_bundle_core.js.
        try {
            if (typeof isStoreGamePage === 'function' && isStoreGamePage()) {
                return;
            }
        } catch(_) {}

        const currentUrl = window.location.href;
        if (window.__NoCommentLastUrl !== currentUrl) {
            window.__NoCommentLastUrl = currentUrl;
            window.__NoCommentButtonInserted = false;
            window.__NoCommentPresenceCheckInFlight = false;
            window.__NoCommentPresenceCheckAppId = undefined;
            ensureTranslationsLoaded(false).then(function() {
                updateButtonTranslations();
            });
        }

        const steamdbContainer =
            document.querySelector('.steamdb-buttons') ||
            document.querySelector('[data-steamdb-buttons]') ||
            document.querySelector('.apphub_OtherSiteInfo');

        if (!steamdbContainer) {
            if (!logState.missingOnce) {
                backendLog('NoComment: steamdbContainer not found on this page');
                logState.missingOnce = true;
            }
            return;
        }

        const existingBtn =
            steamdbContainer.querySelector('.NoComment-button') ||
            document.querySelector('.NoComment-button');
        if (existingBtn || window.__NoCommentButtonInserted) {
            if (existingBtn) {
                ensureTranslationsLoaded(false).then(function() {
                    updateButtonTranslations();
                });
            }
            if (!logState.existsOnce) {
                backendLog('NoComment button already exists, skipping');
                logState.existsOnce = true;
            }
            return;
        }

        ensureStyles();
        const referenceBtn = steamdbContainer.querySelector('a');
        const button = document.createElement('a');
        button.href = '#';
        if (referenceBtn && referenceBtn.className) {
            button.className = referenceBtn.className + ' NoComment-button';
        } else {
            button.className = 'btnv6_blue_hoverfade btn_medium NoComment-button';
        }
        const span = document.createElement('span');
        const addViaText = lt('Add via NoComment');
        span.textContent = addViaText;
        button.appendChild(span);
        button.title = addViaText;
        button.setAttribute('data-tooltip-text', addViaText);
        button.addEventListener('click', function(e) {
            e.preventDefault();
            backendLog('NoComment button clicked (delegated handler will process)');
        });

        const placeButton = function() {
            if (document.querySelector('.NoComment-button') || window.__NoCommentButtonInserted) return;
            if (referenceBtn && referenceBtn.after) {
                referenceBtn.after(button);
            } else {
                steamdbContainer.appendChild(button);
            }
            window.__NoCommentButtonInserted = true;
            backendLog('NoComment button inserted');
        };

        try {
            const match =
                window.location.href.match(/https:\/\/store\.steampowered\.com\/app\/(\d+)/) ||
                window.location.href.match(/https:\/\/steamcommunity\.com\/app\/(\d+)/);
            const appid = match ? parseInt(match[1], 10) : NaN;
            if (isNaN(appid) || typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                placeButton();
                return;
            }

            if (window.__NoCommentPresenceCheckInFlight && window.__NoCommentPresenceCheckAppId === appid) {
                return;
            }
            window.__NoCommentPresenceCheckInFlight = true;
            window.__NoCommentPresenceCheckAppId = appid;
            window.__NoCommentCurrentAppId = appid;

            Millennium.callServerMethod('No-Comment', 'HasNoCommentForApp', { appid, contentScriptQuery: '' })
                .then(function(res) {
                    try {
                        const payload = typeof res === 'string' ? JSON.parse(res) : res;
                        const exists = payload && payload.success && payload.exists === true;
                        if (exists) {
                            backendLog('NoComment already present for this app; not inserting button');
                            return;
                        }
                    } catch(_) {}
                    placeButton();
                })
                .catch(function() {
                    placeButton();
                })
                .finally(function() {
                    window.__NoCommentPresenceCheckInFlight = false;
                });
        } catch(_) {
            window.__NoCommentPresenceCheckInFlight = false;
            placeButton();
        }
    }
    
    

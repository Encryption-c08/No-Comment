    function ensureStyles() {
        if (!document.getElementById('NoComment-spacing-styles')) {
            const style = document.createElement('style');
            style.id = 'NoComment-spacing-styles';
            style.textContent = '.NoComment-button{ margin-left:6px !important; } .NoComment-copy-steamid-button{ margin-left:6px !important; }';
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
            const copyBtn = document.querySelector('.NoComment-copy-steamid-button');
            if (copyBtn) {
                const copySteamIdText = t('profile.copySteamId', 'Copy SteamID');
                copyBtn.title = copySteamIdText;
                copyBtn.setAttribute('data-tooltip-text', copySteamIdText);
                const copySpan = copyBtn.querySelector('span');
                if (copySpan) {
                    copySpan.textContent = copySteamIdText;
                } else {
                    copyBtn.textContent = copySteamIdText;
                }
            }
            if (typeof refreshStoreButtonTranslations === 'function') {
                refreshStoreButtonTranslations();
            }
        } catch (err) {
            backendLog('NoComment: updateButtonTranslations error: ' + err);
        }
    }

    function isSteamCommunityProfilePage() {
        try {
            const host = String(window.location.hostname || '').toLowerCase();
            if (host !== 'steamcommunity.com') return false;
            const pathname = String(window.location.pathname || '');
            return /^\/(id|profiles)\/[^\/?#]+/i.test(pathname);
        } catch(_) {
            return false;
        }
    }

    function normalizeSteamId64(raw) {
        const value = String(raw || '').trim();
        if (/^\d{17}$/.test(value)) return value;
        return '';
    }

    function extractSteamId64FromUrl(rawUrl) {
        try {
            const value = String(rawUrl || '');
            const match = value.match(/(?:https?:\/\/)?steamcommunity\.com\/profiles\/(\d{17})(?:[/?#]|$)/i) ||
                value.match(/\/profiles\/(\d{17})(?:[/?#]|$)/i);
            return match ? normalizeSteamId64(match[1]) : '';
        } catch(_) {
            return '';
        }
    }

    function accountIdToSteamId64(rawAccountId) {
        try {
            const value = String(rawAccountId || '').trim();
            if (!/^\d+$/.test(value)) return '';
            if (/^\d{17}$/.test(value)) return value;
            if (typeof BigInt === 'undefined') return '';
            const accountId = BigInt(value);
            if (accountId <= 0n) return '';
            const base = BigInt('76561197960265728');
            return String(base + accountId);
        } catch(_) {
            return '';
        }
    }

    function parseSteamId64FromXmlText(xmlText) {
        try {
            const text = String(xmlText || '');
            const match = text.match(/<steamID64>\s*(\d{17})\s*<\/steamID64>/i);
            return match ? normalizeSteamId64(match[1]) : '';
        } catch(_) {
            return '';
        }
    }

    function fetchCurrentProfileSteamId64FromXml() {
        try {
            if (typeof fetch !== 'function') {
                return Promise.resolve('');
            }
            const url = new URL(window.location.href);
            url.searchParams.set('xml', '1');
            return fetch(url.toString(), {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store'
            }).then(function(resp) {
                if (!resp || !resp.ok) return '';
                return resp.text().then(function(text) {
                    return parseSteamId64FromXmlText(text);
                }).catch(function() {
                    return '';
                });
            }).catch(function() {
                return '';
            });
        } catch(_) {
            return Promise.resolve('');
        }
    }

    function resolveCurrentProfileSteamId64() {
        try {
            const pathMatch = String(window.location.pathname || '').match(/\/profiles\/(\d{17})(?:[/?#]|$)/i);
            if (pathMatch && pathMatch[1]) {
                const fromPath = normalizeSteamId64(pathMatch[1]);
                if (fromPath) return fromPath;
            }
        } catch(_) {}

        try {
            const fromProfileData = normalizeSteamId64(window.g_rgProfileData && window.g_rgProfileData.steamid);
            if (fromProfileData) return fromProfileData;
        } catch(_) {}

        try {
            const scripts = document.querySelectorAll('script');
            for (let i = 0; i < scripts.length; i++) {
                const content = String((scripts[i] && scripts[i].textContent) || '');
                if (!content || content.indexOf('g_rgProfileData') < 0) continue;
                const match = content.match(/g_rgProfileData\s*=\s*\{[\s\S]*?"steamid"\s*:\s*"(\d{17})"/i);
                if (match && match[1]) {
                    const parsed = normalizeSteamId64(match[1]);
                    if (parsed) return parsed;
                }
            }
        } catch(_) {}

        try {
            const profileRoot =
                document.querySelector('.profile_page') ||
                document.querySelector('.profile_content') ||
                document.querySelector('.profile_header');
            if (profileRoot) {
                const scopedAnchors = profileRoot.querySelectorAll('a[href*="/profiles/"]');
                for (let i = 0; i < scopedAnchors.length; i++) {
                    const href = scopedAnchors[i] ? scopedAnchors[i].getAttribute('href') : '';
                    const fromHref = extractSteamId64FromUrl(href);
                    if (fromHref) return fromHref;
                }

                const scopedMiniNodes = profileRoot.querySelectorAll('[data-miniprofile]');
                for (let i = 0; i < scopedMiniNodes.length; i++) {
                    const miniValue = String(scopedMiniNodes[i].getAttribute('data-miniprofile') || '').trim();
                    const fromMini = accountIdToSteamId64(miniValue);
                    if (fromMini) return fromMini;
                }
            }
        } catch(_) {}

        try {
            const canonical = document.querySelector('link[rel="canonical"]');
            const fromCanonical = extractSteamId64FromUrl(canonical ? canonical.getAttribute('href') : '');
            if (fromCanonical) return fromCanonical;
        } catch(_) {}

        try {
            const ogUrl = document.querySelector('meta[property="og:url"]');
            const fromOg = extractSteamId64FromUrl(ogUrl ? ogUrl.getAttribute('content') : '');
            if (fromOg) return fromOg;
        } catch(_) {}

        return '';
    }

    function resolveCurrentProfileSteamId64Async() {
        const fromPage = resolveCurrentProfileSteamId64();
        if (fromPage) return Promise.resolve(fromPage);
        return fetchCurrentProfileSteamId64FromXml().then(function(fromXml) {
            return fromXml || '';
        }).catch(function() {
            return '';
        });
    }

    function copyTextLegacy(text) {
        try {
            const area = document.createElement('textarea');
            area.value = String(text || '');
            area.setAttribute('readonly', 'readonly');
            area.style.position = 'fixed';
            area.style.left = '-9999px';
            area.style.top = '0';
            document.body.appendChild(area);
            area.focus();
            area.select();
            const copied = !!document.execCommand('copy');
            document.body.removeChild(area);
            return copied;
        } catch(_) {
            return false;
        }
    }

    function copyTextToClipboard(text) {
        const value = String(text || '');
        if (!value) return Promise.resolve(false);
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                return navigator.clipboard.writeText(value).then(function() {
                    return true;
                }).catch(function() {
                    return copyTextLegacy(value);
                });
            }
        } catch(_) {}
        return Promise.resolve(copyTextLegacy(value));
    }

    function addProfileSteamIdCopyButton() {
        if (!isSteamCommunityProfilePage()) return;

        const actionsContainer =
            document.querySelector('.profile_header_actions') ||
            document.querySelector('.profile_header .profile_header_actions') ||
            document.querySelector('.profile_header_actions_logged_in');
        if (!actionsContainer) return;

        const existing = actionsContainer.querySelector('.NoComment-copy-steamid-button');
        if (existing) {
            updateButtonTranslations();
            return;
        }

        ensureStyles();

        const referenceBtn = actionsContainer.querySelector('a.btn_profile_action');
        const button = document.createElement('a');
        button.href = '#';
        if (referenceBtn && referenceBtn.className) {
            button.className = referenceBtn.className + ' NoComment-copy-steamid-button';
        } else {
            button.className = 'btn_profile_action btn_medium NoComment-copy-steamid-button';
        }

        const span = document.createElement('span');
        const label = t('profile.copySteamId', 'Copy SteamID');
        span.textContent = label;
        button.appendChild(span);
        button.title = label;
        button.setAttribute('data-tooltip-text', label);

        button.addEventListener('click', function(e) {
            e.preventDefault();
            resolveCurrentProfileSteamId64Async().then(function(steamId64) {
                if (!steamId64) {
                    if (typeof ShowNoCommentAlert === 'function') {
                        ShowNoCommentAlert('No-Comment', t('profile.copySteamIdNotFound', 'Could not resolve this profile SteamID.'));
                    }
                    return;
                }

                copyTextToClipboard(steamId64).then(function(copied) {
                    if (typeof ShowNoCommentAlert !== 'function') return;
                    if (!copied) {
                        ShowNoCommentAlert('No-Comment', t('profile.copySteamIdCopyFailed', 'Unable to copy SteamID to clipboard.'));
                        return;
                    }
                    const template = t('profile.copySteamIdSuccess', 'Copied SteamID: {steamid}');
                    const msg = template.indexOf('{steamid}') >= 0
                        ? template.replace('{steamid}', steamId64)
                        : (template + ' ' + steamId64);
                    ShowNoCommentAlert('No-Comment', msg);
                }).catch(function() {
                    if (typeof ShowNoCommentAlert === 'function') {
                        ShowNoCommentAlert('No-Comment', t('profile.copySteamIdCopyFailed', 'Unable to copy SteamID to clipboard.'));
                    }
                });
            }).catch(function() {
                if (typeof ShowNoCommentAlert === 'function') {
                    ShowNoCommentAlert('No-Comment', t('profile.copySteamIdNotFound', 'Could not resolve this profile SteamID.'));
                }
            });
        });

        actionsContainer.appendChild(button);
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

        if (isSteamCommunityProfilePage()) {
            addProfileSteamIdCopyButton();
            return;
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
    
    

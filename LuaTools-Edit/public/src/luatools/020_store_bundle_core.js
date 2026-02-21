    function ensureTranslationsLoaded(forceRefresh, preferredLanguage) {
        try {
            if (!forceRefresh && window.__LuaToolsI18n && window.__LuaToolsI18n.ready) {
                return Promise.resolve(window.__LuaToolsI18n);
            }
            if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                window.__LuaToolsI18n = window.__LuaToolsI18n || { language: 'en', locales: [], strings: {}, ready: false };
                return Promise.resolve(window.__LuaToolsI18n);
            }
            const targetLanguage = (typeof preferredLanguage === 'string' && preferredLanguage) ? preferredLanguage :
                ((window.__LuaToolsI18n && window.__LuaToolsI18n.language) || '');
            return Millennium.callServerMethod('luatools', 'GetTranslations', { language: targetLanguage, contentScriptQuery: '' }).then(function(res){
                const payload = typeof res === 'string' ? JSON.parse(res) : res;
                if (!payload || payload.success !== true || !payload.strings) {
                    throw new Error('Invalid translation payload');
                }
                applyTranslationBundle(payload);
                
                updateButtonTranslations();
                return window.__LuaToolsI18n;
            }).catch(function(err){
                backendLog('LuaTools: translation load failed: ' + err);
                window.__LuaToolsI18n = window.__LuaToolsI18n || { language: 'en', locales: [], strings: {}, ready: false };
                return window.__LuaToolsI18n;
            });
        } catch(err) {
            backendLog('LuaTools: ensureTranslationsLoaded error: ' + err);
            window.__LuaToolsI18n = window.__LuaToolsI18n || { language: 'en', locales: [], strings: {}, ready: false };
            return Promise.resolve(window.__LuaToolsI18n);
        }
    }

    function translateText(key, fallback) {
        if (!key) {
            return typeof fallback !== 'undefined' ? fallback : '';
        }
        try {
            const store = window.__LuaToolsI18n;
            if (store && store.strings && Object.prototype.hasOwnProperty.call(store.strings, key)) {
                const value = store.strings[key];
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    if (trimmed && trimmed.toLowerCase() !== TRANSLATION_PLACEHOLDER) {
                        return value;
                    }
                }
            }
        } catch(_) {}
        return typeof fallback !== 'undefined' ? fallback : key;
    }

    function t(key, fallback) {
        return translateText(key, fallback);
    }

    function lt(text) {
        return t(text, text);
    }

    function openExternalUrl(url) {
        try {
            if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                Millennium.callServerMethod('luatools', 'OpenExternalUrl', { url, contentScriptQuery: '' });
                return;
            }
        } catch(_) {}
        try { window.open(url, '_blank'); } catch(_) {}
    }

    function openSteamStore(appid) {
        const uri = 'steam://store/' + String(appid);
        try {
            if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                Millennium.callServerMethod('luatools', 'OpenSteamUri', { uri, contentScriptQuery: '' });
                return;
            }
        } catch(_) {}
        try { window.location.href = uri; } catch(_) {}
    }

    function openSteamDbSearch(query) {
        openExternalUrl('https://steamdb.info/search/?a=app&q=' + encodeURIComponent(query));
    }

    function openSteamDbApp(appid) {
        openExternalUrl('https://steamdb.info/app/' + String(appid) + '/');
    }

    function parseSuggestResults(htmlText) {
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        const anchors = Array.from(doc.querySelectorAll('a.match'));
        const results = [];
        const seen = new Set();
        for (const a of anchors) {
            let appid = a.getAttribute('data-ds-appid') || (a.dataset ? a.dataset.dsAppid : '') || '';
            appid = (appid.split(',')[0] || '').trim();
            if (!appid) {
                const href = a.getAttribute('href') || '';
                const m = href.match(/\/app\/(\d+)/);
                if (m) appid = m[1];
            }
            if (!appid || seen.has(appid)) continue;
            const nameEl = a.querySelector('.match_name');
            const name = (nameEl?.textContent || a.textContent || ('App ' + appid)).trim();
            results.push({ appid, name });
            seen.add(appid);
        }
        return results;
    }

    async function fetchSteamSearch(term) {
        const url = 'https://store.steampowered.com/search/suggest?term=' + encodeURIComponent(term) + '&f=games&cc=US&l=english&v=1';
        const res = await fetch(url, { credentials: 'omit' });
        if (!res.ok) throw new Error('Search failed: ' + res.status);
        const html = await res.text();
        return parseSuggestResults(html);
    }

    function getAppDetailsCache() {
        if (!window.__LuaToolsAppDetailsCache) {
            window.__LuaToolsAppDetailsCache = {};
        }
        return window.__LuaToolsAppDetailsCache;
    }

    function getBundleLookupCache() {
        if (!window.__LuaToolsBundleLookupCache) {
            window.__LuaToolsBundleLookupCache = {};
        }
        return window.__LuaToolsBundleLookupCache;
    }

    async function primeAppDetailsCache(appids) {
        const ids = Array.from(new Set((appids || []).map(function(v){ return String(v).trim(); }))).filter(function(id){ return /^\d+$/.test(id); });
        if (!ids.length) return;
        const cache = getAppDetailsCache();
        const missing = ids.filter(function(id){ return !cache[id]; });
        if (!missing.length) return;

        const chunkSize = 40;
        for (let i = 0; i < missing.length; i += chunkSize) {
            const chunk = missing.slice(i, i + chunkSize);
            try {
                const url = 'https://store.steampowered.com/api/appdetails?appids=' + encodeURIComponent(chunk.join(',')) + '&l=english';
                const res = await fetch(url, { credentials: 'omit' });
                if (!res.ok) throw new Error('App batch lookup failed: ' + res.status);
                const data = await res.json();
                for (let j = 0; j < chunk.length; j++) {
                    const id = chunk[j];
                    const entry = data && data[id];
                    const fullgame = (entry && entry.success && entry.data && entry.data.fullgame) ? entry.data.fullgame : null;
                    cache[id] = (entry && entry.success && entry.data) ? {
                        name: entry.data.name || '',
                        type: entry.data.type || '',
                        fullgameAppid: fullgame && fullgame.appid ? String(fullgame.appid) : '',
                        fullgameName: fullgame && fullgame.name ? String(fullgame.name) : '',
                        success: true
                    } : { name: '', type: '', fullgameAppid: '', fullgameName: '', success: false };
                }
            } catch(_) {
                for (let j = 0; j < chunk.length; j++) {
                    try { await fetchAppDetailsById(chunk[j]); } catch(_) {}
                }
            }
        }
    }

    async function fetchAppDetailsById(appid) {
        const cache = getAppDetailsCache();
        const key = String(appid);
        if (cache[key]) return cache[key];
        const url = 'https://store.steampowered.com/api/appdetails?appids=' + encodeURIComponent(appid) + '&l=english';
        const res = await fetch(url, { credentials: 'omit' });
        if (!res.ok) throw new Error('App lookup failed: ' + res.status);
        const data = await res.json();
        const entry = data && data[key];
        const fullgame = (entry && entry.success && entry.data && entry.data.fullgame) ? entry.data.fullgame : null;
        const details = (entry && entry.success && entry.data) ? {
            name: entry.data.name || '',
            type: entry.data.type || '',
            fullgameAppid: fullgame && fullgame.appid ? String(fullgame.appid) : '',
            fullgameName: fullgame && fullgame.name ? String(fullgame.name) : '',
            success: true
        } : { name: '', type: '', fullgameAppid: '', fullgameName: '', success: false };
        cache[key] = details;
        return details;
    }

    async function fetchAppNameById(appid) {
        const details = await fetchAppDetailsById(appid);
        if (details && details.name) return details.name;
        return null;
    }

    async function fetchSteamGameName(appid) {
        if (!appid) return null;
        try {
            return await fetchAppNameById(appid);
        } catch(err) {
            backendLog('LuaTools: fetchSteamGameName error for ' + appid + ': ' + err);
            return null;
        }
    }

    async function getDlcBaseGameInfo(appid) {
        try {
            const details = await fetchAppDetailsById(appid);
            const type = details && details.type ? String(details.type).toLowerCase() : '';
            if (type !== 'dlc') return null;
            const fullgameAppid = details && details.fullgameAppid ? String(details.fullgameAppid).trim() : '';
            if (!/^\d+$/.test(fullgameAppid)) return null;
            let fullgameName = details && details.fullgameName ? String(details.fullgameName) : '';
            if (!fullgameName) {
                fullgameName = await fetchSteamGameName(fullgameAppid) || '';
            }
            return {
                fullgameAppid: fullgameAppid,
                fullgameName: fullgameName
            };
        } catch(_) {
            return null;
        }
    }

    async function startAddViaLuaToolsFlow(appid, options) {
        const parsedAppId = parseInt(appid, 10);
        if (isNaN(parsedAppId)) return false;
        if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
            return false;
        }

        const opts = (options && typeof options === 'object') ? options : {};
        const shouldShowOverlay = opts.showOverlay !== false;

        try {
            const dlcInfo = await getDlcBaseGameInfo(parsedAppId);
            if (dlcInfo && dlcInfo.fullgameAppid) {
                if (typeof showDlcWarning === 'function') {
                    showDlcWarning(parsedAppId, dlcInfo.fullgameAppid, dlcInfo.fullgameName);
                } else {
                    ShowLuaToolsAlert('LuaTools', lt('DLCs are added together with the base game. To add fixes for this DLC, please go to the base game page: <br><br><b>{gameName}</b>').replace('{gameName}', dlcInfo.fullgameName || lt('Base Game')));
                }
                return false;
            }
        } catch(_) {}

        if (runState.inProgress && runState.appid === parsedAppId) {
            backendLog('LuaTools: operation already in progress for this appid');
            return false;
        }

        if (shouldShowOverlay && !document.querySelector('.luatools-overlay')) {
            showTestPopup();
        }

        runState.inProgress = true;
        runState.appid = parsedAppId;
        window.__LuaToolsCurrentAppId = parsedAppId;

        try {
            Millennium.callServerMethod('luatools', 'StartAddViaLuaTools', { appid: parsedAppId, contentScriptQuery: '' });
            startPolling(parsedAppId);
            return true;
        } catch(err) {
            backendLog('LuaTools: start add flow error: ' + err);
            runState.inProgress = false;
            runState.appid = null;
            return false;
        }
    }

    function isSteamStoreHost() {
        const host = String(window.location.hostname || '').toLowerCase();
        return host === 'store.steampowered.com';
    }

    function getStoreAppIdFromPath() {
        if (!isSteamStoreHost()) return null;
        const pathname = String(window.location.pathname || '');
        const direct = pathname.match(/\/app\/(\d+)/i);
        if (direct) return parseInt(direct[1], 10);
        const agecheck = pathname.match(/\/agecheck\/app\/(\d+)/i);
        if (agecheck) return parseInt(agecheck[1], 10);
        return null;
    }

    function isStoreGamePage() {
        return getStoreAppIdFromPath() !== null;
    }

    function getCurrentAppId() {
        const appIdFromPath = getStoreAppIdFromPath();
        if (typeof appIdFromPath === 'number' && !isNaN(appIdFromPath)) {
            return appIdFromPath;
        }
        if (!isSteamStoreHost()) return null;
        const pathname = String(window.location.pathname || '');
        if (!/\/app\//i.test(pathname) && !/\/agecheck\/app\//i.test(pathname)) return null;
        const d = document.querySelector('[data-appid]');
        if (d) {
            const parsed = parseInt(d.getAttribute('data-appid'), 10);
            if (!isNaN(parsed)) return parsed;
        }
        return null;
    }

    function getBundlePageId() {
        if (!isSteamStoreHost()) return null;
        const pathname = String(window.location.pathname || '');
        const direct = pathname.match(/\/bundle\/(\d+)/i);
        if (direct) return direct[1];
        const agecheck = pathname.match(/\/agecheck\/bundle\/(\d+)/i);
        if (agecheck) return agecheck[1];
        return null;
    }

    function isBundlePage() {
        return !!getBundlePageId();
    }

    async function fetchBundlePayloadById(bundleId) {
        const key = String(bundleId || '').trim();
        if (!/^\d+$/.test(key)) return null;
        const cache = getBundleLookupCache();
        if (cache[key] && cache[key].payload) return cache[key].payload;

        const url = 'https://store.steampowered.com/actions/ajaxresolvebundles?bundleids=' + encodeURIComponent(key) + '&cc=us&l=english';
        const res = await fetch(url, { credentials: 'omit' });
        if (!res.ok) throw new Error('Bundle lookup failed: ' + res.status);
        const data = await res.json();
        const payload = Array.isArray(data) && data.length ? data[0] : null;
        cache[key] = { payload: payload || null, fetchedAt: Date.now() };
        return payload || null;
    }

    async function fetchBundleAppIdsById(bundleId) {
        try {
            const payload = await fetchBundlePayloadById(bundleId);
            const values = payload && Array.isArray(payload.appids) ? payload.appids : [];
            return Array.from(new Set(values.map(function(v){ return String(v).trim(); }).filter(function(v){ return /^\d+$/.test(v); })));
        } catch(_) {
            return [];
        }
    }

    function getBundleRoot() {
        return document.querySelector('.bundle_page') ||
            document.querySelector('.bundle_page_wrapper') ||
            document.querySelector('.bundle_page_inner') ||
            document.querySelector('.bundle_purchase_area') ||
            document.querySelector('.bundle_items') ||
            document.querySelector('.bundle_package_list') ||
            document.querySelector('.bundle_purchase_section') ||
            document.body;
    }

    function extractAppIdFromHref(href) {
        if (!href) return null;
        const m = String(href).match(/\/app\/(\d+)/);
        if (m) return m[1];
        return null;
    }

    function getBundleAppIds() {
        if (!isBundlePage()) return [];
        const root = getBundleRoot();
        const ids = new Set();

        const bundleNodes = root ? root.querySelectorAll('[data-ds-bundle-data]') : [];
        for (let i = 0; i < bundleNodes.length; i++) {
            const raw = bundleNodes[i].getAttribute('data-ds-bundle-data');
            if (!raw) continue;
            let payload = null;
            try {
                payload = JSON.parse(raw);
            } catch(_) {
                try {
                    payload = JSON.parse(raw.replace(/&quot;/g, '"'));
                } catch(_) {
                    payload = null;
                }
            }
            const items = payload && Array.isArray(payload.m_rgItems) ? payload.m_rgItems : [];
            for (let j = 0; j < items.length; j++) {
                const included = items[j] && Array.isArray(items[j].m_rgIncludedAppIDs) ? items[j].m_rgIncludedAppIDs : [];
                for (let k = 0; k < included.length; k++) {
                    const id = String(included[k]).trim();
                    if (/^\d+$/.test(id)) ids.add(id);
                }
            }
        }

        const nodes = root ? root.querySelectorAll('.bundle_package_item [data-ds-appid], .bundle_package_item [data-appid], .bundle_package_item [data-ds-itemkey], [data-ds-bundleid] [data-ds-appid], [data-ds-bundleid] [data-appid], [data-ds-bundleid] [data-ds-itemkey]') : [];
        for (let i = 0; i < nodes.length; i++) {
            const el = nodes[i];
            const raw = (el.getAttribute('data-ds-appid') || el.getAttribute('data-appid') || '').split(',')[0].trim();
            if (/^\d+$/.test(raw)) ids.add(raw);
            const itemKey = (el.getAttribute('data-ds-itemkey') || '').trim();
            const keyMatch = itemKey.match(/^App_(\d+)$/i);
            if (keyMatch) ids.add(keyMatch[1]);
        }

        const links = root ? root.querySelectorAll('.bundle_package_item a[href*="/app/"], [data-ds-bundleid] a[href*="/app/"]') : [];
        for (let i = 0; i < links.length; i++) {
            const id = extractAppIdFromHref(links[i].getAttribute('href'));
            if (id && /^\d+$/.test(id)) ids.add(id);
        }
        return Array.from(ids);
    }

    async function getBundleCandidateAppIds() {
        if (!isBundlePage()) return [];
        const bundleId = getBundlePageId();
        let ids = [];
        if (bundleId) {
            ids = await fetchBundleAppIdsById(bundleId);
        }
        if (!ids.length) {
            ids = getBundleAppIds();
        }
        return Array.from(new Set(ids.map(function(v){ return String(v).trim(); }).filter(function(v){ return /^\d+$/.test(v); })));
    }

    async function getBundleBaseGameApps(rawIds) {
        const uniqueIds = Array.from(new Set(rawIds || [])).filter(function(id){ return /^\d+$/.test(String(id)); }).map(function(id){ return String(id); });
        if (!uniqueIds.length) return [];
        await primeAppDetailsCache(uniqueIds);
        const games = [];
        for (let i = 0; i < uniqueIds.length; i++) {
            const appid = uniqueIds[i];
            try {
                const details = await fetchAppDetailsById(appid);
                const type = details && details.type ? String(details.type).toLowerCase() : '';
                if (type !== 'game') {
                    continue;
                }
                const name = (details && details.name) ? details.name : ('App ' + appid);
                games.push({ appid: appid, name: name });
            } catch(_) {}
        }
        return games;
    }

    async function hasLuaToolsForApp(appid) {
        try {
            if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                return false;
            }
            const res = await Millennium.callServerMethod('luatools', 'HasLuaToolsForApp', { appid, contentScriptQuery: '' });
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            return !!(payload && payload.success && payload.exists === true);
        } catch(_) {
            return false;
        }
    }

    function getGameName() {
        const el = document.querySelector('.apphub_AppName') ||
            document.querySelector('.pageheader .breadcrumbs h1') ||
            document.querySelector('h1') || document.querySelector('title');
        if (!el) return 'This game';
        let name = el.textContent || el.innerText || '';
        return (name.replace(/\s+on\s+Steam$/i, '').trim()) || 'This game';
    }

    function setSteamTooltip(el, text) {
        try {
            el.setAttribute('data-tooltip-text', text);
            el.title = text;
            el.setAttribute('data-panel-tooltip', text);
        } catch(_) {}
    }

    function getPurchaseContainer() {
        const container =
            document.querySelector('.bundle_purchase_action_bg') ||
            document.querySelector('.bundle_purchase_action') ||
            document.querySelector('.bundle_purchase_action_bg .btn_addtocart')?.parentElement ||
            document.querySelector('.bundle_purchase_action .btn_addtocart')?.parentElement ||
            document.querySelector('.game_area_purchase_game_wrapper .game_purchase_action_bg') ||
            document.querySelector('.game_area_purchase_game:not(.demo_above_purchase) .game_purchase_action_bg') ||
            document.querySelector('.game_area_purchase_game:not(.demo_above_purchase) .game_purchase_action') ||
            document.querySelector('.game_area_purchase_game:not(.demo_above_purchase) .btn_addtocart')?.parentElement ||
            document.querySelector('.game_area_purchase_game_wrapper') ||
            document.querySelector('.game_purchase_action_bg') ||
            document.querySelector('.game_purchase_action') ||
            document.querySelector('.btn_addtocart')?.parentElement ||
            document.querySelector('[class*="purchase"]');
        if (container) return container;
        return null;
    }

    function createInLibraryBanner(gameName) {
        const banner = document.createElement('div');
        banner.className = 'game_area_already_owned page_content';
        banner.id = 'luatools-in-library-banner';
        const ctn = document.createElement('div');
        ctn.className = 'game_area_already_owned_ctn';
        const flag = document.createElement('div');
        flag.className = 'ds_owned_flag ds_flag';
        flag.innerHTML = 'IN LIBRARY&nbsp;&nbsp;';
        const msg = document.createElement('div');
        msg.className = 'already_in_library';
        msg.textContent = gameName + ' is already in your Steam library';
        ctn.appendChild(flag);
        ctn.appendChild(msg);
        banner.appendChild(ctn);
        return banner;
    }

    function addInLibraryFlag(section) {
        if (section && !section.querySelector('.package_in_library_flag')) {
            const flag = document.createElement('div');
            flag.className = 'package_in_library_flag in_own_library';
            flag.setAttribute('data-luatools', '1');
            flag.innerHTML = '<span class="icon">☰</span> <span>In library</span>';
            section.insertBefore(flag, section.firstChild);
        }
    }

    function removeLuaToolsLibraryBanners() {
        const banner = document.querySelector('#luatools-in-library-banner');
        if (banner && banner.parentElement) {
            banner.parentElement.removeChild(banner);
        }
        document.querySelectorAll('.package_in_library_flag[data-luatools="1"]').forEach(function(flag) {
            try { flag.remove(); } catch(_) {}
        });
    }

    function clearStoreUiForNonStorePage() {
        document.querySelectorAll('.luatools-store-button-container').forEach(function(btn) {
            try { btn.remove(); } catch(_) {}
        });
        removeLuaToolsLibraryBanners();
    }

    function showLibraryBanners() {
        if (!isStoreGamePage()) return;
        if (document.querySelector('#luatools-in-library-banner')) return;
        const gameName = getGameName();
        const queue = document.querySelector('#queueActionsCtn');
        if (queue) queue.insertAdjacentElement('afterend', createInLibraryBanner(gameName));
        const btn = document.querySelector('.luatools-store-button-container');
        const sec = (btn ? btn.closest('.game_area_purchase_game') : null) || document.querySelector('.game_area_purchase_game');
        if (sec && !sec.classList.contains('demo_above_purchase')) addInLibraryFlag(sec);
    }

    function createStoreAddButton(appId) {
        if (!isStoreGamePage()) return;
        if (document.querySelector('.luatools-store-button-container')) return;
        const container = getPurchaseContainer();
        if (!container) { return; }

        const btnContainer = document.createElement('div');
        btnContainer.className = 'btn_addtocart btn_packageinfo luatools-store-button-container luatools-store-add';

        const button = document.createElement('span');
        button.setAttribute('data-panel', '{"focusable":true,"clickOnActivate":true}');
        button.setAttribute('role', 'button');
        button.className = 'btn_blue_steamui btn_medium';
        button.style.marginLeft = '2px';

        const buttonSpan = document.createElement('span');
        const addText = lt('Add via LuaTools');
        buttonSpan.textContent = addText;
        button.appendChild(buttonSpan);
        btnContainer.appendChild(button);

        setSteamTooltip(button, addText);

        button.onclick = async function() {
            if (runState.inProgress) return;
            button.style.pointerEvents = 'none';
            buttonSpan.textContent = lt('Working…');
            button.style.opacity = '0.7';
            const started = await startAddViaLuaToolsFlow(appId, { showOverlay: true });
            if (!started) {
                button.style.pointerEvents = '';
                buttonSpan.textContent = addText;
                button.style.opacity = '';
            }
        };

        container.appendChild(btnContainer);
    }

    async function collectBundleAppsForInstall() {
        const bundleIds = await getBundleCandidateAppIds();
        const baseGames = await getBundleBaseGameApps(bundleIds);
        if (baseGames.length < 2) {
            return [];
        }
        const apps = [];
        for (let i = 0; i < baseGames.length; i++) {
            const entry = baseGames[i];
            const appid = entry.appid;
            try {
                const exists = await hasLuaToolsForApp(parseInt(appid, 10));
                if (exists) continue;
            } catch(_) {}
            apps.push({ appid: appid, name: entry.name || ('App ' + appid) });
        }
        return apps;
    }

    function updateBundleOverlay(overlay, titleText, statusText, percentValue) {
        if (!overlay) return;
        const title = overlay.querySelector('.luatools-title');
        const status = overlay.querySelector('.luatools-status');
        const wrap = overlay.querySelector('.luatools-progress-wrap');
        const percent = overlay.querySelector('.luatools-percent');
        const bar = overlay.querySelector('.luatools-progress-bar');
        if (title && titleText) title.textContent = titleText;
        if (status && statusText) status.textContent = statusText;
        if (wrap) wrap.style.display = '';
        if (percent) percent.style.display = '';
        if (typeof percentValue === 'number') {
            const pct = Math.max(0, Math.min(100, Math.floor(percentValue)));
            if (bar) bar.style.width = pct + '%';
            if (percent) percent.textContent = pct + '%';
        }
    }

    function waitForAddCompletion(appid, overlay) {
        return new Promise(function(resolve) {
            let finished = false;
            const timer = setInterval(function(){
                if (finished) { clearInterval(timer); return; }
                try {
                    Millennium.callServerMethod('luatools', 'GetAddViaLuaToolsStatus', { appid, contentScriptQuery: '' }).then(function(res){
                        try {
                            const payload = typeof res === 'string' ? JSON.parse(res) : res;
                            const st = payload && payload.state ? payload.state : {};
                            if (overlay) {
                                if (st.status === 'checking') updateBundleOverlay(overlay, null, lt('Checking availability…'));
                                if (st.status === 'downloading') {
                                    const total = st.totalBytes || 0; const read = st.bytesRead || 0;
                                    const pct = total > 0 ? (read / total) * 100 : (read ? 1 : 0);
                                    updateBundleOverlay(overlay, null, lt('Downloading…'), pct);
                                    const cancelBtn = overlay.querySelector('.luatools-cancel-btn');
                                    if (cancelBtn) cancelBtn.style.display = '';
                                }
                                if (st.status === 'processing') updateBundleOverlay(overlay, null, lt('Processing package…'));
                                if (st.status === 'installing') updateBundleOverlay(overlay, null, lt('Installing…'));
                                if (st.status === 'done') updateBundleOverlay(overlay, null, lt('Finishing…'), 100);
                                if (st.status === 'failed') updateBundleOverlay(overlay, null, lt('Failed'));
                            }
                            if (st.status === 'done' || st.status === 'failed' || st.status === 'cancelled') {
                                finished = true;
                                clearInterval(timer);
                                resolve(st);
                            }
                        } catch(_) {
                            finished = true;
                            clearInterval(timer);
                            resolve({ status: 'failed', error: 'status_parse' });
                        }
                    });
                } catch(_) {
                    finished = true;
                    clearInterval(timer);
                    resolve({ status: 'failed', error: 'status_call' });
                }
            }, 400);
        });
    }

    async function addBundleGames(apps) {
        if (!apps || !apps.length) {
            ShowLuaToolsAlert('LuaTools', lt('Bundle must include at least 2 base games (DLC not counted).'));
            return;
        }
        if (runState.inProgress) return;
        runState.inProgress = true;
        runState.appid = null;
        try {
            showTestPopup();
            const overlay = document.querySelector('.luatools-overlay');
            const total = apps.length;
            let successCount = 0;
            const hideBtn = overlay ? overlay.querySelector('.luatools-hide-btn') : null;
            for (let i = 0; i < apps.length; i++) {
                const app = apps[i];
                runState.appid = parseInt(app.appid, 10);
                window.__LuaToolsCurrentAppId = runState.appid;
                const titleText = lt('LuaTools · Bundle') + ' ' + (i + 1) + '/' + total;
                const statusText = lt('Adding {game}…').replace('{game}', app.name || ('App ' + app.appid));
                updateBundleOverlay(overlay, titleText, statusText, 0);
                try {
                    if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                        Millennium.callServerMethod('luatools', 'StartAddViaLuaTools', { appid: runState.appid, contentScriptQuery: '' });
                    }
                } catch(_) {}
                const result = await waitForAddCompletion(runState.appid, overlay);
                if (result && result.status === 'done') {
                    successCount += 1;
                }
            }
            if (overlay) {
                updateBundleOverlay(overlay, lt('LuaTools · Bundle'), lt('Bundle complete.'), 100);
                const cancelBtn = overlay.querySelector('.luatools-cancel-btn');
                if (cancelBtn) cancelBtn.style.display = 'none';
                if (hideBtn) hideBtn.innerHTML = `<span>${lt('Close')}</span>`;
            }
            if (successCount > 0) {
                scheduleRestartSteam(3, overlay);
            }
        } finally {
            runState.inProgress = false;
            runState.appid = null;
        }
    }

    function createStoreBundleAddButton() {
        if (!isBundlePage()) return;
        if (document.querySelector('.luatools-store-button-container')) return;
        const container = getPurchaseContainer();
        if (!container) { return; }

        const btnContainer = document.createElement('div');
        btnContainer.className = 'btn_addtocart btn_packageinfo luatools-store-button-container luatools-store-bundle';

        const button = document.createElement('span');
        button.setAttribute('data-panel', '{"focusable":true,"clickOnActivate":true}');
        button.setAttribute('role', 'button');
        button.className = 'btn_blue_steamui btn_medium';
        button.style.marginLeft = '2px';

        const buttonSpan = document.createElement('span');
        const addText = lt('Add bundle games via LuaTools');
        buttonSpan.textContent = addText;
        button.appendChild(buttonSpan);
        btnContainer.appendChild(button);

        setSteamTooltip(button, addText);

        button.onclick = async function() {
            if (runState.inProgress) return;
            button.style.pointerEvents = 'none';
            buttonSpan.textContent = lt('Scanning bundle…');
            button.style.opacity = '0.7';
            try {
                const apps = await collectBundleAppsForInstall();
                button.style.pointerEvents = '';
                button.style.opacity = '';
                buttonSpan.textContent = addText;
                await addBundleGames(apps);
            } catch(_) {
                button.style.pointerEvents = '';
                button.style.opacity = '';
                buttonSpan.textContent = addText;
                ShowLuaToolsAlert('LuaTools', lt('Failed to read bundle contents.'));
            }
        };

        container.appendChild(btnContainer);
    }

    function createStoreRemoveButton(appId) {
        if (!isStoreGamePage()) return;
        if (document.querySelector('.luatools-store-button-container')) return;
        const container = getPurchaseContainer();
        if (!container) { return; }

        const btnContainer = document.createElement('div');
        btnContainer.className = 'btn_addtocart btn_packageinfo luatools-store-button-container luatools-store-remove';

        const button = document.createElement('span');
        button.setAttribute('data-panel', '{"focusable":true,"clickOnActivate":true}');
        button.setAttribute('role', 'button');
        button.className = 'btn_blue_steamui btn_medium';
        button.style.marginLeft = '2px';

        const buttonSpan = document.createElement('span');
        const removeText = t('menu.removeLuaTools', 'Remove via LuaTools');
        buttonSpan.textContent = removeText;
        button.appendChild(buttonSpan);
        btnContainer.appendChild(button);

        setSteamTooltip(button, removeText);

        const doRemove = function() {
            if (runState.inProgress) return;
            runState.inProgress = true;
            runState.appid = appId;
            button.style.pointerEvents = 'none';
            buttonSpan.textContent = lt('Removing…');
            button.style.opacity = '0.7';
            try {
                Millennium.callServerMethod('luatools', 'DeleteLuaToolsForApp', { appid: appId, contentScriptQuery: '' })
                    .then(function(res){
                        let payload = res;
                        if (typeof res === 'string') {
                            try { payload = JSON.parse(res); } catch(_) { payload = null; }
                        }
                        if (payload && payload.success) {
                            removeLuaToolsLibraryBanners();
                            const storeBtn = document.querySelector('.luatools-store-button-container');
                            if (storeBtn && storeBtn.parentElement) storeBtn.parentElement.removeChild(storeBtn);
                            createStoreAddButton(appId);
                            const successText = t('menu.remove.success', 'LuaTools removed for this app.');
                            if (typeof ShowLuaToolsAlert === 'function') {
                                ShowLuaToolsAlert('LuaTools', successText);
                            }
                        } else {
                            const failureText = t('menu.remove.failure', 'Failed to remove LuaTools.');
                            const errMsg = (payload && payload.error) ? String(payload.error) : failureText;
                            if (typeof ShowLuaToolsAlert === 'function') {
                                ShowLuaToolsAlert('LuaTools', errMsg);
                            }
                        }
                    })
                    .catch(function(err){
                        const failureText = t('menu.remove.failure', 'Failed to remove LuaTools.');
                        const errMsg = (err && err.message) ? err.message : failureText;
                        if (typeof ShowLuaToolsAlert === 'function') {
                            ShowLuaToolsAlert('LuaTools', errMsg);
                        }
                    })
                    .finally(function(){
                        runState.inProgress = false;
                        runState.appid = null;
                    });
            } catch(_) {
                runState.inProgress = false;
                runState.appid = null;
            }
        };

        button.onclick = function() {
            const confirmMessage = t('menu.remove.confirm', 'Remove via LuaTools for this game?');
            if (typeof showLuaToolsConfirm === 'function') {
                showLuaToolsConfirm('LuaTools', confirmMessage, function(){ doRemove(); }, function(){});
            } else {
                doRemove();
            }
        };

        container.appendChild(btnContainer);
    }

    let storeCheckInFlight = false;
    let storeCheckAppId = null;
    let bundleStoreCheckInFlight = false;
    let bundleStoreCheckKey = '';
    async function ensureStoreAddButton() {
        if (!isBundlePage() && !isStoreGamePage()) {
            clearStoreUiForNonStorePage();
            storeCheckInFlight = false;
            storeCheckAppId = null;
            return;
        }

        const existing = document.querySelector('.luatools-store-button-container');
        if (isBundlePage()) {
            if (existing && !existing.classList.contains('luatools-store-bundle')) {
                try { existing.parentElement.removeChild(existing); } catch(_) {}
            }

            const currentBundleBtn = document.querySelector('.luatools-store-button-container');
            if (!currentBundleBtn || !currentBundleBtn.classList.contains('luatools-store-bundle')) {
                createStoreBundleAddButton();
            }

            const bundlePageId = getBundlePageId() || '';
            if (bundleStoreCheckInFlight && bundleStoreCheckKey === bundlePageId) return;
            bundleStoreCheckInFlight = true;
            bundleStoreCheckKey = bundlePageId;
            try {
                const bundleIds = await getBundleCandidateAppIds();
                const baseGames = await getBundleBaseGameApps(bundleIds);
                const isValidBundle = baseGames.length > 1;
                const current = document.querySelector('.luatools-store-button-container');
                if (isValidBundle) {
                    if (!current || !current.classList.contains('luatools-store-bundle')) {
                        if (current && current.parentElement) current.parentElement.removeChild(current);
                        createStoreBundleAddButton();
                    }
                } else if (current && current.classList.contains('luatools-store-bundle')) {
                    try { current.parentElement.removeChild(current); } catch(_) {}
                }
            } catch(_) {
                const current = document.querySelector('.luatools-store-button-container');
                if (current && current.classList.contains('luatools-store-bundle')) {
                    try { current.parentElement.removeChild(current); } catch(_) {}
                }
            } finally {
                bundleStoreCheckInFlight = false;
            }
            return;
        }

        if (existing && existing.classList.contains('luatools-store-bundle')) {
            try { existing.parentElement.removeChild(existing); } catch(_) {}
        }

        const appId = getCurrentAppId();
        if (!appId) return;
        if (storeCheckInFlight && storeCheckAppId === appId) return;
        storeCheckInFlight = true;
        storeCheckAppId = appId;
        try {
            Millennium.callServerMethod('luatools', 'HasLuaToolsForApp', { appid: appId, contentScriptQuery: '' })
                .then(function(res) {
                    let payload = res;
                    if (typeof res === 'string') {
                        try { payload = JSON.parse(res); } catch(_) { payload = null; }
                    }
                    const exists = payload && payload.success && payload.exists === true;
                    const existingBtn = document.querySelector('.luatools-store-button-container');
                    if (exists) {
                        if (!existingBtn || !existingBtn.classList.contains('luatools-store-remove')) {
                            if (existingBtn && existingBtn.parentElement) existingBtn.parentElement.removeChild(existingBtn);
                            createStoreRemoveButton(appId);
                        }
                        showLibraryBanners();
                    } else {
                        if (!existingBtn || !existingBtn.classList.contains('luatools-store-add')) {
                            if (existingBtn && existingBtn.parentElement) existingBtn.parentElement.removeChild(existingBtn);
                            createStoreAddButton(appId);
                        }
                    }
                })
                .catch(function() {
                    createStoreAddButton(appId);
                })
                .finally(function() {
                    storeCheckInFlight = false;
                });
        } catch(_) {
            storeCheckInFlight = false;
            createStoreAddButton(appId);
        }
    }

    
    ensureTranslationsLoaded(false);

    let settingsMenuPending = false;

    function styleGreyscaleLoadingModal(modal) {
        if (!modal) return;
        modal.style.background = 'linear-gradient(160deg, #2b2b2b 0%, #1c1c1c 60%, #141414 100%)';
        modal.style.color = '#f2f2f2';
        modal.style.border = '1px solid rgba(220,220,220,0.35)';
        modal.style.borderRadius = '8px';
        modal.style.boxShadow = '0 20px 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)';
    }

    function styleGreyscaleLoadingTitle(title) {
        if (!title) return;
        title.style.color = '#f2f2f2';
        title.style.textShadow = '0 2px 8px rgba(0,0,0,0.6)';
        title.style.background = 'linear-gradient(135deg, #f2f2f2 0%, #bdbdbd 100%)';
        title.style.webkitBackgroundClip = 'text';
        title.style.webkitTextFillColor = 'transparent';
        title.style.backgroundClip = 'text';
    }

    function styleGreyscaleLoadingBody(body) {
        if (!body) return;
        body.style.color = '#cfcfcf';
    }

    function styleGreyscaleLoadingProgress(progressWrap, progressBar, percent) {
        if (progressWrap) {
            progressWrap.style.background = 'rgba(255,255,255,0.08)';
            progressWrap.style.border = '1px solid rgba(255,255,255,0.2)';
            progressWrap.style.borderRadius = '6px';
        }
        if (progressBar) {
            progressBar.style.background = 'linear-gradient(90deg, #f0f0f0 0%, #bdbdbd 100%)';
            progressBar.style.boxShadow = '0 0 12px rgba(255,255,255,0.35)';
        }
        if (percent) {
            percent.style.color = '#9a9a9a';
        }
    }

    function styleGreyscaleLoadingButton(btn, isPrimary) {
        if (!btn) return;
        const baseBg = isPrimary ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)';
        const baseBorder = isPrimary ? 'rgba(255,255,255,0.55)' : 'rgba(220,220,220,0.35)';
        const hoverBg = isPrimary ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.16)';
        const hoverBorder = isPrimary ? '#f0f0f0' : 'rgba(220,220,220,0.6)';
        btn.style.background = baseBg;
        btn.style.border = '1px solid ' + baseBorder;
        btn.style.borderRadius = '8px';
        btn.style.color = '#e6e6e6';
        btn.style.textDecoration = 'none';
        btn.style.fontSize = '13px';
        btn.style.fontWeight = '600';
        btn.style.transition = 'all 0.2s ease';
        btn.style.boxShadow = 'none';
        btn.onmouseover = function() {
            this.style.background = hoverBg;
            this.style.borderColor = hoverBorder;
            this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.45)';
        };
        btn.onmouseout = function() {
            this.style.background = baseBg;
            this.style.borderColor = baseBorder;
            this.style.boxShadow = 'none';
        };
    }
    
    

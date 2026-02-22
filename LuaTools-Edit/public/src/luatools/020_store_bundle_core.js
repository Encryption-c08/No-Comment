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

    function normalizeAppIdList(values) {
        return Array.from(new Set((Array.isArray(values) ? values : []).map(function(v){ return String(v).trim(); }).filter(function(v){ return /^\d+$/.test(v); })));
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
                    const dlcAppids = normalizeAppIdList(entry && entry.success && entry.data && Array.isArray(entry.data.dlc) ? entry.data.dlc : []);
                    cache[id] = (entry && entry.success && entry.data) ? {
                        name: entry.data.name || '',
                        type: entry.data.type || '',
                        fullgameAppid: fullgame && fullgame.appid ? String(fullgame.appid) : '',
                        fullgameName: fullgame && fullgame.name ? String(fullgame.name) : '',
                        dlcAppids: dlcAppids,
                        success: true
                    } : { name: '', type: '', fullgameAppid: '', fullgameName: '', dlcAppids: [], success: false };
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
        const dlcAppids = normalizeAppIdList(entry && entry.success && entry.data && Array.isArray(entry.data.dlc) ? entry.data.dlc : []);
        const details = (entry && entry.success && entry.data) ? {
            name: entry.data.name || '',
            type: entry.data.type || '',
            fullgameAppid: fullgame && fullgame.appid ? String(fullgame.appid) : '',
            fullgameName: fullgame && fullgame.name ? String(fullgame.name) : '',
            dlcAppids: dlcAppids,
            success: true
        } : { name: '', type: '', fullgameAppid: '', fullgameName: '', dlcAppids: [], success: false };
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

    function collectOwnedSteamAppIds() {
        const owned = new Set();

        function addId(value) {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed) && parsed > 0) owned.add(String(parsed));
        }

        function addFromMaybeArrayOrMap(raw) {
            if (!raw) return;
            if (Array.isArray(raw)) {
                for (let i = 0; i < raw.length; i++) addId(raw[i]);
                return;
            }
            if (typeof raw === 'object') {
                Object.keys(raw).forEach(function(key) {
                    const val = raw[key];
                    if (val === true || val === 1 || val === '1') addId(key);
                    if (typeof val === 'number' || /^\d+$/.test(String(val))) addId(val);
                });
            }
        }

        try {
            if (typeof window !== 'undefined') {
                addFromMaybeArrayOrMap(window.g_rgOwnedApps);
                addFromMaybeArrayOrMap(window.g_rgOwnedAppsByAccount);
                if (window.GDynamicStore) {
                    addFromMaybeArrayOrMap(window.GDynamicStore.s_rgOwnedApps);
                    addFromMaybeArrayOrMap(window.GDynamicStore.rgOwnedApps);
                    if (typeof window.GDynamicStore.GetOwnedApps === 'function') {
                        addFromMaybeArrayOrMap(window.GDynamicStore.GetOwnedApps());
                    }
                }
            }
        } catch(_) {}

        try {
            const currentApp = getCurrentAppId();
            const ownBanner = document.querySelector('#game_area_already_owned, .game_area_already_owned');
            if (ownBanner && currentApp) {
                owned.add(String(currentApp));
            }
        } catch(_) {}

        try {
            const rows = document.querySelectorAll('.game_area_dlc_row, [data-ds-appid], [data-appid]');
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                let appid = (row.getAttribute('data-ds-appid') || row.getAttribute('data-appid') || '').split(',')[0].trim();
                if (!appid) {
                    const hrefNode = row.matches('a[href*="/app/"]') ? row : row.querySelector('a[href*="/app/"]');
                    const href = hrefNode ? hrefNode.getAttribute('href') : '';
                    const match = href ? String(href).match(/\/app\/(\d+)/i) : null;
                    appid = match ? match[1] : '';
                }
                if (!/^\d+$/.test(appid)) continue;
                const cls = String(row.className || '').toLowerCase();
                const hasOwnedClass = (cls.includes('owned') || cls.includes('in_library') || cls.includes('inlibrary')) && row.getAttribute('data-luatools-ds-owned') !== '1';
                const hasOwnedNode = !!row.querySelector('.ds_owned_flag:not([data-luatools-search-owned="1"]), .in_library_flag, .game_area_dlc_owned, .owned');
                if (hasOwnedClass || hasOwnedNode) owned.add(appid);
            }
        } catch(_) {}

        return owned;
    }

    function isAppOwnedOnSteam(appid) {
        const parsed = parseInt(appid, 10);
        if (isNaN(parsed)) return false;
        const owned = collectOwnedSteamAppIds();
        return owned.has(String(parsed));
    }

    function classifyRelatedContent(details, name) {
        const type = details && details.type ? String(details.type).toLowerCase() : '';
        if (type && type !== 'dlc') {
            return 'special';
        }

        const txt = String(name || '').toLowerCase();
        const specialMarkers = [
            'soundtrack',
            'ost',
            'artbook',
            'wallpaper',
            'digital',
            'cosmetic',
            'skin',
            'avatar',
            'emote',
            'booster',
            'profile',
            'twitch',
            'twitch drop',
            'twitch pack',
            'drop'
        ];
        for (let i = 0; i < specialMarkers.length; i++) {
            if (txt.includes(specialMarkers[i])) return 'special';
        }
        return 'dlc';
    }

    function getInstalledLuaScriptsCache() {
        if (!window.__LuaToolsInstalledLuaScriptsCache) {
            window.__LuaToolsInstalledLuaScriptsCache = { fetchedAt: 0, entries: [] };
        }
        return window.__LuaToolsInstalledLuaScriptsCache;
    }

    const INSTALLED_LUA_IDS_SNAPSHOT_KEY = 'luatools.installedLuaIdsSnapshot.v1';
    const INSTALLED_LUA_IDS_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

    function buildInstalledLuaIdSet(entries) {
        const ids = new Set();
        const source = Array.isArray(entries) ? entries : [];
        for (let i = 0; i < source.length; i++) {
            const entry = source[i] || {};
            const appid = String(entry.appid || '').trim();
            if (/^\d+$/.test(appid)) ids.add(appid);
            const added = normalizeAppIdList(Array.isArray(entry.addedAppIds) ? entry.addedAppIds : []);
            for (let j = 0; j < added.length; j++) {
                ids.add(String(added[j]));
            }
        }
        return ids;
    }

    function readInstalledLuaIdSnapshotSet() {
        try {
            const raw = localStorage.getItem(INSTALLED_LUA_IDS_SNAPSHOT_KEY);
            if (!raw) return new Set();
            const payload = JSON.parse(raw);
            const ts = Number(payload && payload.ts ? payload.ts : 0);
            if (!ts || (Date.now() - ts) > INSTALLED_LUA_IDS_SNAPSHOT_MAX_AGE_MS) {
                return new Set();
            }
            const ids = normalizeAppIdList(Array.isArray(payload && payload.ids) ? payload.ids : []);
            return new Set(ids.map(function(v){ return String(v); }));
        } catch(_) {
            return new Set();
        }
    }

    function writeInstalledLuaIdSnapshotSet(idsSet) {
        try {
            const ids = Array.from(idsSet || [])
                .map(function(v){ return String(v).trim(); })
                .filter(function(v){ return /^\d+$/.test(v); })
                .slice(0, 5000);
            localStorage.setItem(INSTALLED_LUA_IDS_SNAPSHOT_KEY, JSON.stringify({
                ts: Date.now(),
                ids: ids
            }));
        } catch(_) {}
    }

    function writeInstalledLuaIdSnapshotEntries(entries) {
        writeInstalledLuaIdSnapshotSet(buildInstalledLuaIdSet(entries));
    }

    function cloneInstalledLuaEntries(entries) {
        const source = Array.isArray(entries) ? entries : [];
        return source.map(function(entry) {
            const e = entry || {};
            return {
                appid: String(e.appid || '').trim(),
                name: String(e.name || '').trim(),
                addedAppIds: normalizeAppIdList(Array.isArray(e.addedAppIds) ? e.addedAppIds : [])
            };
        });
    }

    function invalidateInstalledLuaScriptsCache() {
        const cache = getInstalledLuaScriptsCache();
        cache.fetchedAt = 0;
    }

    async function getInstalledLuaScriptEntries(forceRefresh) {
        try {
            const cache = getInstalledLuaScriptsCache();
            const now = Date.now();
            const cacheTtlMs = 15000;
            if (!forceRefresh && Array.isArray(cache.entries) && (now - Number(cache.fetchedAt || 0) < cacheTtlMs)) {
                writeInstalledLuaIdSnapshotEntries(cache.entries);
                return cloneInstalledLuaEntries(cache.entries);
            }
            if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                return [];
            }
            const res = await Millennium.callServerMethod('luatools', 'GetInstalledLuaScripts', { contentScriptQuery: '' });
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            const scripts = payload && payload.success && Array.isArray(payload.scripts) ? payload.scripts : [];
            const map = {};
            for (let i = 0; i < scripts.length; i++) {
                const script = scripts[i] || {};
                const id = String(script.appid || '').trim();
                if (!/^\d+$/.test(id)) continue;
                if (!map[id]) {
                    map[id] = {
                        appid: id,
                        name: String(script.gameName || script.filename || ('App ' + id)).trim(),
                        addedAppIds: []
                    };
                }
                const parsedAdded = normalizeAppIdList(Array.isArray(script.addedAppIds) ? script.addedAppIds : []);
                if (parsedAdded.length) {
                    map[id].addedAppIds = normalizeAppIdList(map[id].addedAppIds.concat(parsedAdded));
                }
            }
            const entries = Object.keys(map).map(function(id){ return map[id]; });
            cache.entries = cloneInstalledLuaEntries(entries);
            cache.fetchedAt = now;
            writeInstalledLuaIdSnapshotEntries(cache.entries);
            return cloneInstalledLuaEntries(entries);
        } catch(_) {
            return [];
        }
    }

    async function getInstalledLuaAppIds() {
        const entries = await getInstalledLuaScriptEntries();
        return normalizeAppIdList(entries.map(function(entry){ return entry && entry.appid; }));
    }

    async function fetchExtraInstalledRelatedEntries(baseAppid, baseName, knownIdsSet, installedEntries) {
        const base = String(parseInt(baseAppid, 10));
        if (!/^\d+$/.test(base)) return [];

        const availableEntries = Array.isArray(installedEntries) ? installedEntries : await getInstalledLuaScriptEntries();
        if (!availableEntries.length) return [];

        const candidates = availableEntries.filter(function(entry) {
            const id = String(entry && entry.appid ? entry.appid : '');
            return /^\d+$/.test(id) && id !== base && !(knownIdsSet && knownIdsSet.has(id));
        });
        if (!candidates.length) return [];

        const baseNameNorm = String(baseName || '').trim().toLowerCase();
        const basePrefix = baseNameNorm ? (baseNameNorm + ' - ') : '';
        const pairs = [];
        const unresolved = [];
        for (let i = 0; i < candidates.length; i++) {
            const entry = candidates[i];
            const id = String(entry.appid);
            const hintedName = String(entry.name || '').trim();
            const hintedNorm = hintedName.toLowerCase();
            const inferredByName = !!(basePrefix && hintedNorm.startsWith(basePrefix));
            if (inferredByName) {
                pairs.push({ appid: id, details: null, installedLua: true, nameHint: hintedName });
            } else {
                unresolved.push({ appid: id, nameHint: hintedName });
            }
        }

        if (!unresolved.length) return pairs;

        try {
            const unresolvedIds = unresolved.map(function(entry){ return String(entry.appid); });
            await primeAppDetailsCache(unresolvedIds);
            const detailsCache = getAppDetailsCache();
            for (let i = 0; i < unresolved.length; i++) {
                const entry = unresolved[i];
                const id = String(entry.appid);
                const details = detailsCache[id] || null;
                const parent = details && details.fullgameAppid ? String(details.fullgameAppid).trim() : '';
                if (parent === base) {
                    pairs.push({ appid: id, details: details, installedLua: true, nameHint: entry.nameHint || '' });
                }
            }
        } catch(_) {}

        return pairs;
    }

    function getStoreRelatedContentCache() {
        if (!window.__LuaToolsStoreRelatedContentCache) {
            window.__LuaToolsStoreRelatedContentCache = {};
        }
        return window.__LuaToolsStoreRelatedContentCache;
    }

    function getSteamDbRelatedContentCache() {
        if (!window.__LuaToolsSteamDbRelatedContentCache) {
            window.__LuaToolsSteamDbRelatedContentCache = {};
        }
        return window.__LuaToolsSteamDbRelatedContentCache;
    }

    function getApiRelatedContentCache() {
        if (!window.__LuaToolsApiRelatedContentCache) {
            window.__LuaToolsApiRelatedContentCache = {};
        }
        return window.__LuaToolsApiRelatedContentCache;
    }

    async function fetchStoreRelatedEntries(baseAppid) {
        const base = String(parseInt(baseAppid, 10));
        if (!/^\d+$/.test(base)) return [];
        const cache = getStoreRelatedContentCache();
        if (Array.isArray(cache[base])) return cache[base];

        try {
            const url = 'https://store.steampowered.com/dlc/' + encodeURIComponent(base) + '/?l=english';
            const res = await fetch(url, { credentials: 'omit' });
            if (!res.ok) throw new Error('Store related lookup failed: ' + res.status);
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const byId = {};
            const rows = doc.querySelectorAll('.game_area_dlc_row, .tab_item, [data-ds-appid], [data-appid]');
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                let appid = (row.getAttribute('data-ds-appid') || row.getAttribute('data-appid') || '').split(',')[0].trim();
                if (!/^\d+$/.test(appid)) {
                    const hrefNode = row.matches('a[href*="/app/"]') ? row : row.querySelector('a[href*="/app/"]');
                    const href = hrefNode ? hrefNode.getAttribute('href') : '';
                    const match = href ? String(href).match(/\/app\/(\d+)/i) : null;
                    appid = match ? match[1] : '';
                }
                if (!/^\d+$/.test(appid) || appid === base) continue;

                const nameNode = row.querySelector('.tab_item_name, .game_area_dlc_name, .name, h4, .title') || row;
                const name = String((nameNode && nameNode.textContent) || '').replace(/\s+/g, ' ').trim();
                byId[appid] = byId[appid] || { appid: appid, name: name || ('App ' + appid) };
            }

            const values = Object.keys(byId).map(function(id){ return byId[id]; });
            cache[base] = values;
            return values;
        } catch(_) {
            cache[base] = [];
            return [];
        }
    }

    async function fetchSteamDbRelatedEntries(baseAppid) {
        const base = String(parseInt(baseAppid, 10));
        if (!/^\d+$/.test(base)) return [];
        const cache = getSteamDbRelatedContentCache();
        const cached = cache[base];
        const now = Date.now();
        const ttlMs = 10 * 60 * 1000;
        if (cached && Array.isArray(cached.entries) && (now - Number(cached.fetchedAt || 0) < ttlMs)) {
            return cached.entries;
        }

        try {
            if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                cache[base] = { fetchedAt: now, entries: [] };
                return [];
            }

            const res = await Millennium.callServerMethod('luatools', 'GetSteamDbRelatedEntries', {
                appid: parseInt(base, 10),
                contentScriptQuery: ''
            });
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            const rawEntries = (payload && Array.isArray(payload.entries)) ? payload.entries : [];
            const byId = {};
            for (let i = 0; i < rawEntries.length; i++) {
                const entry = rawEntries[i] || {};
                const id = String(entry.appid || '').trim();
                if (!/^\d+$/.test(id) || id === base) continue;
                const name = String(entry.name || ('App ' + id)).replace(/\s+/g, ' ').trim();
                byId[id] = byId[id] || { appid: id, name: name || ('App ' + id) };
            }
            const values = Object.keys(byId).map(function(id){ return byId[id]; });
            if (values.length > 0) {
                cache[base] = { fetchedAt: now, entries: values };
            } else {
                delete cache[base];
            }
            return values;
        } catch(_) {
            delete cache[base];
            return [];
        }
    }

    async function fetchApiRelatedEntries(baseAppid) {
        const base = String(parseInt(baseAppid, 10));
        if (!/^\d+$/.test(base)) return [];
        const cache = getApiRelatedContentCache();
        const cached = cache[base];
        const now = Date.now();
        const ttlMs = 10 * 60 * 1000;
        if (cached && Array.isArray(cached.entries) && (now - Number(cached.fetchedAt || 0) < ttlMs)) {
            return cached.entries;
        }

        try {
            if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                cache[base] = { fetchedAt: now, entries: [] };
                return [];
            }
            const res = await Millennium.callServerMethod('luatools', 'GetApiRelatedEntries', {
                appid: parseInt(base, 10),
                contentScriptQuery: ''
            });
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            const rawEntries = (payload && Array.isArray(payload.entries)) ? payload.entries : [];
            const byId = {};
            for (let i = 0; i < rawEntries.length; i++) {
                const entry = rawEntries[i] || {};
                const id = String(entry.appid || '').trim();
                if (!/^\d+$/.test(id) || id === base) continue;
                const name = String(entry.name || ('App ' + id)).replace(/\s+/g, ' ').trim();
                byId[id] = byId[id] || { appid: id, name: name || ('App ' + id) };
            }
            const values = Object.keys(byId).map(function(id){ return byId[id]; });
            if (values.length > 0) {
                cache[base] = { fetchedAt: now, entries: values };
            } else {
                delete cache[base];
            }
            return values;
        } catch(_) {
            delete cache[base];
            return [];
        }
    }

    function getDlcAppIdsFromDetails(details) {
        return normalizeAppIdList(details && Array.isArray(details.dlcAppids) ? details.dlcAppids : []);
    }

    async function fetchGameDlcEntries(appid) {
        const parsed = parseInt(appid, 10);
        if (isNaN(parsed)) {
            return { appType: '', baseName: '', baseHasLua: false, items: [] };
        }

        const details = await fetchAppDetailsById(parsed);
        const appType = details && details.type ? String(details.type).toLowerCase() : '';
        const baseName = (details && details.name) ? String(details.name) : ('App ' + parsed);
        const dlcIds = getDlcAppIdsFromDetails(details);
        const dlcIdSet = new Set(dlcIds);
        const lookups = await Promise.all([
            fetchStoreRelatedEntries(parsed),
            getInstalledLuaScriptEntries(false),
            fetchSteamDbRelatedEntries(parsed),
            fetchApiRelatedEntries(parsed)
        ]);
        const storeEntries = Array.isArray(lookups[0]) ? lookups[0] : [];
        const storeIds = normalizeAppIdList(storeEntries.map(function(entry){ return entry && entry.appid; }));
        const installedEntries = Array.isArray(lookups[1]) ? lookups[1] : [];
        const steamDbEntries = Array.isArray(lookups[2]) ? lookups[2] : [];
        const steamDbIds = normalizeAppIdList(steamDbEntries.map(function(entry){ return entry && entry.appid; }));
        const apiEntries = Array.isArray(lookups[3]) ? lookups[3] : [];
        const apiIds = normalizeAppIdList(apiEntries.map(function(entry){ return entry && entry.appid; }));
        const apiIdSet = new Set(apiIds);
        const steamDbIdSet = new Set(steamDbIds);
        const installedScriptMap = {};
        for (let e = 0; e < installedEntries.length; e++) {
            const entry = installedEntries[e] || {};
            const id = String(entry.appid || '').trim();
            if (!/^\d+$/.test(id)) continue;
            if (!installedScriptMap[id]) {
                installedScriptMap[id] = {
                    appid: id,
                    name: String(entry.name || ('App ' + id)).trim(),
                    addedAppIds: []
                };
            }
            const parsedAdded = normalizeAppIdList(Array.isArray(entry.addedAppIds) ? entry.addedAppIds : []);
            if (parsedAdded.length) {
                installedScriptMap[id].addedAppIds = normalizeAppIdList(installedScriptMap[id].addedAppIds.concat(parsedAdded));
            }
        }

        const baseKey = String(parsed);
        const baseScriptEntry = installedScriptMap[baseKey] || null;
        const baseHasLua = !!baseScriptEntry;
        const baseScriptAddedIds = normalizeAppIdList(
            (baseScriptEntry && Array.isArray(baseScriptEntry.addedAppIds)) ? baseScriptEntry.addedAppIds : []
        ).filter(function(id){ return id !== baseKey; });
        const baseScriptAddedSet = new Set(baseScriptAddedIds);

        const relatedIds = normalizeAppIdList(dlcIds.concat(storeIds).concat(steamDbIds).concat(apiIds).concat(baseScriptAddedIds));
        if (appType !== 'game' || !relatedIds.length) {
            return { appType: appType, baseName: baseName, baseHasLua: baseHasLua, items: [] };
        }

        await primeAppDetailsCache(relatedIds);
        const installedLuaMap = {};
        Object.keys(installedScriptMap).forEach(function(id) {
            installedLuaMap[id] = true;
        });

        const detailsCache = getAppDetailsCache();
        const detailPairs = relatedIds.map(function(id) {
            return { appid: id, details: detailsCache[id] || null };
        });
        const knownSet = new Set(relatedIds);
        const extraPairs = baseHasLua
            ? []
            : await fetchExtraInstalledRelatedEntries(parsed, baseName, knownSet, installedEntries);
        const allPairs = detailPairs.concat(extraPairs);

        const pairById = {};
        for (let p = 0; p < allPairs.length; p++) {
            const pair = allPairs[p] || {};
            const id = String(pair.appid || '').trim();
            if (!/^\d+$/.test(id)) continue;
            if (!pairById[id]) {
                pairById[id] = { appid: id, details: null, installedLua: false, nameHint: '' };
            }
            if (!pairById[id].details && pair.details) {
                pairById[id].details = pair.details;
            }
            if (pair.installedLua) {
                pairById[id].installedLua = true;
            }
            if (!pairById[id].nameHint && pair.nameHint) {
                pairById[id].nameHint = String(pair.nameHint).trim();
            }
        }
        for (let r = 0; r < relatedIds.length; r++) {
            const id = String(relatedIds[r] || '').trim();
            if (!/^\d+$/.test(id)) continue;
            if (!pairById[id]) {
                pairById[id] = { appid: id, details: null, installedLua: false, nameHint: '' };
            }
        }

        const ownedSet = collectOwnedSteamAppIds();
        const storeNameById = {};
        for (let s = 0; s < storeEntries.length; s++) {
            const entry = storeEntries[s];
            if (entry && /^\d+$/.test(String(entry.appid || ''))) {
                storeNameById[String(entry.appid)] = String(entry.name || '').trim();
            }
        }
        for (let s = 0; s < steamDbEntries.length; s++) {
            const entry = steamDbEntries[s];
            if (entry && /^\d+$/.test(String(entry.appid || ''))) {
                const id = String(entry.appid);
                const name = String(entry.name || '').trim();
                if (!storeNameById[id] || storeNameById[id].startsWith('App ')) {
                    storeNameById[id] = name || storeNameById[id] || ('App ' + id);
                }
            }
        }
        for (let s = 0; s < apiEntries.length; s++) {
            const entry = apiEntries[s];
            if (entry && /^\d+$/.test(String(entry.appid || ''))) {
                const id = String(entry.appid);
                const name = String(entry.name || '').trim();
                if (!storeNameById[id] || storeNameById[id].startsWith('App ')) {
                    storeNameById[id] = name || storeNameById[id] || ('App ' + id);
                }
            }
        }

        const items = Object.keys(pairById).map(function(id) {
            const pair = pairById[id];
            const appDetails = pair.details;
            const fallbackName = storeNameById[String(pair.appid)] || '';
            const hintedName = String(pair && pair.nameHint ? pair.nameHint : '').trim();
            const name = (appDetails && appDetails.name) ? String(appDetails.name) : (hintedName || fallbackName || ('App ' + pair.appid));
            const installedLua = !!(pair.installedLua || installedLuaMap[pair.appid]);
            const inheritedByBase = !!(baseHasLua && baseScriptAddedSet.has(String(pair.appid)) && !installedLua);
            const ownedOnSteam = ownedSet.has(String(pair.appid));
            const contentType = appDetails && appDetails.type ? String(appDetails.type) : '';
            let category = classifyRelatedContent(appDetails, name);
            if (category === 'dlc' && baseScriptAddedSet.has(String(pair.appid)) && !dlcIdSet.has(String(pair.appid))) {
                const contentTypeNorm = String(contentType || '').toLowerCase();
                if (!appDetails || contentTypeNorm !== 'dlc') {
                    category = 'special';
                }
            }
            if (category === 'dlc' && (apiIdSet.has(String(pair.appid)) || steamDbIdSet.has(String(pair.appid))) && !dlcIdSet.has(String(pair.appid))) {
                const contentTypeNorm = String(contentType || '').toLowerCase();
                if (!appDetails || contentTypeNorm !== 'dlc') {
                    category = 'special';
                }
            }
            return {
                appid: pair.appid,
                name: name,
                installedLua: installedLua,
                inheritedByBase: inheritedByBase,
                baseScriptIncluded: baseScriptAddedSet.has(String(pair.appid)),
                ownedOnSteam: ownedOnSteam,
                category: category,
                contentType: contentType
            };
        }).sort(function(a, b) {
            return String(a.name || '').localeCompare(String(b.name || ''));
        });

        return { appType: appType, baseName: baseName, baseHasLua: baseHasLua, items: items };
    }

    async function addLuaToolsForAppAndWait(appid, options) {
        const parsed = parseInt(appid, 10);
        if (isNaN(parsed)) {
            return { success: false, error: lt('Invalid app id.') };
        }
        if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
            return { success: false, error: lt('LuaTools backend is unavailable.') };
        }

        const opts = (options && typeof options === 'object') ? options : {};
        const parsedBase = parseInt(opts.baseAppid, 10);
        const baseAppid = isNaN(parsedBase) ? 0 : parsedBase;
        const baseOwnedOnSteam = !!opts.baseOwnedOnSteam;

        try {
            await Millennium.callServerMethod('luatools', 'StartAddViaLuaTools', {
                appid: parsed,
                baseAppid: baseAppid,
                baseOwnedOnSteam: baseOwnedOnSteam,
                contentScriptQuery: ''
            });
            const result = await waitForAddCompletion(parsed, null);
            if (result && result.status === 'done') {
                invalidateInstalledLuaScriptsCache();
                return { success: true };
            }
            const err = (result && result.error) ? String(result.error) : lt('Failed');
            return { success: false, error: err };
        } catch(err) {
            return { success: false, error: (err && err.message) ? err.message : lt('Failed') };
        }
    }

    async function removeLuaToolsForAppById(appid) {
        const parsed = parseInt(appid, 10);
        if (isNaN(parsed)) {
            return { success: false, error: lt('Invalid app id.') };
        }
        if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
            return { success: false, error: lt('LuaTools backend is unavailable.') };
        }

        try {
            const res = await Millennium.callServerMethod('luatools', 'DeleteLuaToolsForApp', { appid: parsed, contentScriptQuery: '' });
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            if (payload && payload.success) {
                invalidateInstalledLuaScriptsCache();
                return { success: true };
            }
            return { success: false, error: (payload && payload.error) ? String(payload.error) : lt('Failed to remove LuaTools.') };
        } catch(err) {
            return { success: false, error: (err && err.message) ? err.message : lt('Failed to remove LuaTools.') };
        }
    }

    function setPseudoDisabled(el, disabled) {
        if (!el) return;
        if (disabled) {
            el.dataset.disabled = '1';
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.55';
        } else {
            delete el.dataset.disabled;
            el.style.pointerEvents = '';
            el.style.opacity = '';
        }
    }

    function removeStoreDlcManageButton() {
        document.querySelectorAll('.luatools-store-dlc-button-container').forEach(function(btn) {
            try { btn.remove(); } catch(_) {}
        });
    }

    function showStoreDlcManager(appId) {
        closeSettingsOverlay();
        if (document.querySelector('.luatools-dlc-manager-overlay')) return;

        const parsedAppId = parseInt(appId, 10);
        if (isNaN(parsedAppId)) return;

        ensureLuaToolsStyles();
        ensureFontAwesome();

        const overlay = document.createElement('div');
        overlay.className = 'luatools-dlc-manager-overlay luatools-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);backdrop-filter:blur(8px);z-index:100001;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(160deg, #2b2f36 0%, #1f2329 100%);color:#e9edf2;border:1px solid rgba(170,170,170,0.35);border-radius:12px;width:760px;max-width:calc(100vw - 32px);padding:20px 22px;box-shadow:0 22px 60px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,0.04);';

        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size:24px;font-weight:800;text-align:center;color:#f0f3f6;letter-spacing:0.2px;';
        titleEl.textContent = lt('LuaTools · DLC Manager');

        const subTitleEl = document.createElement('div');
        subTitleEl.style.cssText = 'font-size:13px;color:#c6d0dc;text-align:center;margin-top:6px;margin-bottom:12px;';
        subTitleEl.textContent = '';

        const statusEl = document.createElement('div');
        statusEl.style.cssText = 'font-size:13px;color:#b9c4d1;text-align:center;margin-bottom:12px;min-height:18px;';

        const tabsRow = document.createElement('div');
        tabsRow.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;';

        const dlcTabBtn = document.createElement('a');
        dlcTabBtn.href = '#';
        dlcTabBtn.style.cssText = 'min-width:140px;text-align:center;padding:8px 12px;border-radius:10px;border:1px solid rgba(175,175,175,0.45);background:rgba(68,68,68,0.85);color:#e4e4e4;text-decoration:none;font-size:12px;font-weight:700;';
        dlcTabBtn.textContent = lt('DLCs');

        const specialTabBtn = document.createElement('a');
        specialTabBtn.href = '#';
        specialTabBtn.style.cssText = 'min-width:170px;text-align:center;padding:8px 12px;border-radius:10px;border:1px solid rgba(175,175,175,0.45);background:rgba(68,68,68,0.85);color:#e4e4e4;text-decoration:none;font-size:12px;font-weight:700;';
        specialTabBtn.textContent = lt('Special Content');

        tabsRow.appendChild(dlcTabBtn);
        tabsRow.appendChild(specialTabBtn);

        const controlsRow = document.createElement('div');
        controlsRow.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;';

        const addAllBtn = document.createElement('a');
        addAllBtn.href = '#';
        addAllBtn.className = '';
        addAllBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;min-width:220px;text-align:center;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;background:linear-gradient(135deg, rgba(150,150,150,0.78), rgba(95,95,95,0.98));border:1px solid rgba(210,210,210,0.55);color:#f4f4f4;';
        addAllBtn.innerHTML = `<span>${lt('Add All Missing DLCs')}</span>`;

        const addSelectedBtn = document.createElement('a');
        addSelectedBtn.href = '#';
        addSelectedBtn.className = '';
        addSelectedBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;min-width:180px;text-align:center;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;background:linear-gradient(135deg, rgba(136,136,136,0.72), rgba(90,90,90,0.92));border:1px solid rgba(200,200,200,0.5);color:#f0f0f0;';
        addSelectedBtn.innerHTML = `<span>${lt('Add Selected')}</span>`;

        const clearSelectedBtn = document.createElement('a');
        clearSelectedBtn.href = '#';
        clearSelectedBtn.className = '';
        clearSelectedBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;min-width:130px;text-align:center;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;background:rgba(74,74,74,0.82);border:1px solid rgba(170,170,170,0.45);color:#e3e3e3;';
        clearSelectedBtn.innerHTML = `<span>${lt('Clear Selected')}</span>`;

        const refreshBtn = document.createElement('a');
        refreshBtn.href = '#';
        refreshBtn.className = '';
        refreshBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;min-width:120px;text-align:center;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;background:rgba(78,78,78,0.82);border:1px solid rgba(175,175,175,0.45);color:#e6e6e6;';
        refreshBtn.innerHTML = `<span>${lt('Refresh')}</span>`;

        const closeBtn = document.createElement('a');
        closeBtn.href = '#';
        closeBtn.className = '';
        closeBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;min-width:110px;text-align:center;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;background:rgba(68,68,68,0.85);border:1px solid rgba(170,170,170,0.45);color:#e4e4e4;';
        closeBtn.innerHTML = `<span>${lt('Close')}</span>`;

        controlsRow.appendChild(addAllBtn);
        controlsRow.appendChild(addSelectedBtn);
        controlsRow.appendChild(clearSelectedBtn);
        controlsRow.appendChild(refreshBtn);
        controlsRow.appendChild(closeBtn);

        const listWrap = document.createElement('div');
        listWrap.style.cssText = 'max-height:52vh;overflow:auto;border:1px solid rgba(170,170,170,0.25);border-radius:12px;background:rgba(12,14,18,0.45);padding:10px;';

        modal.appendChild(titleEl);
        modal.appendChild(subTitleEl);
        modal.appendChild(statusEl);
        modal.appendChild(tabsRow);
        modal.appendChild(controlsRow);
        modal.appendChild(listWrap);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const state = {
            appid: parsedAppId,
            baseName: '',
            appType: '',
            baseHasLua: false,
            baseOwnedOnSteam: false,
            baseEligible: false,
            activeTab: 'dlc',
            items: [],
            busy: false,
            activeAppid: '',
            changed: false,
            selected: {}
        };

        function promptRestartAfterAdd(successCount) {
            const count = parseInt(successCount, 10);
            if (isNaN(count) || count <= 0) return;

            const message = (count === 1)
                ? lt('A new item was added. Restart Steam now to apply changes?')
                : lt('{count} new items were added. Restart Steam now to apply changes?').replace('{count}', String(count));

            const doRestart = function() {
                if (typeof scheduleRestartSteam === 'function') {
                    scheduleRestartSteam(3);
                }
            };

            if (typeof showLuaToolsConfirm === 'function') {
                showLuaToolsConfirm(
                    'LuaTools',
                    message,
                    function() { doRestart(); },
                    function() {},
                    { keepOverlay: true, theme: 'grey' }
                );
                return;
            }

            try {
                if (window.confirm(message)) {
                    doRestart();
                }
            } catch(_) {}
        }

        function setStatus(text, isError) {
            statusEl.textContent = String(text || '');
            statusEl.style.color = isError ? '#ff9a9a' : '#b9c4d1';
        }

        function getVisibleItems() {
            return state.items.filter(function(item) {
                const cat = String(item && item.category ? item.category : 'dlc').toLowerCase();
                return cat === state.activeTab;
            });
        }

        function getTabCount(tabName) {
            const target = String(tabName || '').toLowerCase();
            return state.items.filter(function(item) {
                const cat = String(item && item.category ? item.category : 'dlc').toLowerCase();
                return cat === target;
            }).length;
        }

        function isInstallCandidate(item) {
            const target = item || {};
            const inheritedByBase = !!target.inheritedByBase;
            return !target.installedLua && !target.ownedOnSteam && !inheritedByBase;
        }

        function getSelectedVisibleItems() {
            const selected = state.selected || {};
            return getVisibleItems().filter(function(item) {
                return isInstallCandidate(item) && !!selected[String(item.appid)];
            });
        }

        function getSelectedTotalCount() {
            const selected = state.selected || {};
            return state.items.filter(function(item) {
                return isInstallCandidate(item) && !!selected[String(item.appid)];
            }).length;
        }

        function pruneSelection() {
            const selected = state.selected || {};
            const next = {};
            for (let i = 0; i < state.items.length; i++) {
                const item = state.items[i] || {};
                const key = String(item.appid || '');
                if (!key || !selected[key]) continue;
                if (isInstallCandidate(item)) {
                    next[key] = true;
                }
            }
            state.selected = next;
        }

        function updateTabButtons() {
            const dlcCount = getTabCount('dlc');
            const specialCount = getTabCount('special');
            dlcTabBtn.textContent = lt('DLCs') + ' (' + dlcCount + ')';
            specialTabBtn.textContent = lt('Special Content') + ' (' + specialCount + ')';

            const dlcActive = state.activeTab === 'dlc';
            const specialActive = state.activeTab === 'special';

            dlcTabBtn.style.background = dlcActive ? 'rgba(126,126,126,0.92)' : 'rgba(68,68,68,0.85)';
            dlcTabBtn.style.borderColor = dlcActive ? 'rgba(220,220,220,0.65)' : 'rgba(175,175,175,0.45)';
            dlcTabBtn.style.color = dlcActive ? '#ffffff' : '#e4e4e4';

            specialTabBtn.style.background = specialActive ? 'rgba(126,126,126,0.92)' : 'rgba(68,68,68,0.85)';
            specialTabBtn.style.borderColor = specialActive ? 'rgba(220,220,220,0.65)' : 'rgba(175,175,175,0.45)';
            specialTabBtn.style.color = specialActive ? '#ffffff' : '#e4e4e4';

            setPseudoDisabled(dlcTabBtn, state.busy);
            setPseudoDisabled(specialTabBtn, state.busy);
        }

        function updateAddAllButtonLabel() {
            const visible = getVisibleItems();
            const missing = visible.filter(isInstallCandidate).length;
            const selectedVisibleCount = getSelectedVisibleItems().length;
            const selectedTotalCount = getSelectedTotalCount();
            const addAllText = state.activeTab === 'special'
                ? lt('Add All Missing Special Content')
                : lt('Add All Missing DLCs');
            addAllBtn.innerHTML = `<span>${addAllText} (${missing})</span>`;
            addSelectedBtn.innerHTML = `<span>${lt('Add Selected')} (${selectedVisibleCount})</span>`;
            clearSelectedBtn.innerHTML = `<span>${lt('Clear Selected')} (${selectedTotalCount})</span>`;
            setPseudoDisabled(addAllBtn, state.busy || missing === 0 || !state.baseEligible);
            setPseudoDisabled(addSelectedBtn, state.busy || selectedVisibleCount === 0 || !state.baseEligible);
            setPseudoDisabled(clearSelectedBtn, state.busy || selectedTotalCount === 0);
        }

        async function withRunStateLock(task) {
            if (runState.inProgress) {
                setStatus(lt('Another LuaTools operation is already running.'), true);
                return;
            }
            runState.inProgress = true;
            runState.appid = null;
            try {
                await task();
            } finally {
                runState.inProgress = false;
                runState.appid = null;
            }
        }

        function renderList() {
            listWrap.innerHTML = '';
            setPseudoDisabled(closeBtn, state.busy);
            updateTabButtons();
            pruneSelection();
            const visibleItems = getVisibleItems();

            if (!visibleItems.length) {
                const empty = document.createElement('div');
                empty.style.cssText = 'padding:18px 12px;text-align:center;color:#b5beca;font-size:13px;';
                if (state.appType && state.appType !== 'game') {
                    empty.textContent = lt('DLC manager is only available on base game store pages.');
                } else if (state.activeTab === 'special') {
                    empty.textContent = lt('No special content found for this game.');
                } else {
                    empty.textContent = lt('No DLCs found for this game.');
                }
                listWrap.appendChild(empty);
                updateAddAllButtonLabel();
                return;
            }

            for (let i = 0; i < visibleItems.length; i++) {
                const item = visibleItems[i];

                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid rgba(170,170,170,0.2);border-radius:10px;background:rgba(30,34,40,0.55);margin-bottom:8px;';

                const left = document.createElement('div');
                left.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:0;';

                const installedLua = !!item.installedLua;
                const ownedOnSteam = !!item.ownedOnSteam;
                const inheritedByBase = !!item.inheritedByBase;
                const isOwnedOnly = ownedOnSteam && !installedLua;
                const canSelect = isInstallCandidate(item);

                const selector = document.createElement('input');
                selector.type = 'checkbox';
                selector.style.cssText = 'width:16px;height:16px;accent-color:#8f8f8f;cursor:pointer;flex-shrink:0;';
                selector.checked = !!(state.selected && state.selected[String(item.appid)] && canSelect);
                selector.disabled = !canSelect || state.busy || !state.baseEligible;
                selector.onchange = function() {
                    const key = String(item.appid);
                    if (!state.selected) state.selected = {};
                    if (selector.checked && canSelect) {
                        state.selected[key] = true;
                    } else {
                        delete state.selected[key];
                    }
                    updateAddAllButtonLabel();
                };

                const textWrap = document.createElement('div');
                textWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:0;';

                const nameEl = document.createElement('div');
                nameEl.style.cssText = 'font-size:14px;font-weight:700;color:#e7ebf1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
                nameEl.textContent = item.name || ('App ' + item.appid);

                const metaEl = document.createElement('div');
                metaEl.style.cssText = 'font-size:11px;color:#9eaab8;';
                metaEl.textContent = 'AppID ' + item.appid;

                textWrap.appendChild(nameEl);
                textWrap.appendChild(metaEl);
                left.appendChild(selector);
                left.appendChild(textWrap);

                const right = document.createElement('div');
                right.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;';

                const links = document.createElement('div');
                links.style.cssText = 'display:flex;align-items:center;gap:6px;';

                const steamDbBtn = document.createElement('a');
                steamDbBtn.href = '#';
                steamDbBtn.style.cssText = 'padding:5px 8px;border-radius:8px;border:1px solid rgba(170,170,170,0.45);background:rgba(70,70,70,0.62);color:#e4e4e4;text-decoration:none;font-size:11px;font-weight:700;';
                steamDbBtn.textContent = lt('SteamDB');
                steamDbBtn.onclick = function(e) {
                    e.preventDefault();
                    openSteamDbApp(item.appid);
                };

                const storeBtn = document.createElement('a');
                storeBtn.href = '#';
                storeBtn.style.cssText = 'padding:5px 8px;border-radius:8px;border:1px solid rgba(170,170,170,0.45);background:rgba(70,70,70,0.62);color:#e4e4e4;text-decoration:none;font-size:11px;font-weight:700;';
                storeBtn.textContent = lt('Store');
                storeBtn.onclick = function(e) {
                    e.preventDefault();
                    openSteamStore(item.appid);
                };

                links.appendChild(steamDbBtn);
                links.appendChild(storeBtn);

                const badge = document.createElement('div');
                badge.style.cssText = installedLua
                    ? 'padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#c9f0d0;background:rgba(56,145,74,0.24);border:1px solid rgba(94,190,115,0.35);'
                    : (inheritedByBase
                        ? 'padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#d6e8ff;background:rgba(94,120,155,0.26);border:1px solid rgba(132,164,206,0.4);'
                    : (isOwnedOnly
                        ? 'padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#d3d8e0;background:rgba(106,115,128,0.28);border:1px solid rgba(158,171,188,0.35);'
                        : 'padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#d7dde7;background:rgba(132,145,166,0.2);border:1px solid rgba(164,178,201,0.28);'));
                badge.textContent = installedLua
                    ? lt('Added')
                    : (inheritedByBase ? lt('Added via Base') : (isOwnedOnly ? lt('Owned') : lt('Not Added')));

                const actionBtn = document.createElement('a');
                actionBtn.href = '#';
                actionBtn.style.cssText = 'padding:8px 12px;border-radius:10px;border:1px solid rgba(205,205,205,0.45);background:linear-gradient(135deg, rgba(122,122,122,0.75), rgba(86,86,86,0.95));color:#f1f1f1;text-decoration:none;font-size:12px;font-weight:700;';

                if (state.busy && state.activeAppid === item.appid) {
                    actionBtn.textContent = lt('Working…');
                } else {
                    actionBtn.textContent = installedLua ? lt('Remove') : (inheritedByBase ? lt('Base') : (isOwnedOnly ? lt('Owned') : lt('Add')));
                }

                const canMutate = state.baseEligible && !state.busy && !isOwnedOnly && !inheritedByBase;
                setPseudoDisabled(actionBtn, !canMutate);
                actionBtn.onclick = async function(e) {
                    e.preventDefault();
                    if (state.busy || !state.baseEligible || isOwnedOnly || inheritedByBase) return;

                    await withRunStateLock(async function() {
                        state.busy = true;
                        state.activeAppid = item.appid;
                        renderList();
                        setPseudoDisabled(refreshBtn, true);

                        runState.appid = parseInt(item.appid, 10);
                        window.__LuaToolsCurrentAppId = runState.appid;
                        setStatus((item.installedLua ? lt('Removing…') : lt('Adding…')) + ' ' + (item.name || ('App ' + item.appid)));

                        let result = null;
                        if (item.installedLua) {
                            result = await removeLuaToolsForAppById(item.appid);
                        } else {
                            result = await addLuaToolsForAppAndWait(item.appid, {
                                baseAppid: state.appid,
                                baseOwnedOnSteam: state.baseOwnedOnSteam
                            });
                        }

                        if (result && result.success) {
                            item.installedLua = !item.installedLua;
                            const wasAdded = !!item.installedLua;
                            if (item.installedLua) {
                                item.inheritedByBase = false;
                                if (state.selected) {
                                    delete state.selected[String(item.appid)];
                                }
                            } else {
                                item.inheritedByBase = !!(state.baseHasLua && item.baseScriptIncluded);
                            }
                            state.changed = true;
                            setStatus((item.installedLua ? lt('Added') : lt('Removed')) + ': ' + (item.name || ('App ' + item.appid)));
                            if (wasAdded) {
                                promptRestartAfterAdd(1);
                            }
                        } else {
                            const errText = (result && result.error) ? String(result.error) : lt('Failed');
                            setStatus(errText, true);
                        }

                        state.busy = false;
                        state.activeAppid = '';
                        setPseudoDisabled(refreshBtn, false);
                        renderList();
                    });
                };

                right.appendChild(links);
                right.appendChild(badge);
                right.appendChild(actionBtn);
                row.appendChild(left);
                row.appendChild(right);
                listWrap.appendChild(row);
            }

            updateAddAllButtonLabel();
        }

        async function refreshList(showRefreshedMessage) {
            if (state.busy) return;
            setPseudoDisabled(refreshBtn, true);
            setStatus(lt('Loading DLC list…'));
            try {
                const payload = await fetchGameDlcEntries(state.appid);
                state.baseName = payload.baseName || ('App ' + state.appid);
                state.appType = payload.appType || '';
                state.items = Array.isArray(payload.items) ? payload.items : [];
                if (typeof payload.baseHasLua === 'boolean') {
                    state.baseHasLua = payload.baseHasLua;
                } else {
                    state.baseHasLua = await hasLuaToolsForApp(state.appid);
                }
                state.baseOwnedOnSteam = isAppOwnedOnSteam(state.appid);
                state.baseEligible = state.baseHasLua || state.baseOwnedOnSteam;
                pruneSelection();

                const dlcCountNow = state.items.filter(function(item){
                    return String(item && item.category ? item.category : 'dlc').toLowerCase() === 'dlc';
                }).length;
                const specialCountNow = state.items.filter(function(item){
                    return String(item && item.category ? item.category : 'dlc').toLowerCase() === 'special';
                }).length;
                if (state.activeTab === 'dlc' && dlcCountNow === 0 && specialCountNow > 0) {
                    state.activeTab = 'special';
                } else if (state.activeTab === 'special' && specialCountNow === 0 && dlcCountNow > 0) {
                    state.activeTab = 'dlc';
                }

                const count = state.items.length;
                subTitleEl.textContent = state.baseName + ' · ' + String(count) + ' ' + lt('Items');
                renderList();

                if (state.appType && state.appType !== 'game') {
                    setStatus(lt('DLC manager is only available on base game store pages.'), true);
                } else if (!state.baseEligible) {
                    setStatus(lt('Add the base game via LuaTools or own it on Steam to manage DLCs.'), true);
                } else if (!state.items.length) {
                    setStatus(lt('No DLCs found for this game.'));
                } else if (showRefreshedMessage) {
                    setStatus(lt('DLC list refreshed.'));
                } else {
                    setStatus('');
                }
            } catch(err) {
                state.items = [];
                renderList();
                setStatus(lt('Failed to load DLC list.') + ' ' + ((err && err.message) ? err.message : ''), true);
            } finally {
                setPseudoDisabled(refreshBtn, false);
            }
        }

        async function runBatchAdd(targets, successTemplate, emptyErrorText) {
            const list = Array.isArray(targets) ? targets.slice() : [];
            if (!list.length) {
                setStatus(emptyErrorText || lt('No DLCs were added.'), true);
                return;
            }

            await withRunStateLock(async function() {
                state.busy = true;
                let successCount = 0;
                let failedCount = 0;

                setPseudoDisabled(refreshBtn, true);
                renderList();

                for (let i = 0; i < list.length; i++) {
                    const item = list[i];
                    state.activeAppid = item.appid;
                    renderList();

                    runState.appid = parseInt(item.appid, 10);
                    window.__LuaToolsCurrentAppId = runState.appid;
                    setStatus(lt('Adding…') + ' ' + (item.name || ('App ' + item.appid)) + ' (' + (i + 1) + '/' + list.length + ')');

                    const result = await addLuaToolsForAppAndWait(item.appid, {
                        baseAppid: state.appid,
                        baseOwnedOnSteam: state.baseOwnedOnSteam
                    });
                    if (result && result.success) {
                        item.installedLua = true;
                        item.inheritedByBase = false;
                        if (state.selected) {
                            delete state.selected[String(item.appid)];
                        }
                        successCount += 1;
                    } else {
                        failedCount += 1;
                        backendLog('LuaTools: DLC add failed for appid=' + item.appid + ' err=' + ((result && result.error) ? result.error : 'unknown'));
                    }
                }

                state.busy = false;
                state.activeAppid = '';
                state.changed = state.changed || successCount > 0;
                setPseudoDisabled(refreshBtn, false);
                renderList();

                if (successCount > 0) {
                    let summary = String(successTemplate || lt('Added {count} items.')).replace('{count}', String(successCount));
                    if (failedCount > 0) {
                        summary += ' ' + lt('{count} failed.').replace('{count}', String(failedCount));
                    }
                    setStatus(summary, false);
                    promptRestartAfterAdd(successCount);
                } else {
                    setStatus(emptyErrorText || lt('No DLCs were added.'), true);
                }
            });
        }

        addAllBtn.onclick = async function(e) {
            e.preventDefault();
            if (state.busy) return;

            if (!state.baseEligible) {
                setStatus(lt('Add the base game via LuaTools or own it on Steam to manage DLCs.'), true);
                return;
            }

            const targets = getVisibleItems().filter(isInstallCandidate);
            if (!targets.length) {
                setStatus(state.activeTab === 'special' ? lt('All special content is already added.') : lt('All DLCs are already added.'));
                return;
            }

            await runBatchAdd(
                targets,
                (state.activeTab === 'special' ? lt('Added {count} special items.') : lt('Added {count} DLCs.')),
                lt('No DLCs were added.')
            );
        };

        addSelectedBtn.onclick = async function(e) {
            e.preventDefault();
            if (state.busy) return;

            if (!state.baseEligible) {
                setStatus(lt('Add the base game via LuaTools or own it on Steam to manage DLCs.'), true);
                return;
            }

            const selectedTargets = getSelectedVisibleItems();
            if (!selectedTargets.length) {
                setStatus(lt('No selected items to add.'), true);
                return;
            }

            await runBatchAdd(
                selectedTargets,
                lt('Added {count} selected items.'),
                lt('No selected items were added.')
            );
        };

        clearSelectedBtn.onclick = function(e) {
            e.preventDefault();
            if (state.busy) return;
            state.selected = {};
            renderList();
            setStatus(lt('Selection cleared.'));
        };

        refreshBtn.onclick = function(e) {
            e.preventDefault();
            refreshList(true);
        };

        dlcTabBtn.onclick = function(e) {
            e.preventDefault();
            if (state.busy) return;
            state.activeTab = 'dlc';
            renderList();
            if (!state.baseEligible) {
                setStatus(lt('Add the base game via LuaTools or own it on Steam to manage DLCs.'), true);
            } else {
                setStatus('');
            }
        };

        specialTabBtn.onclick = function(e) {
            e.preventDefault();
            if (state.busy) return;
            state.activeTab = 'special';
            renderList();
            if (!state.baseEligible) {
                setStatus(lt('Add the base game via LuaTools or own it on Steam to manage DLCs.'), true);
            } else {
                setStatus('');
            }
        };

        closeBtn.onclick = function(e) {
            e.preventDefault();
            if (state.busy) return;
            overlay.remove();
            if (state.changed) {
                ensureStoreDlcManageButton(state.appid);
            }
        };

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                if (state.busy) return;
                overlay.remove();
                if (state.changed) {
                    ensureStoreDlcManageButton(state.appid);
                }
            }
        });

        refreshList(false);
    }

    function upsertStoreDlcManageButton(appId, dlcCount) {
        if (!isStoreGamePage()) return;
        const container = getPurchaseContainer();
        if (!container) {
            removeStoreDlcManageButton();
            return;
        }

        let btnContainer = document.querySelector('.luatools-store-dlc-button-container');
        if (!btnContainer) {
            btnContainer = document.createElement('div');
            btnContainer.className = 'btn_addtocart btn_packageinfo luatools-store-dlc-button-container';

            const button = document.createElement('span');
            button.setAttribute('data-panel', '{"focusable":true,"clickOnActivate":true}');
            button.setAttribute('role', 'button');
            button.className = 'btn_blue_steamui btn_medium';
            button.style.marginLeft = '2px';
            button.dataset.luatoolsDlcButton = '1';

            const buttonSpan = document.createElement('span');
            buttonSpan.dataset.luatoolsDlcButtonLabel = '1';
            button.appendChild(buttonSpan);
            btnContainer.appendChild(button);

            container.appendChild(btnContainer);
        }

        const button = btnContainer.querySelector('[data-luatools-dlc-button="1"]');
        const buttonSpan = btnContainer.querySelector('[data-luatools-dlc-button-label="1"]');
        const label = lt('Manage DLCs via LuaTools') + ' (' + String(dlcCount) + ')';
        if (buttonSpan) buttonSpan.textContent = label;
        if (button) {
            setSteamTooltip(button, label);
            button.onclick = function() {
                showStoreDlcManager(appId);
            };
        }
    }

    let dlcStoreCheckInFlight = false;
    let dlcStoreCheckAppId = null;
    async function ensureStoreDlcManageButton(appId) {
        const parsed = parseInt(appId, 10);
        if (isNaN(parsed) || !isStoreGamePage()) {
            removeStoreDlcManageButton();
            return;
        }

        if (dlcStoreCheckInFlight && dlcStoreCheckAppId === parsed) return;
        dlcStoreCheckInFlight = true;
        dlcStoreCheckAppId = parsed;
        try {
            const details = await fetchAppDetailsById(parsed);
            const appType = details && details.type ? String(details.type).toLowerCase() : '';
            if (appType !== 'game') {
                removeStoreDlcManageButton();
                return;
            }
            const dlcIds = getDlcAppIdsFromDetails(details);
            if (!dlcIds.length) {
                removeStoreDlcManageButton();
                return;
            }
            upsertStoreDlcManageButton(parsed, dlcIds.length);
        } catch(_) {
            removeStoreDlcManageButton();
        } finally {
            dlcStoreCheckInFlight = false;
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

    let storeSearchFlagSyncTimer = null;
    let storeSearchFlagSyncInFlight = false;
    let storeSearchFlagSyncQueued = false;

    function isStoreSearchListingPage() {
        if (!isSteamStoreHost()) return false;
        const path = String(window.location && window.location.pathname ? window.location.pathname : '');
        if (/^\/search(\/|$)/i.test(path)) return true;
        if (document.body && document.body.classList && document.body.classList.contains('search_page')) return true;
        return !!document.querySelector('#search_resultsRows .search_result_row, #search_resultsRows .tab_item');
    }

    function getStoreSearchRowAppId(row) {
        if (!row) return '';
        const raw = String(row.getAttribute('data-ds-appid') || row.getAttribute('data-appid') || '').split(',')[0].trim();
        if (/^\d+$/.test(raw)) return raw;
        const directHref = row.getAttribute('href');
        const nestedHref = directHref ? '' : ((row.querySelector && row.querySelector('a[href*="/app/"]')) ? row.querySelector('a[href*="/app/"]').getAttribute('href') : '');
        const extracted = extractAppIdFromHref(directHref || nestedHref || '');
        return /^\d+$/.test(extracted) ? extracted : '';
    }

    function removeStoreSearchLuaToolsFlags() {
        document.querySelectorAll('.ds_flag.ds_owned_flag[data-luatools-search-owned="1"]').forEach(function(flag) {
            try { flag.remove(); } catch(_) {}
        });

        document.querySelectorAll('[data-luatools-ds-flagged="1"]').forEach(function(row) {
            try {
                const hasOtherFlags = !!row.querySelector('.ds_flag:not([data-luatools-search-owned="1"])');
                if (!hasOtherFlags) {
                    row.classList.remove('ds_flagged');
                }
                row.removeAttribute('data-luatools-ds-flagged');
            } catch(_) {}
        });

        document.querySelectorAll('[data-luatools-ds-collapse-flag="1"]').forEach(function(row) {
            try {
                row.classList.remove('ds_collapse_flag');
                row.removeAttribute('data-luatools-ds-collapse-flag');
            } catch(_) {}
        });

        document.querySelectorAll('[data-luatools-ds-owned="1"]').forEach(function(row) {
            try {
                row.classList.remove('ds_owned');
                row.removeAttribute('data-luatools-ds-owned');
            } catch(_) {}
        });
    }

    function applyLuaToolsStoreSearchFlagToRow(row, luatoolsAppIds) {
        if (!row) return;
        const appid = getStoreSearchRowAppId(row);
        if (!/^\d+$/.test(appid)) return;

        const shouldFlag = !!(luatoolsAppIds && luatoolsAppIds.has(appid));
        const ownFlag = row.querySelector('.ds_flag.ds_owned_flag[data-luatools-search-owned="1"]');
        const nativeOwnedFlag = row.querySelector('.ds_flag.ds_owned_flag:not([data-luatools-search-owned="1"])');

        if (shouldFlag) {
            if (!row.classList.contains('ds_flagged')) {
                row.classList.add('ds_flagged');
                row.setAttribute('data-luatools-ds-flagged', '1');
            }
            if (!row.classList.contains('ds_collapse_flag')) {
                row.classList.add('ds_collapse_flag');
                row.setAttribute('data-luatools-ds-collapse-flag', '1');
            }
            if (nativeOwnedFlag) {
                if (ownFlag) {
                    try { ownFlag.remove(); } catch(_) {}
                }
                if (row.getAttribute('data-luatools-ds-owned') === '1') {
                    row.classList.remove('ds_owned');
                    row.removeAttribute('data-luatools-ds-owned');
                }
                return;
            }
            if (!row.classList.contains('ds_owned')) {
                row.classList.add('ds_owned');
                row.setAttribute('data-luatools-ds-owned', '1');
            }
            if (!ownFlag) {
                const flag = document.createElement('div');
                flag.className = 'ds_flag ds_owned_flag';
                flag.setAttribute('data-luatools-search-owned', '1');
                flag.innerHTML = 'IN LIBRARY&nbsp;&nbsp;';
                row.appendChild(flag);
            }
            return;
        }

        if (ownFlag) {
            try { ownFlag.remove(); } catch(_) {}
        }
        if (row.getAttribute('data-luatools-ds-flagged') === '1') {
            const hasOtherFlags = !!row.querySelector('.ds_flag:not([data-luatools-search-owned="1"])');
            if (!hasOtherFlags) {
                row.classList.remove('ds_flagged');
            }
            row.removeAttribute('data-luatools-ds-flagged');
        }
        if (row.getAttribute('data-luatools-ds-collapse-flag') === '1') {
            row.classList.remove('ds_collapse_flag');
            row.removeAttribute('data-luatools-ds-collapse-flag');
        }
        if (row.getAttribute('data-luatools-ds-owned') === '1') {
            row.classList.remove('ds_owned');
            row.removeAttribute('data-luatools-ds-owned');
        }
    }

    function applyLuaToolsStoreSearchFlagsToRows(rows, luatoolsAppIds) {
        const list = rows ? Array.from(rows) : [];
        for (let r = 0; r < list.length; r++) {
            applyLuaToolsStoreSearchFlagToRow(list[r], luatoolsAppIds);
        }
    }

    function areStringSetsEqual(a, b) {
        const aSet = a instanceof Set ? a : new Set();
        const bSet = b instanceof Set ? b : new Set();
        if (aSet.size !== bSet.size) return false;
        for (const value of aSet) {
            if (!bSet.has(value)) return false;
        }
        return true;
    }

    async function syncLuaToolsStoreSearchFlags() {
        if (!isStoreSearchListingPage()) {
            removeStoreSearchLuaToolsFlags();
            return;
        }

        const rows = document.querySelectorAll('#search_resultsRows .search_result_row, #search_resultsRows .tab_item');
        if (!rows.length) {
            removeStoreSearchLuaToolsFlags();
            return;
        }

        let quickIds = new Set();
        const cache = getInstalledLuaScriptsCache();
        if (Array.isArray(cache.entries) && cache.entries.length) {
            quickIds = buildInstalledLuaIdSet(cache.entries);
        } else {
            quickIds = readInstalledLuaIdSnapshotSet();
        }
        if (quickIds.size || document.querySelector('.ds_flag.ds_owned_flag[data-luatools-search-owned="1"]')) {
            applyLuaToolsStoreSearchFlagsToRows(rows, quickIds);
        }

        const entries = await getInstalledLuaScriptEntries(false);
        const ids = buildInstalledLuaIdSet(entries);
        writeInstalledLuaIdSnapshotSet(ids);

        if (!areStringSetsEqual(quickIds, ids)) {
            applyLuaToolsStoreSearchFlagsToRows(rows, ids);
        }
    }

    function scheduleLuaToolsStoreSearchFlagSync(delayMs) {
        const delay = typeof delayMs === 'number' ? Math.max(0, Math.floor(delayMs)) : 120;
        if (storeSearchFlagSyncTimer) {
            clearTimeout(storeSearchFlagSyncTimer);
        }
        storeSearchFlagSyncTimer = setTimeout(function() {
            storeSearchFlagSyncTimer = null;
            if (storeSearchFlagSyncInFlight) {
                storeSearchFlagSyncQueued = true;
                return;
            }
            storeSearchFlagSyncInFlight = true;
            syncLuaToolsStoreSearchFlags()
                .catch(function(){})
                .finally(function() {
                    storeSearchFlagSyncInFlight = false;
                    if (storeSearchFlagSyncQueued) {
                        storeSearchFlagSyncQueued = false;
                        scheduleLuaToolsStoreSearchFlagSync(0);
                    }
                });
        }, delay);
    }

    function clearStoreUiForNonStorePage() {
        document.querySelectorAll('.luatools-store-button-container, .luatools-store-dlc-button-container').forEach(function(btn) {
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
                invalidateInstalledLuaScriptsCache();
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
                            invalidateInstalledLuaScriptsCache();
                            removeLuaToolsLibraryBanners();
                            const storeBtn = document.querySelector('.luatools-store-button-container');
                            if (storeBtn && storeBtn.parentElement) storeBtn.parentElement.removeChild(storeBtn);
                            createStoreAddButton(appId);
                            const successText = t('menu.remove.success', 'LuaTools removed for this app.');
                            if (typeof ShowLuaToolsAlert === 'function') {
                                ShowLuaToolsAlert('LuaTools', successText);
                            }
                            if (typeof scheduleRestartSteam === 'function') {
                                scheduleRestartSteam(3);
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
            doRemove();
        };

        container.appendChild(btnContainer);
    }

    let storeCheckInFlight = false;
    let storeCheckAppId = null;
    let bundleStoreCheckInFlight = false;
    let bundleStoreCheckKey = '';
    async function ensureStoreAddButton() {
        scheduleLuaToolsStoreSearchFlagSync(0);
        if (!isBundlePage() && !isStoreGamePage()) {
            clearStoreUiForNonStorePage();
            storeCheckInFlight = false;
            storeCheckAppId = null;
            dlcStoreCheckInFlight = false;
            dlcStoreCheckAppId = null;
            return;
        }

        const existing = document.querySelector('.luatools-store-button-container');
        if (isBundlePage()) {
            removeStoreDlcManageButton();
            dlcStoreCheckInFlight = false;
            dlcStoreCheckAppId = null;
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
        if (!appId) {
            removeStoreDlcManageButton();
            return;
        }
        ensureStoreDlcManageButton(appId);
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
    if (isSteamStoreHost()) {
        getInstalledLuaScriptEntries(false)
            .then(function(entries) {
                writeInstalledLuaIdSnapshotEntries(entries);
                scheduleLuaToolsStoreSearchFlagSync(0);
            })
            .catch(function(){});
    }

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
    
    

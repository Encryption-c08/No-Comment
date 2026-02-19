    function showSettingsPopup() {
        if (settingsMenuPending) return;
        settingsMenuPending = true;
        ensureTranslationsLoaded(false).catch(function(){ return null; }).finally(function(){
            settingsMenuPending = false;
            try { const d = document.querySelector('.luatools-overlay'); if (d) d.remove(); } catch(_) {}
            ensureLuaToolsStyles();
            ensureFontAwesome();
            const tools = ensureToolsWidget();
            if (!tools || !tools.panel) return;
            const panel = tools.panel;
            const launcher = tools.launcher;

            if (panel.classList.contains('is-open')) {
                closeToolsMenu();
                return;
            }

            panel.innerHTML = '';

            const header = document.createElement('div');
            header.className = 'luatools-tools-header';

            const title = document.createElement('div');
            title.className = 'luatools-tools-title';
            title.textContent = t('menu.toolsTitle', 'Tools');

            const iconButtons = document.createElement('div');
            iconButtons.className = 'luatools-tools-actions';

            function createIconButton(id, iconClass, titleKey, titleFallback) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.id = id;
                btn.className = 'luatools-tools-icon-btn';
                const label = t(titleKey, titleFallback);
                btn.title = label;
                btn.setAttribute('aria-label', label);
                btn.innerHTML = '<i class="fa-solid ' + iconClass + '"></i>';
                iconButtons.appendChild(btn);
                return btn;
            }

            const body = document.createElement('div');
            body.className = 'luatools-tools-body';

            const container = document.createElement('div');
            container.className = 'luatools-tools-content';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '10px';

            function createSectionLabel(key, fallback, marginTop) {
                const label = document.createElement('div');
                const topValue = typeof marginTop === 'number' ? marginTop : 8;
                label.className = 'luatools-tools-section';
                label.style.marginTop = topValue + 'px';
                label.textContent = t(key, fallback);
                container.appendChild(label);
                return label;
            }

            function setDailyUsageDisplay(target, count, limit, remaining, resetText) {
                if (!target) return;
                const safeLimit = (typeof limit === 'number' && limit > 0) ? limit : 25;
                const safeCount = (typeof count === 'number' && count >= 0) ? count : 0;
                const safeRemaining = (typeof remaining === 'number' && remaining >= 0) ? remaining : Math.max(0, safeLimit - safeCount);
                target.textContent = safeCount + '/' + safeLimit + ' (24h)';
                const title = safeRemaining + ' left in current 24h window' + (resetText ? ('\nResets: ' + resetText) : '');
                target.title = title;
                target.setAttribute('aria-label', title);
            }

            function createMenuButton(id, key, fallback, iconClass, isPrimary) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.id = id;
                btn.className = 'luatools-tools-action';
                const iconHtml = iconClass ? '<i class="fa-solid ' + iconClass + '"></i>' : '';
                btn.innerHTML = iconHtml + '<span>' + t(key, fallback) + '</span>';
                container.appendChild(btn);
                return btn;
            }

            const settingsManagerBtn = createIconButton('lt-settings-open-manager', 'fa-gear', 'menu.settings', 'Settings');
            const closeBtn = createIconButton('lt-settings-close', 'fa-xmark', 'settings.close', 'Close');

            const manageSectionRow = document.createElement('div');
            manageSectionRow.className = 'luatools-tools-section-row';
            const manageSectionLabel = document.createElement('div');
            manageSectionLabel.className = 'luatools-tools-section';
            manageSectionLabel.style.marginTop = '0';
            manageSectionLabel.textContent = t('menu.manageGameLabel', 'Manage Game');
            const manageUsageBadge = document.createElement('div');
            manageUsageBadge.className = 'luatools-tools-usage';
            manageSectionRow.appendChild(manageSectionLabel);
            manageSectionRow.appendChild(manageUsageBadge);
            container.appendChild(manageSectionRow);
            setDailyUsageDisplay(manageUsageBadge, 0, 25, 25, '');

            function refreshDailyAddUsage() {
                try {
                    if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                        setDailyUsageDisplay(manageUsageBadge, 0, 25, 25, '');
                        return;
                    }
                    Millennium.callServerMethod('luatools', 'GetDailyAddUsage', { contentScriptQuery: '' }).then(function(res){
                        try {
                            const payload = typeof res === 'string' ? JSON.parse(res) : res;
                            if (!payload || payload.success !== true) {
                                return;
                            }
                            const count = Number(payload.count);
                            const limit = Number(payload.limit);
                            const remaining = Number(payload.remaining);
                            const resetText = payload.reset ? String(payload.reset) : '';
                            setDailyUsageDisplay(manageUsageBadge, count, limit, remaining, resetText);
                        } catch(_) {}
                    }).catch(function(){});
                } catch(_) {}
            }
            refreshDailyAddUsage();

            const addGameBtn = createMenuButton('lt-settings-add-game', 'Add via LuaTools', 'Add via LuaTools', 'fa-plus');
            const removeBtn = createMenuButton('lt-settings-remove-lua', 'menu.removeLuaTools', 'Remove via LuaTools', 'fa-trash-can');
            removeBtn.style.display = 'none';

            function getSettingsMenuAppId() {
                const current = getCurrentAppId();
                if (typeof current === 'number' && !isNaN(current)) return current;
                const cached = parseInt(window.__LuaToolsCurrentAppId, 10);
                if (!isNaN(cached)) return cached;
                return NaN;
            }

            const fixesMenuBtn = createMenuButton('lt-settings-fixes-menu', 'menu.fixesMenu', 'Fixes Menu', 'fa-wrench');

            createSectionLabel('menu.steamdbSearchLabel', 'SteamDB Search', 10);
            const searchWrap = document.createElement('div');
            searchWrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
            const searchInput = document.createElement('input');
            searchInput.className = 'luatools-search-input';
            searchInput.type = 'text';
            searchInput.placeholder = t('menu.steamdbSearchPlaceholder', 'Game name or AppID...');
            const searchRow = document.createElement('div');
            searchRow.className = 'luatools-search-row';
            const searchBtn = document.createElement('button');
            searchBtn.type = 'button';
            searchBtn.className = 'luatools-search-btn primary';
            searchBtn.textContent = t('menu.search', 'Search');
            const steamdbBtn = document.createElement('button');
            steamdbBtn.type = 'button';
            steamdbBtn.className = 'luatools-search-btn';
            steamdbBtn.textContent = t('menu.openSteamDB', 'Open SteamDB');
            searchRow.appendChild(searchBtn);
            searchRow.appendChild(steamdbBtn);
            const results = document.createElement('div');
            results.className = 'luatools-search-results';
            const empty = document.createElement('div');
            empty.className = 'luatools-search-empty';
            empty.style.marginTop = '4px';
            empty.textContent = t('menu.searchHint', 'Type a name or AppID to search.');
            results.appendChild(empty);
            searchWrap.appendChild(searchInput);
            searchWrap.appendChild(searchRow);
            searchWrap.appendChild(results);
            container.appendChild(searchWrap);

            createSectionLabel('menu.advancedLabel', 'Advanced');
            const restartBtn = createMenuButton('lt-settings-restart-steam', 'menu.restartSteam', 'Restart Steam', 'fa-power-off');
            const fetchApisBtn = createMenuButton('lt-settings-fetch-apis', 'menu.fetchFreeApis', 'Fetch Free APIs', 'fa-server');
            const checkUpdatesBtn = createMenuButton('lt-settings-check-updates', 'menu.checkUpdates', 'Check for updates', 'fa-arrows-rotate');

            body.appendChild(container);

            header.appendChild(title);
            header.appendChild(iconButtons);
            panel.appendChild(header);
            panel.appendChild(body);

            panel.classList.add('is-open');
            panel.setAttribute('aria-hidden', 'false');
            if (launcher) {
                launcher.classList.add('is-open');
                launcher.setAttribute('aria-expanded', 'true');
                animateToolsLauncher(launcher);
            }

            if (restartBtn) {
                restartBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    try { Millennium.callServerMethod('luatools', 'RestartSteam', { contentScriptQuery: '' }); } catch(_) {}
                });
            }

            function renderSearchResults(items) {
                results.innerHTML = '';
                if (!items || !items.length) {
                    const no = document.createElement('div');
                    no.className = 'luatools-search-empty';
                    no.textContent = t('menu.searchNoResults', 'No results found.');
                    results.appendChild(no);
                    return;
                }
                items.forEach(function(it) {
                    const row = document.createElement('div');
                    row.className = 'luatools-search-item';
                    const left = document.createElement('div');
                    const title = document.createElement('div');
                    title.className = 'luatools-search-title';
                    title.textContent = it.name;
                    const meta = document.createElement('div');
                    meta.className = 'luatools-search-meta';
                    meta.textContent = 'AppID ' + it.appid;
                    left.appendChild(title);
                    left.appendChild(meta);
                    const actions = document.createElement('div');
                    actions.className = 'luatools-search-actions';
                    const openBtn = document.createElement('button');
                    openBtn.type = 'button';
                    openBtn.className = 'luatools-search-btn primary';
                    openBtn.style.flex = '0 0 auto';
                    openBtn.style.padding = '6px 10px';
                    openBtn.textContent = t('menu.openStore', 'Open');
                    openBtn.onclick = function(){ openSteamStore(it.appid); };
                    const dbBtn = document.createElement('button');
                    dbBtn.type = 'button';
                    dbBtn.className = 'luatools-search-btn';
                    dbBtn.style.flex = '0 0 auto';
                    dbBtn.style.padding = '6px 10px';
                    dbBtn.textContent = 'SteamDB';
                    dbBtn.onclick = function(){ openSteamDbApp(it.appid); };
                    actions.appendChild(openBtn);
                    actions.appendChild(dbBtn);
                    row.appendChild(left);
                    row.appendChild(actions);
                    results.appendChild(row);
                });
            }

            async function runSearch() {
                const term = (searchInput.value || '').trim();
                if (!term) return;
                if (/^\d+$/.test(term)) {
                    results.innerHTML = '';
                    const loading = document.createElement('div');
                    loading.className = 'luatools-search-empty';
                    loading.textContent = t('menu.searchLoading', 'Searching…');
                    results.appendChild(loading);
                    const appid = term;
                    let name = 'App ' + appid;
                    try {
                        const fetched = await fetchAppNameById(appid);
                        if (fetched) name = fetched;
                    } catch(_) {}
                    renderSearchResults([{ appid: appid, name: name }]);
                    return;
                }
                results.innerHTML = '';
                const loading = document.createElement('div');
                loading.className = 'luatools-search-empty';
                loading.textContent = t('menu.searchLoading', 'Searching…');
                results.appendChild(loading);
                try {
                    const items = await fetchSteamSearch(term);
                    renderSearchResults(items);
                } catch (_) {
                    const msg = document.createElement('div');
                    msg.className = 'luatools-search-empty';
                    msg.textContent = t('menu.searchFailed', 'Search failed. Try SteamDB search.');
                    results.innerHTML = '';
                    results.appendChild(msg);
                }
            }

            searchBtn.addEventListener('click', function(e){
                e.preventDefault();
                runSearch();
            });
            steamdbBtn.addEventListener('click', function(e){
                e.preventDefault();
                const term = (searchInput.value || '').trim();
                if (!term) return;
                if (/^\d+$/.test(term)) openSteamDbApp(term);
                else openSteamDbSearch(term);
            });
            searchInput.addEventListener('keydown', function(e){
                if (e.key === 'Enter') {
                    e.preventDefault();
                    runSearch();
                }
            });

            if (fetchApisBtn) {
                fetchApisBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    try {
                        Millennium.callServerMethod('luatools', 'FetchFreeApisNow', { contentScriptQuery: '' }).then(function(res){
                            try {
                                const payload = typeof res === 'string' ? JSON.parse(res) : res;
                                const ok = payload && payload.success;
                                const count = payload && payload.count;
                                const successText = lt('Loaded free APIs: {count}').replace('{count}', (count != null ? count : '?'));
                                const failText = (payload && payload.error) ? String(payload.error) : lt('Failed to load free APIs.');
                                const text = ok ? successText : failText;
                                ShowLuaToolsAlert('LuaTools', text);
                            } catch(_) {}
                        });
                    } catch(_) {}
                });
            }

            if (checkUpdatesBtn) {
                checkUpdatesBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    try {
                        Millennium.callServerMethod('luatools', 'CheckForUpdatesNow', { contentScriptQuery: '' }).then(function(res){
                            try {
                                const payload = typeof res === 'string' ? JSON.parse(res) : res;
                                if (payload && payload.success) {
                                    const message = payload.message || '';
                                    if (message) {
                                        ShowLuaToolsAlert('LuaTools', message);
                                    } else {
                                        ShowLuaToolsAlert('LuaTools', t('menu.updatesNone', 'No updates available.'));
                                    }
                                } else {
                                    const errText = (payload && payload.error) ? String(payload.error) : t('menu.updatesCheckFailed', 'Update check failed.');
                                    ShowLuaToolsAlert('LuaTools', errText);
                                }
                            } catch(err) {
                                const msg = (err && err.message) ? err.message : t('menu.updatesCheckFailed', 'Update check failed.');
                                ShowLuaToolsAlert('LuaTools', msg);
                            }
                        }).catch(function(err){
                            const msg = (err && err.message) ? err.message : t('menu.updatesCheckFailed', 'Update check failed.');
                            ShowLuaToolsAlert('LuaTools', msg);
                        });
                    } catch(err) {
                        backendLog('LuaTools: Check updates error: ' + err);
                    }
                });
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    closeToolsMenu();
                });
            }

            if (settingsManagerBtn) { 
                settingsManagerBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    showSettingsManagerPopup(false, showSettingsPopup);
                });
            }

            if (fixesMenuBtn) {
                fixesMenuBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    try {
                        const appid = getSettingsMenuAppId();
                        if (isNaN(appid)) {
                            const errText = t('menu.error.noAppId', 'Could not determine game AppID');
                            ShowLuaToolsAlert('LuaTools', errText);
                            return;
                        }

                        Millennium.callServerMethod('luatools', 'GetGameInstallPath', { appid, contentScriptQuery: '' }).then(function(pathRes){
                            try {
                                let isGameInstalled = false;
                                const pathPayload = typeof pathRes === 'string' ? JSON.parse(pathRes) : pathRes;
                                if (pathPayload && pathPayload.success && pathPayload.installPath) {
                                    isGameInstalled = true;
                                    window.__LuaToolsGameInstallPath = pathPayload.installPath;
                                }
                                window.__LuaToolsGameIsInstalled = isGameInstalled;
                                showFixesLoadingPopupAndCheck(appid);
                            } catch(err) {
                                backendLog('LuaTools: GetGameInstallPath error: ' + err);
                            }
                        }).catch(function() {
                            const errorText = t('menu.error.getPath', 'Error getting game path');
                            ShowLuaToolsAlert('LuaTools', errorText);
                        });
                    } catch(err) {
                        backendLog('LuaTools: Fixes Menu button error: ' + err);
                    }
                });
            }

            if (addGameBtn) {
                addGameBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    if (runState.inProgress) return;
                    try {
                        const appid = getSettingsMenuAppId();
                        if (isNaN(appid)) {
                            const errText = t('menu.error.noAppId', 'Could not determine game AppID');
                            ShowLuaToolsAlert('LuaTools', errText);
                            return;
                        }
                        runState.inProgress = true;
                        runState.appid = appid;
                        showTestPopup();
                        Millennium.callServerMethod('luatools', 'StartAddViaLuaTools', { appid: appid, contentScriptQuery: '' });
                        setTimeout(refreshDailyAddUsage, 600);
                        startPolling(appid);
                    } catch(err) {
                        backendLog('LuaTools: Add Game button error: ' + err);
                    }
                });
            }

            try {
                const appid = getSettingsMenuAppId();
                if (isNaN(appid)) {
                    if (addGameBtn) addGameBtn.style.display = 'none';
                    removeBtn.style.display = 'none';
                } else if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                    if (addGameBtn) addGameBtn.style.display = 'flex';
                    removeBtn.style.display = 'none';
                    Millennium.callServerMethod('luatools', 'HasLuaToolsForApp', { appid, contentScriptQuery: '' }).then(function(res){
                        try {
                            const payload = typeof res === 'string' ? JSON.parse(res) : res;
                            const exists = !!(payload && payload.success && payload.exists === true);
                            if (exists) {
                                const doDelete = function() {
                                    try {
                                        Millennium.callServerMethod('luatools', 'DeleteLuaToolsForApp', { appid, contentScriptQuery: '' }).then(function(){
                                            try {
                                                window.__LuaToolsButtonInserted = false;
                                                window.__LuaToolsPresenceCheckInFlight = false;
                                                window.__LuaToolsPresenceCheckAppId = undefined;
                                                addLuaToolsButton();
                                                const successText = t('menu.remove.success', 'LuaTools removed for this app.');
                                                ShowLuaToolsAlert('LuaTools', successText);
                                            } catch(err) {
                                                backendLog('LuaTools: post-delete cleanup failed: ' + err);
                                            }
                                        }).catch(function(err){
                                            const failureText = t('menu.remove.failure', 'Failed to remove LuaTools.');
                                            const errMsg = (err && err.message) ? err.message : failureText;
                                            ShowLuaToolsAlert('LuaTools', errMsg);
                                        });
                                    } catch(err) {
                                        backendLog('LuaTools: doDelete failed: ' + err);
                                    }
                                };

                                if (addGameBtn) addGameBtn.style.display = 'none';
                                removeBtn.style.display = 'flex';
                                removeBtn.onclick = function(e){
                                    e.preventDefault();
                                    const confirmMessage = t('menu.remove.confirm', 'Remove via LuaTools for this game?');
                                    showLuaToolsConfirm('LuaTools', confirmMessage, function(){
                                        doDelete();
                                    }, function(){
                                        try { showSettingsPopup(); } catch(_) {}
                                    });
                                };
                            } else {
                                removeBtn.style.display = 'none';
                                if (addGameBtn) addGameBtn.style.display = 'flex';
                            }
                        } catch(_) {}
                    });
                } else {
                    if (addGameBtn) addGameBtn.style.display = 'flex';
                    removeBtn.style.display = 'none';
                }
            } catch(_) {
                if (addGameBtn) addGameBtn.style.display = 'none';
                removeBtn.style.display = 'none';
            }
        });
    }

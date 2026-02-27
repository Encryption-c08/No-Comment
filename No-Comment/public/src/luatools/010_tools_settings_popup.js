    function showSettingsPopup() {
        if (settingsMenuPending) return;
        settingsMenuPending = true;
        ensureTranslationsLoaded(false).catch(function(){ return null; }).finally(function(){
            settingsMenuPending = false;
            try { const d = document.querySelector('.NoComment-overlay'); if (d) d.remove(); } catch(_) {}
            ensureNoCommentStyles();
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
            header.className = 'NoComment-tools-header';

            const title = document.createElement('div');
            title.className = 'NoComment-tools-title';
            title.textContent = t('menu.toolsTitle', 'Tools');

            const iconButtons = document.createElement('div');
            iconButtons.className = 'NoComment-tools-actions';

            function createIconButton(id, iconClass, titleKey, titleFallback) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.id = id;
                btn.className = 'NoComment-tools-icon-btn';
                const label = t(titleKey, titleFallback);
                btn.title = label;
                btn.setAttribute('aria-label', label);
                if (typeof createNoCommentIcon === 'function') {
                    btn.appendChild(createNoCommentIcon('fa-solid ' + iconClass));
                } else {
                    btn.textContent = '*';
                }
                iconButtons.appendChild(btn);
                return btn;
            }

            const body = document.createElement('div');
            body.className = 'NoComment-tools-body';

            const container = document.createElement('div');
            container.className = 'NoComment-tools-content';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '10px';

            function createSectionLabel(key, fallback, marginTop) {
                const label = document.createElement('div');
                const topValue = typeof marginTop === 'number' ? marginTop : 8;
                label.className = 'NoComment-tools-section';
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
                btn.className = 'NoComment-tools-action';
                if (iconClass) {
                    if (typeof createNoCommentIcon === 'function') {
                        btn.appendChild(createNoCommentIcon('fa-solid ' + iconClass));
                    } else {
                        const fallbackIcon = document.createElement('span');
                        fallbackIcon.className = 'NoComment-inline-icon';
                        fallbackIcon.textContent = '*';
                        btn.appendChild(fallbackIcon);
                    }
                }
                const textSpan = document.createElement('span');
                textSpan.textContent = t(key, fallback);
                btn.appendChild(textSpan);
                container.appendChild(btn);
                return btn;
            }

            const settingsManagerBtn = createIconButton('lt-settings-open-manager', 'fa-gear', 'menu.settings', 'Settings');
            const closeBtn = createIconButton('lt-settings-close', 'fa-xmark', 'settings.close', 'Close');

            const manageSectionRow = document.createElement('div');
            manageSectionRow.className = 'NoComment-tools-section-row';
            const manageSectionLabel = document.createElement('div');
            manageSectionLabel.className = 'NoComment-tools-section';
            manageSectionLabel.style.marginTop = '0';
            manageSectionLabel.textContent = t('menu.manageGameLabel', 'Manage Game');
            const manageUsageBadge = document.createElement('div');
            manageUsageBadge.className = 'NoComment-tools-usage';
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
                    Millennium.callServerMethod('No-Comment', 'GetDailyAddUsage', { contentScriptQuery: '' }).then(function(res){
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

            const addGameBtn = createMenuButton('lt-settings-add-game', 'Add via NoComment', 'Add via NoComment', 'fa-plus');
            const removeBtn = createMenuButton('lt-settings-remove-lua', 'menu.removeNoComment', 'Remove via NoComment', 'fa-trash-can');
            const refreshCacheBtn = createMenuButton(
                'lt-settings-refresh-cache',
                'menu.refreshGameCache',
                'Refresh game cache',
                'fa-arrows-rotate'
            );
            removeBtn.style.display = 'none';
            refreshCacheBtn.style.display = 'none';

            function getSettingsMenuAppId() {
                const current = getCurrentAppId();
                if (typeof current === 'number' && !isNaN(current)) return current;
                const cached = parseInt(window.__NoCommentCurrentAppId, 10);
                if (!isNaN(cached)) return cached;
                return NaN;
            }

            const fixesMenuBtn = createMenuButton('lt-settings-fixes-menu', 'menu.fixesMenu', 'Fixes Menu', 'fa-wrench');

            createSectionLabel('menu.steamdbSearchLabel', 'SteamDB Search', 10);
            const searchWrap = document.createElement('div');
            searchWrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
            const searchInput = document.createElement('input');
            searchInput.className = 'NoComment-search-input';
            searchInput.type = 'text';
            searchInput.placeholder = t('menu.steamdbSearchPlaceholder', 'Game name or AppID...');
            const searchRow = document.createElement('div');
            searchRow.className = 'NoComment-search-row';
            const searchBtn = document.createElement('button');
            searchBtn.type = 'button';
            searchBtn.className = 'NoComment-search-btn primary';
            searchBtn.textContent = t('menu.search', 'Search');
            const steamdbBtn = document.createElement('button');
            steamdbBtn.type = 'button';
            steamdbBtn.className = 'NoComment-search-btn';
            steamdbBtn.textContent = t('menu.openSteamDB', 'Open SteamDB');
            searchRow.appendChild(searchBtn);
            searchRow.appendChild(steamdbBtn);
            const results = document.createElement('div');
            results.className = 'NoComment-search-results';
            const empty = document.createElement('div');
            empty.className = 'NoComment-search-empty';
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
            if (typeof positionToolsPanel === 'function') {
                positionToolsPanel(panel, launcher);
                setTimeout(function() {
                    positionToolsPanel(panel, launcher);
                }, 30);
            }
            if (launcher) {
                launcher.classList.add('is-open');
                launcher.setAttribute('aria-expanded', 'true');
                animateToolsLauncher(launcher);
            }

            if (restartBtn) {
                restartBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    try { Millennium.callServerMethod('No-Comment', 'RestartSteam', { contentScriptQuery: '' }); } catch(_) {}
                });
            }

            function renderSearchResults(items) {
                results.innerHTML = '';
                if (!items || !items.length) {
                    const no = document.createElement('div');
                    no.className = 'NoComment-search-empty';
                    no.textContent = t('menu.searchNoResults', 'No results found.');
                    results.appendChild(no);
                    return;
                }
                items.forEach(function(it) {
                    const row = document.createElement('div');
                    row.className = 'NoComment-search-item';
                    const left = document.createElement('div');
                    const title = document.createElement('div');
                    title.className = 'NoComment-search-title';
                    title.textContent = it.name;
                    const meta = document.createElement('div');
                    meta.className = 'NoComment-search-meta';
                    meta.textContent = 'AppID ' + it.appid;
                    left.appendChild(title);
                    left.appendChild(meta);
                    const actions = document.createElement('div');
                    actions.className = 'NoComment-search-actions';
                    const openBtn = document.createElement('button');
                    openBtn.type = 'button';
                    openBtn.className = 'NoComment-search-btn primary';
                    openBtn.style.flex = '0 0 auto';
                    openBtn.style.padding = '6px 10px';
                    openBtn.textContent = t('menu.openStore', 'Open');
                    openBtn.onclick = function(){ openSteamStore(it.appid); };
                    const dbBtn = document.createElement('button');
                    dbBtn.type = 'button';
                    dbBtn.className = 'NoComment-search-btn';
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
                const rawTerm = (searchInput.value || '').trim();
                if (!rawTerm) return;
                const appidFromInput = extractSteamAppId(rawTerm);
                if (appidFromInput) {
                    if (appidFromInput !== rawTerm) {
                        searchInput.value = appidFromInput;
                    }
                    results.innerHTML = '';
                    const loading = document.createElement('div');
                    loading.className = 'NoComment-search-empty';
                    loading.textContent = t('menu.searchLoading', 'Searching…');
                    results.appendChild(loading);
                    const appid = appidFromInput;
                    let name = 'App ' + appid;
                    try {
                        const fetched = await fetchAppNameById(appid);
                        if (fetched) name = fetched;
                    } catch(_) {}
                    renderSearchResults([{ appid: appid, name: name }]);
                    return;
                }
                const term = rawTerm;
                results.innerHTML = '';
                const loading = document.createElement('div');
                loading.className = 'NoComment-search-empty';
                loading.textContent = t('menu.searchLoading', 'Searching…');
                results.appendChild(loading);
                try {
                    const items = await fetchSteamSearch(term);
                    renderSearchResults(items);
                } catch (_) {
                    const msg = document.createElement('div');
                    msg.className = 'NoComment-search-empty';
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
                const rawTerm = (searchInput.value || '').trim();
                if (!rawTerm) return;
                const appidFromInput = extractSteamAppId(rawTerm);
                if (appidFromInput) {
                    if (appidFromInput !== rawTerm) {
                        searchInput.value = appidFromInput;
                    }
                    openSteamDbApp(appidFromInput);
                    return;
                }
                openSteamDbSearch(rawTerm);
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
                        Millennium.callServerMethod('No-Comment', 'FetchFreeApisNow', { contentScriptQuery: '' }).then(function(res){
                            try {
                                const payload = typeof res === 'string' ? JSON.parse(res) : res;
                                const ok = payload && payload.success;
                                const count = payload && payload.count;
                                const successText = lt('Loaded free APIs: {count}').replace('{count}', (count != null ? count : '?'));
                                const failText = (payload && payload.error) ? String(payload.error) : lt('Failed to load free APIs.');
                                const text = ok ? successText : failText;
                                ShowNoCommentAlert('No-Comment', text);
                            } catch(_) {}
                        });
                    } catch(_) {}
                });
            }

            if (checkUpdatesBtn) {
                checkUpdatesBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    try {
                        Millennium.callServerMethod('No-Comment', 'CheckForUpdatesNow', { contentScriptQuery: '' }).then(function(res){
                            try {
                                const payload = typeof res === 'string' ? JSON.parse(res) : res;
                                if (payload && payload.success) {
                                    const message = payload.message || '';
                                    if (message) {
                                        ShowNoCommentAlert('No-Comment', message);
                                    } else {
                                        ShowNoCommentAlert('No-Comment', t('menu.updatesNone', 'No updates available.'));
                                    }
                                } else {
                                    const errText = (payload && payload.error) ? String(payload.error) : t('menu.updatesCheckFailed', 'Update check failed.');
                                    ShowNoCommentAlert('No-Comment', errText);
                                }
                            } catch(err) {
                                const msg = (err && err.message) ? err.message : t('menu.updatesCheckFailed', 'Update check failed.');
                                ShowNoCommentAlert('No-Comment', msg);
                            }
                        }).catch(function(err){
                            const msg = (err && err.message) ? err.message : t('menu.updatesCheckFailed', 'Update check failed.');
                            ShowNoCommentAlert('No-Comment', msg);
                        });
                    } catch(err) {
                        backendLog('NoComment: Check updates error: ' + err);
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
                            ShowNoCommentAlert('No-Comment', errText);
                            return;
                        }

                        Millennium.callServerMethod('No-Comment', 'GetGameInstallPath', { appid, contentScriptQuery: '' }).then(function(pathRes){
                            try {
                                let isGameInstalled = false;
                                const pathPayload = typeof pathRes === 'string' ? JSON.parse(pathRes) : pathRes;
                                if (pathPayload && pathPayload.success && pathPayload.installPath) {
                                    isGameInstalled = true;
                                    window.__NoCommentGameInstallPath = pathPayload.installPath;
                                }
                                window.__NoCommentGameIsInstalled = isGameInstalled;
                                showFixesLoadingPopupAndCheck(appid);
                            } catch(err) {
                                backendLog('NoComment: GetGameInstallPath error: ' + err);
                            }
                        }).catch(function() {
                            const errorText = t('menu.error.getPath', 'Error getting game path');
                            ShowNoCommentAlert('No-Comment', errorText);
                        });
                    } catch(err) {
                        backendLog('NoComment: Fixes Menu button error: ' + err);
                    }
                });
            }

            if (addGameBtn) {
                addGameBtn.addEventListener('click', async function(e){
                    e.preventDefault();
                    if (runState.inProgress) return;
                    try {
                        const appid = getSettingsMenuAppId();
                        if (isNaN(appid)) {
                            const errText = t('menu.error.noAppId', 'Could not determine game AppID');
                            ShowNoCommentAlert('No-Comment', errText);
                            return;
                        }
                        const started = await startAddViaNoCommentFlow(appid, { showOverlay: true });
                        if (started) {
                            setTimeout(refreshDailyAddUsage, 600);
                        }
                    } catch(err) {
                        backendLog('NoComment: Add Game button error: ' + err);
                    }
                });
            }

            if (refreshCacheBtn) {
                refreshCacheBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    if (refreshCacheBtn.getAttribute('data-busy') === '1') return;
                    try {
                        const appid = getSettingsMenuAppId();
                        if (isNaN(appid)) {
                            const errText = t('menu.error.noAppId', 'Could not determine game AppID');
                            ShowNoCommentAlert('No-Comment', errText);
                            return;
                        }

                        const labelNode = refreshCacheBtn.querySelector('span');
                        const defaultLabel = labelNode
                            ? labelNode.textContent
                            : t('menu.refreshGameCache', 'Refresh game cache');
                        refreshCacheBtn.setAttribute('data-busy', '1');
                        refreshCacheBtn.style.opacity = '0.7';
                        refreshCacheBtn.style.cursor = 'wait';
                        if (labelNode) {
                            labelNode.textContent = t('menu.refreshingCache', 'Refreshing cache...');
                        }

                        Millennium.callServerMethod(
                            'No-Comment',
                            'ClearGameCacheAndRefetch',
                            { appid, contentScriptQuery: '' }
                        ).then(function(res){
                            try {
                                const payload = typeof res === 'string' ? JSON.parse(res) : res;
                                if (payload && payload.success) {
                                    const okText = payload.message || t('menu.refreshCacheSuccess', 'Game cache refreshed.');
                                    ShowNoCommentAlert('No-Comment', okText);
                                } else {
                                    const failText = (payload && payload.error)
                                        ? String(payload.error)
                                        : t('menu.refreshCacheFailure', 'Failed to refresh game cache.');
                                    ShowNoCommentAlert('No-Comment', failText);
                                }
                            } catch(err) {
                                const failText = (err && err.message)
                                    ? err.message
                                    : t('menu.refreshCacheFailure', 'Failed to refresh game cache.');
                                ShowNoCommentAlert('No-Comment', failText);
                            }
                        }).catch(function(err){
                            const failText = (err && err.message)
                                ? err.message
                                : t('menu.refreshCacheFailure', 'Failed to refresh game cache.');
                            ShowNoCommentAlert('No-Comment', failText);
                        }).finally(function(){
                            refreshCacheBtn.setAttribute('data-busy', '0');
                            refreshCacheBtn.style.opacity = '';
                            refreshCacheBtn.style.cursor = '';
                            if (labelNode) {
                                labelNode.textContent = defaultLabel;
                            }
                        });
                    } catch(err) {
                        backendLog('NoComment: Refresh cache button error: ' + err);
                    }
                });
            }

            try {
                const appid = getSettingsMenuAppId();
                if (isNaN(appid)) {
                    if (addGameBtn) addGameBtn.style.display = 'none';
                    removeBtn.style.display = 'none';
                    refreshCacheBtn.style.display = 'none';
                } else if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                    if (addGameBtn) addGameBtn.style.display = 'flex';
                    removeBtn.style.display = 'none';
                    refreshCacheBtn.style.display = 'flex';
                    Millennium.callServerMethod('No-Comment', 'HasNoCommentForApp', { appid, contentScriptQuery: '' }).then(function(res){
                        try {
                            const payload = typeof res === 'string' ? JSON.parse(res) : res;
                            const exists = !!(payload && payload.success && payload.exists === true);
                            if (exists) {
                                const doDelete = function() {
                                    try {
                                        Millennium.callServerMethod('No-Comment', 'DeleteNoCommentForApp', { appid, contentScriptQuery: '' }).then(function(){
                                            try {
                                                if (typeof invalidateInstalledLuaScriptsCache === 'function') {
                                                    invalidateInstalledLuaScriptsCache();
                                                }
                                                window.__NoCommentButtonInserted = false;
                                                window.__NoCommentPresenceCheckInFlight = false;
                                                window.__NoCommentPresenceCheckAppId = undefined;
                                                addNoCommentButton();
                                                const successText = t('menu.remove.success', 'NoComment removed for this app.');
                                                ShowNoCommentAlert('No-Comment', successText);
                                                if (typeof scheduleRestartSteam === 'function') {
                                                    scheduleRestartSteam(3);
                                                }
                                            } catch(err) {
                                                backendLog('NoComment: post-delete cleanup failed: ' + err);
                                            }
                                        }).catch(function(err){
                                            const failureText = t('menu.remove.failure', 'Failed to remove NoComment.');
                                            const errMsg = (err && err.message) ? err.message : failureText;
                                            ShowNoCommentAlert('No-Comment', errMsg);
                                        });
                                    } catch(err) {
                                        backendLog('NoComment: doDelete failed: ' + err);
                                    }
                                };

                                if (addGameBtn) addGameBtn.style.display = 'none';
                                removeBtn.style.display = 'flex';
                                refreshCacheBtn.style.display = 'flex';
                                removeBtn.onclick = function(e){
                                    e.preventDefault();
                                    doDelete();
                                };
                            } else {
                                removeBtn.style.display = 'none';
                                if (addGameBtn) addGameBtn.style.display = 'flex';
                                refreshCacheBtn.style.display = 'flex';
                            }
                        } catch(_) {}
                    });
                } else {
                    if (addGameBtn) addGameBtn.style.display = 'flex';
                    removeBtn.style.display = 'none';
                    refreshCacheBtn.style.display = 'flex';
                }
            } catch(_) {
                if (addGameBtn) addGameBtn.style.display = 'none';
                removeBtn.style.display = 'none';
                refreshCacheBtn.style.display = 'none';
            }
        });
    }

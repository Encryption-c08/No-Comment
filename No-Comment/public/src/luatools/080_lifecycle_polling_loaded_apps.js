    function onFrontendReady() {
        addNoCommentButton();
        ensureStoreAddButton();
        ensureToolsWidget();
        
        try {
            if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                Millennium.callServerMethod('No-Comment', 'GetInitApisMessage', { contentScriptQuery: '' }).then(function(res){
                    try {
                        const payload = typeof res === 'string' ? JSON.parse(res) : res;
                        if (payload && payload.message) {
                            const msg = String(payload.message);
                            
                            const isUpdateMsg = msg.toLowerCase().includes('update') || msg.toLowerCase().includes('restart');
                            
                            if (isUpdateMsg) {
                                
                                showNoCommentConfirm('No-Comment', msg, function() {
                                    
                                    try { Millennium.callServerMethod('No-Comment', 'RestartSteam', { contentScriptQuery: '' }); } catch(_) {}
                                }, function() {
                                    
                                });
                            } else {
                                
                                showNoCommentNotification('No-Comment', msg, { timeoutMs: 3000 });
                            }
                        }
                    } catch(_){ }
                });
                
            }
        } catch(_) { }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onFrontendReady);
    } else {
        onFrontendReady();
    }
    
    
    document.addEventListener('click', async function(evt) {
        const anchor = evt.target && (evt.target.closest ? evt.target.closest('.NoComment-button') : null);
        if (anchor) {
            evt.preventDefault();
            backendLog('NoComment delegated click');
            try {
                const match = window.location.href.match(/https:\/\/store\.steampowered\.com\/app\/(\d+)/) || window.location.href.match(/https:\/\/steamcommunity\.com\/app\/(\d+)/);
                const appid = match ? parseInt(match[1], 10) : NaN;
                if (!isNaN(appid) && typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                    await startAddViaNoCommentFlow(appid, { showOverlay: true });
                }
            } catch(_) {}
        }
    }, true);

    
    function startPolling(appid){
        let done = false;
        const timer = setInterval(() => {
            if (done) { clearInterval(timer); return; }
            try {
                Millennium.callServerMethod('No-Comment', 'GetAddViaNoCommentStatus', { appid, contentScriptQuery: '' }).then(function(res){
                    try {
                        const payload = typeof res === 'string' ? JSON.parse(res) : res;
                        const st = payload && payload.state ? payload.state : {};
                        
                        
                        const overlay = document.querySelector('.NoComment-overlay');
                        const title = overlay ? overlay.querySelector('.NoComment-title') : null;
                        const status = overlay ? overlay.querySelector('.NoComment-status') : null;
                        const wrap = overlay ? overlay.querySelector('.NoComment-progress-wrap') : null;
                        const percent = overlay ? overlay.querySelector('.NoComment-percent') : null;
                        const bar = overlay ? overlay.querySelector('.NoComment-progress-bar') : null;
                        
                        
                        if (st.currentApi && title) title.textContent = lt('NoComment · {api}').replace('{api}', st.currentApi);
                        if (status) {
                            if (st.status === 'checking') status.textContent = lt('Checking availability…');
                            if (st.status === 'downloading') status.textContent = lt('Downloading…');
                            if (st.status === 'processing') status.textContent = lt('Processing package…');
                            if (st.status === 'installing') status.textContent = lt('Installing…');
                            if (st.status === 'done') status.textContent = lt('Finishing…');
                            if (st.status === 'failed') status.textContent = lt('Failed');
                        }
                        if (st.status === 'downloading'){
                            
                            if (wrap && wrap.style.display === 'none') wrap.style.display = 'block';
                            if (percent && percent.style.display === 'none') percent.style.display = 'block';
                            const total = st.totalBytes || 0; const read = st.bytesRead || 0;
                            let pct = total > 0 ? Math.floor((read/total)*100) : (read ? 1 : 0);
                            if (pct > 100) pct = 100; if (pct < 0) pct = 0;
                            if (bar) bar.style.width = pct + '%';
                            if (percent) percent.textContent = pct + '%';
                            
                            const cancelBtn = overlay ? overlay.querySelector('.NoComment-cancel-btn') : null;
                            if (cancelBtn) cancelBtn.style.display = '';
                        }
                        if (st.status === 'done'){
                            try {
                                if (typeof setStorePresenceCache === 'function') {
                                    setStorePresenceCache(appid, true);
                                }
                            } catch(_) {}
                            
                            if (bar) bar.style.width = '100%';
                            if (percent) percent.textContent = '100%';
                            if (status) status.textContent = lt('Game added!');
                            
                            const cancelBtn = overlay ? overlay.querySelector('.NoComment-cancel-btn') : null;
                            if (cancelBtn) cancelBtn.style.display = 'none';
                            const hideBtn = overlay ? overlay.querySelector('.NoComment-hide-btn') : null;
                            if (hideBtn) hideBtn.innerHTML = '<span>' + lt('Close') + '</span>';
                            
                            if (wrap || percent) {
                            setTimeout(function(){ if (wrap) wrap.style.display = 'none'; if (percent) percent.style.display = 'none'; }, 300);
                            }
                            done = true; clearInterval(timer);
                            runState.inProgress = false; runState.appid = null;
                            
                            const btnEl = document.querySelector('.NoComment-button');
                            if (btnEl && btnEl.parentElement) {
                                btnEl.parentElement.removeChild(btnEl);
                            }
                            const storeBtn = document.querySelector('.NoComment-store-button-container');
                            if (storeBtn && storeBtn.parentElement) {
                                storeBtn.parentElement.removeChild(storeBtn);
                            }
                            showLibraryBanners();
                            ensureStoreAddButton();
                            scheduleRestartSteam(3, overlay);
                        }
                        if (st.status === 'failed'){
                            
                            if (status) status.textContent = lt('Failed: {error}').replace('{error}', st.error || lt('Unknown error'));
                            
                            const cancelBtn = overlay ? overlay.querySelector('.NoComment-cancel-btn') : null;
                            if (cancelBtn) cancelBtn.style.display = 'none';
                            const hideBtn = overlay ? overlay.querySelector('.NoComment-hide-btn') : null;
                            if (hideBtn) hideBtn.innerHTML = '<span>' + lt('Close') + '</span>';
                            if (wrap) wrap.style.display = 'none';
                            if (percent) percent.style.display = 'none';
                            done = true; clearInterval(timer);
                            runState.inProgress = false; runState.appid = null;
                        }
                    } catch(_){ }
                });
            } catch(_){ clearInterval(timer); }
        }, 300);
    }
    
    let uiRefreshTimer = 0;
    function scheduleUiRefresh(delayMs) {
        const delay = (typeof delayMs === 'number' && delayMs >= 0) ? delayMs : 120;
        if (uiRefreshTimer) return;
        uiRefreshTimer = setTimeout(function() {
            uiRefreshTimer = 0;
            try { updateButtonTranslations(); } catch(_) {}
            try { addNoCommentButton(); } catch(_) {}
            try { ensureStoreAddButton(); } catch(_) {}
        }, delay);
    }

    setTimeout(function(){ scheduleUiRefresh(0); }, 1000);
    setTimeout(function(){ scheduleUiRefresh(0); }, 3000);
    
    
    let lastUrl = window.location.href;
    function checkUrlChange() {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            
            window.__NoCommentButtonInserted = false;
            window.__NoCommentRestartInserted = false;
            window.__NoCommentIconInserted = false;
            window.__NoCommentPresenceCheckInFlight = false;
            window.__NoCommentPresenceCheckAppId = undefined;
            
            ensureTranslationsLoaded(false).then(function() {
                scheduleUiRefresh(0);
            });
        }
    }
    
    setInterval(checkUrlChange, 1200);
    window.addEventListener('popstate', checkUrlChange);
    
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function() {
        originalPushState.apply(history, arguments);
        setTimeout(checkUrlChange, 100);
    };
    history.replaceState = function() {
        originalReplaceState.apply(history, arguments);
        setTimeout(checkUrlChange, 100);
    };
    
    
    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(function(mutations) {
            for (let i = 0; i < mutations.length; i++) {
                const mutation = mutations[i];
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    scheduleUiRefresh(120);
                    break;
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function showLoadedAppsPopup(apps) {
        
        if (document.querySelector('.NoComment-loadedapps-overlay')) return;
        ensureNoCommentStyles();
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.className = 'NoComment-loadedapps-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.className = 'NoComment-loadedapps-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';
        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:420px;max-width:640px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(102,192,244,0.3);animation:slideUp 0.1s ease-out;';
        const title = document.createElement('div');
        title.style.cssText = 'font-size:24px;color:#fff;margin-bottom:20px;font-weight:700;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-align:center;';
        title.textContent = lt('NoComment · Added Games');
        const body = document.createElement('div');
        body.style.cssText = 'font-size:14px;line-height:1.8;margin-bottom:16px;max-height:320px;overflow:auto;padding:16px;border:1px solid rgba(102,192,244,0.3);border-radius:12px;background:rgba(11,20,30,0.6);';
        if (apps && apps.length) {
            const list = document.createElement('div');
            apps.forEach(function(item){
                const a = document.createElement('a');
                a.href = 'steam://install/' + String(item.appid);
                a.textContent = String(item.name || item.appid);
                a.style.cssText = 'display:block;color:#c7d5e0;text-decoration:none;padding:10px 16px;margin-bottom:8px;background:rgba(102,192,244,0.08);border:1px solid rgba(102,192,244,0.2);border-radius:4px;transition:all 0.3s ease;';
                a.onmouseover = function() { this.style.background = 'rgba(102,192,244,0.2)'; this.style.borderColor = '#66c0f4'; this.style.transform = 'translateX(4px)'; this.style.color = '#fff'; };
                a.onmouseout = function() { this.style.background = 'rgba(102,192,244,0.08)'; this.style.borderColor = 'rgba(102,192,244,0.2)'; this.style.transform = 'translateX(0)'; this.style.color = '#c7d5e0'; };
                a.onclick = function(e){ e.preventDefault(); try { window.location.href = a.href; } catch(_) {} };
                a.oncontextmenu = function(e){ e.preventDefault(); const url = 'https://steamdb.info/app/' + String(item.appid) + '/';
                    try { Millennium.callServerMethod('No-Comment', 'OpenExternalUrl', { url, contentScriptQuery: '' }); } catch(_) {}
                };
                list.appendChild(a);
            });
            body.appendChild(list);
        } else {
            body.style.textAlign = 'center';
            body.textContent = lt('No games found.');
        }
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-top:16px;display:flex;gap:8px;justify-content:space-between;align-items:center;';
        const instructionText = document.createElement('div');
        instructionText.style.cssText = 'font-size:12px;color:#8f98a0;';
        instructionText.textContent = lt('Left click to install, Right click for SteamDB');
        const dismissBtn = document.createElement('a');
        dismissBtn.className = 'btnv6_blue_hoverfade btn_medium';
        dismissBtn.innerHTML = '<span>' + lt('Dismiss') + '</span>';
        dismissBtn.href = '#';
        dismissBtn.onclick = function(e){ e.preventDefault(); try { Millennium.callServerMethod('No-Comment', 'DismissLoadedApps', { contentScriptQuery: '' }); } catch(_) {} try { sessionStorage.setItem('NoCommentLoadedAppsShown', '1'); } catch(_) {} overlay.remove(); };
        btnRow.appendChild(instructionText);
        btnRow.appendChild(dismissBtn);
        modal.appendChild(title);
        modal.appendChild(body);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);
        overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    }

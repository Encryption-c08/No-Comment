    function showTestPopup() {

        
        if (document.querySelector('.luatools-overlay')) return;
        
        
        
        ensureLuaToolsStyles();
        const overlay = document.createElement('div');
        overlay.className = 'luatools-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:400px;max-width:560px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(102,192,244,0.3);animation:slideUp 0.1s ease-out;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:22px;color:#fff;margin-bottom:16px;font-weight:700;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        title.className = 'luatools-title';
        title.textContent = 'LuaTools';

        const body = document.createElement('div');
        body.style.cssText = 'font-size:14px;line-height:1.4;margin-bottom:12px;';
        body.className = 'luatools-status';
        body.textContent = lt('Working…');

        const progressWrap = document.createElement('div');
        progressWrap.style.cssText = 'background:rgba(42,71,94,0.5);height:12px;border-radius:4px;overflow:hidden;position:relative;display:none;border:1px solid rgba(102,192,244,0.3);';
        progressWrap.className = 'luatools-progress-wrap';
        const progressBar = document.createElement('div');
        progressBar.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg, #66c0f4 0%, #a4d7f5 100%);transition:width 0.1s linear;box-shadow:0 0 10px rgba(102,192,244,0.5);';
        progressBar.className = 'luatools-progress-bar';
        progressWrap.appendChild(progressBar);

        const percent = document.createElement('div');
        percent.style.cssText = 'text-align:right;color:#8f98a0;margin-top:8px;font-size:12px;display:none;';
        percent.className = 'luatools-percent';
        percent.textContent = '0%';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-top:16px;display:flex;gap:8px;justify-content:flex-end;';
        const cancelBtn = document.createElement('a');
        cancelBtn.className = 'btnv6_blue_hoverfade btn_medium luatools-cancel-btn';
        cancelBtn.innerHTML = `<span>${lt('Cancel')}</span>`;
        cancelBtn.href = '#';
        cancelBtn.style.display = 'none';
        cancelBtn.onclick = function(e){ e.preventDefault(); cancelOperation(); };
        const hideBtn = document.createElement('a');
        hideBtn.className = 'btnv6_blue_hoverfade btn_medium luatools-hide-btn';
        hideBtn.innerHTML = `<span>${lt('Hide')}</span>`;
        hideBtn.href = '#';
        hideBtn.onclick = function(e){ e.preventDefault(); cleanup(); };
        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(hideBtn);

        styleGreyscaleLoadingModal(modal);
        styleGreyscaleLoadingTitle(title);
        styleGreyscaleLoadingBody(body);
        styleGreyscaleLoadingProgress(progressWrap, progressBar, percent);
        styleGreyscaleLoadingButton(cancelBtn, false);
        styleGreyscaleLoadingButton(hideBtn, false);

        modal.appendChild(title);
        modal.appendChild(body);
        modal.appendChild(progressWrap);
        modal.appendChild(percent);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        function cleanup(){
            overlay.remove();
        }
        
        function cancelOperation(){
            
            try {
                const match = window.location.href.match(/https:\/\/store\.steampowered\.com\/app\/(\d+)/) || window.location.href.match(/https:\/\/steamcommunity\.com\/app\/(\d+)/);
                const appid = match ? parseInt(match[1], 10) : (window.__LuaToolsCurrentAppId || NaN);
                if (!isNaN(appid) && typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                    Millennium.callServerMethod('luatools', 'CancelAddViaLuaTools', { appid, contentScriptQuery: '' });
                }
            } catch(_) {}
            
            const status = overlay.querySelector('.luatools-status');
            if (status) status.textContent = lt('Cancelled');
            const cancelBtn = overlay.querySelector('.luatools-cancel-btn');
            if (cancelBtn) cancelBtn.style.display = 'none';
            const hideBtn = overlay.querySelector('.luatools-hide-btn');
            if (hideBtn) hideBtn.innerHTML = `<span>${lt('Close')}</span>`;
            
            const wrap = overlay.querySelector('.luatools-progress-wrap');
            const percent = overlay.querySelector('.luatools-percent');
            if (wrap) wrap.style.display = 'none';
            if (percent) percent.style.display = 'none';
            
            runState.inProgress = false;
            runState.appid = null;
        }
    }

    
    function showFixesResultsPopup(data, isGameInstalled) {
        if (document.querySelector('.luatools-fixes-results-overlay')) return;
        
        try { const d = document.querySelector('.luatools-overlay'); if (d) d.remove(); } catch(_) {}
        try { closeToolsMenu(); } catch(_) {}
        try { const f = document.querySelector('.luatools-fixes-results-overlay'); if (f) f.remove(); } catch(_) {}
        try { const l = document.querySelector('.luatools-loading-fixes-overlay'); if (l) l.remove(); } catch(_) {}

        ensureLuaToolsStyles();
        const overlay = document.createElement('div');
        overlay.className = 'luatools-fixes-results-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'position:relative;background:linear-gradient(135deg, #2b2b2b 0%, #1a1a1a 100%);color:#f2f2f2;border:2px solid #6f6f6f;border-radius:8px;min-width:580px;max-width:700px;max-height:80vh;display:flex;flex-direction:column;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.85), 0 0 0 1px rgba(200,200,200,0.2);animation:slideUp 0.1s ease-out;';

        const header = document.createElement('div');
        header.style.cssText = 'flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid rgba(200,200,200,0.25);';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:24px;color:#f2f2f2;font-weight:700;text-shadow:0 2px 8px rgba(0,0,0,0.6);background:linear-gradient(135deg, #f2f2f2 0%, #bdbdbd 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        title.textContent = lt('LuaTools · Fixes Menu');

        const iconButtons = document.createElement('div');
        iconButtons.style.cssText = 'display:flex;gap:12px;';

        function createIconButton(id, iconClass, titleKey, titleFallback) {
            const btn = document.createElement('a');
            btn.id = id;
            btn.href = '#';
            btn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.25);border-radius:10px;color:#dedede;font-size:18px;text-decoration:none;transition:all 0.3s ease;cursor:pointer;';
            btn.innerHTML = '<i class="fa-solid ' + iconClass + '"></i>';
            btn.title = t(titleKey, titleFallback);
            btn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.14)'; this.style.transform = 'translateY(-2px) scale(1.05)'; this.style.boxShadow = '0 8px 16px rgba(0,0,0,0.45)'; this.style.borderColor = '#d6d6d6'; this.style.color = '#f2f2f2'; };
            btn.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.06)'; this.style.transform = 'translateY(0) scale(1)'; this.style.boxShadow = 'none'; this.style.borderColor = 'rgba(255,255,255,0.25)'; this.style.color = '#dedede'; };
            iconButtons.appendChild(btn);
            return btn;
        }

        const discordBtn = createIconButton('lt-fixes-discord', 'fa-brands fa-discord', 'menu.discord', 'Discord');
        const settingsBtn = createIconButton('lt-fixes-settings', 'fa-gear', 'menu.settings', 'Settings');
        const closeIconBtn = createIconButton('lt-fixes-close', 'fa-xmark', 'settings.close', 'Close');

        const body = document.createElement('div');
        body.style.cssText = 'flex:1 1 auto;position:relative;overflow-y:auto;padding:20px;border:1px solid rgba(200,200,200,0.2);border-radius:12px;background:rgba(15,15,15,0.7);';

        try {
            const bannerImg = document.querySelector('.game_header_image_full');
            if (bannerImg && bannerImg.src) {
                body.style.background = `linear-gradient(to bottom, rgba(18, 18, 18, 0.92), rgba(16, 16, 16, 0.88) 55%, rgba(12, 12, 12, 0.95) 100%), url('${bannerImg.src}') no-repeat top center`;
                body.style.backgroundSize = 'cover';
                body.style.backgroundBlendMode = 'luminosity';
            }
        } catch(_) {}

        const gameHeader = document.createElement('div');
        gameHeader.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px;';

        const gameIcon = document.createElement('img');
        gameIcon.style.cssText = 'width:32px;height:32px;border-radius:4px;object-fit:cover;display:none;';
        try {
            const iconImg = document.querySelector('.apphub_AppIcon img');
            if (iconImg && iconImg.src) {
                gameIcon.src = iconImg.src;
                gameIcon.style.display = 'block';
            }
        } catch(_) {}

        const gameName = document.createElement('div');
        gameName.style.cssText = 'font-size:22px;color:#f0f0f0;font-weight:600;text-align:center;text-shadow:0 1px 3px rgba(0,0,0,0.6);';
        gameName.textContent = data.gameName || lt('Unknown Game');

        const contentContainer = document.createElement('div');
        contentContainer.style.position = 'relative';
        contentContainer.style.zIndex = '1';

        const columnsContainer = document.createElement('div');
        columnsContainer.style.cssText = 'display:flex;gap:16px;';

        const leftColumn = document.createElement('div');
        leftColumn.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:16px;';

        const rightColumn = document.createElement('div');
        rightColumn.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:16px;';

        function createFixButton(label, text, icon, isSuccess, onClick) {
            const section = document.createElement('div');
            section.style.cssText = 'width:100%;text-align:center;';

            const sectionLabel = document.createElement('div');
            sectionLabel.style.cssText = 'font-size:12px;color:#bdbdbd;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:1px;';
            sectionLabel.textContent = label;

            const btn = document.createElement('a');
            btn.href = '#';
            btn.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:10px;width:100%;box-sizing:border-box;padding:14px 24px;background:linear-gradient(135deg, rgba(220,220,220,0.12) 0%, rgba(220,220,220,0.04) 100%);border:1px solid rgba(220,220,220,0.28);border-radius:12px;color:#f2f2f2;font-size:15px;font-weight:500;text-decoration:none;transition:all 0.3s ease;cursor:pointer;';
            btn.innerHTML = '<i class="fa-solid ' + icon + '" style="font-size:16px;"></i><span>' + text + '</span>';

            if (isSuccess) {
                btn.style.background = 'linear-gradient(135deg, rgba(240,240,240,0.3) 0%, rgba(200,200,200,0.18) 100%)';
                btn.style.borderColor = 'rgba(240,240,240,0.6)';
                btn.onmouseover = function() { this.style.background = 'linear-gradient(135deg, rgba(245,245,245,0.45) 0%, rgba(210,210,210,0.25) 100%)'; this.style.transform = 'translateY(-2px)'; this.style.boxShadow = '0 8px 20px rgba(0,0,0,0.5)'; this.style.borderColor = '#f0f0f0'; };
                btn.onmouseout = function() { this.style.background = 'linear-gradient(135deg, rgba(240,240,240,0.3) 0%, rgba(200,200,200,0.18) 100%)'; this.style.transform = 'translateY(0)'; this.style.boxShadow = 'none'; this.style.borderColor = 'rgba(240,240,240,0.6)'; };
            } else if (isSuccess === false) {
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.onmouseover = function() { this.style.background = 'linear-gradient(135deg, rgba(230,230,230,0.22) 0%, rgba(230,230,230,0.1) 100%)'; this.style.transform = 'translateY(-2px)'; this.style.boxShadow = '0 8px 20px rgba(0,0,0,0.45)'; this.style.borderColor = '#e0e0e0'; };
                btn.onmouseout = function() { this.style.background = 'linear-gradient(135deg, rgba(220,220,220,0.12) 0%, rgba(220,220,220,0.04) 100%)'; this.style.transform = 'translateY(0)'; this.style.boxShadow = 'none'; this.style.borderColor = 'rgba(220,220,220,0.28)'; };
            }

            btn.onclick = onClick;

            section.appendChild(sectionLabel);
            section.appendChild(btn);
            return section;
        }

        
        const genericStatus = data.genericFix.status;
        const genericSection = createFixButton(
            lt('Generic Fix'),
            genericStatus === 200 ? lt('Apply') : lt('No generic fix'),
            genericStatus === 200 ? 'fa-check' : 'fa-circle-xmark',
            genericStatus === 200 ? true : false,
            function(e) {
                e.preventDefault();
                if (genericStatus === 200 && isGameInstalled) {
                    const genericUrl = 'https://files.luatools.work/GameBypasses/' + data.appid + '.zip';
                    applyFix(data.appid, genericUrl, lt('Generic Fix'), data.gameName, overlay);
                }
            }
        );
        leftColumn.appendChild(genericSection);

        if (!isGameInstalled) {
            genericSection.querySelector('a').style.opacity = '0.5';
            genericSection.querySelector('a').style.cursor = 'not-allowed';
        }

        const onlineStatus = data.onlineFix.status;
        const onlineSection = createFixButton(
            lt('Online Fix'),
            onlineStatus === 200 ? lt('Apply') : lt('No online-fix'),
            onlineStatus === 200 ? 'fa-check' : 'fa-circle-xmark',
            onlineStatus === 200 ? true : false,
            function(e) {
                e.preventDefault();
                if (onlineStatus === 200 && isGameInstalled) {
                    const onlineUrl = data.onlineFix.url || ('https://files.luatools.work/OnlineFix1/' + data.appid + '.zip');
                    applyFix(data.appid, onlineUrl, lt('Online Fix'), data.gameName, overlay);
                }
            }
        );
        leftColumn.appendChild(onlineSection);

        if (!isGameInstalled) {
            onlineSection.querySelector('a').style.opacity = '0.5';
            onlineSection.querySelector('a').style.cursor = 'not-allowed';
        }

        
        const aioSection = createFixButton(
            lt('All-In-One Fixes'),
            lt('Online Fix (Unsteam)'),
            'fa-globe',
            null, 
            function(e) {
                e.preventDefault();
                if (isGameInstalled) {
                    const downloadUrl = 'https://github.com/madoiscool/lt_api_links/releases/download/unsteam/Win64.zip';
                    applyFix(data.appid, downloadUrl, lt('Online Fix (Unsteam)'), data.gameName, overlay);
                }
            }
        );
        rightColumn.appendChild(aioSection);
        if (!isGameInstalled) {
            aioSection.querySelector('a').style.opacity = '0.5';
            aioSection.querySelector('a').style.cursor = 'not-allowed';
        }

        const unfixSection = createFixButton(
            lt('Manage Game'),
            lt('Un-Fix (verify game)'),
            'fa-trash',
            null, 
            function(e) {
                e.preventDefault();
                if (isGameInstalled) {
                    try { overlay.remove(); } catch(_) {}
                    showLuaToolsConfirm('LuaTools', lt('Are you sure you want to un-fix? This will remove fix files and verify game files.'),
                        function() { startUnfix(data.appid); },
                        function() { showFixesResultsPopup(data, isGameInstalled); }
                    );
                }
            }
        );
        rightColumn.appendChild(unfixSection);
        if (!isGameInstalled) {
            unfixSection.querySelector('a').style.opacity = '0.5';
            unfixSection.querySelector('a').style.cursor = 'not-allowed';
        }

        
        const creditMsg = document.createElement('div');
        creditMsg.style.cssText = 'margin-top:16px;text-align:center;font-size:13px;color:#a0a0a0;';
        const creditTemplate = lt('Only possible thanks to {name} 💜');
        creditMsg.innerHTML = creditTemplate.replace('{name}', '<a href="#" id="lt-shayenvi-link" style="color:#d0d0d0;text-decoration:none;font-weight:600;">ShayneVi</a>');
        
        
        setTimeout(function(){
            const shayenviLink = overlay.querySelector('#lt-shayenvi-link');
            if (shayenviLink) {
                shayenviLink.addEventListener('click', function(e){
                    e.preventDefault();
                    try {
                        Millennium.callServerMethod('luatools', 'OpenExternalUrl', { url: 'https://github.com/ShayneVi/', contentScriptQuery: '' });
                    } catch(_) {}
                });
            }
        }, 0);

        
        gameHeader.appendChild(gameIcon);
        gameHeader.appendChild(gameName);
        contentContainer.appendChild(gameHeader);

        if (!isGameInstalled) {
            const notInstalledWarning = document.createElement('div');
            notInstalledWarning.style.cssText = 'margin-bottom: 16px; padding: 12px; background: rgba(200, 200, 200, 0.08); border: 1px solid rgba(200, 200, 200, 0.25); border-radius: 6px; color: #d0d0d0; font-size: 13px; text-align: center;';
            notInstalledWarning.innerHTML = '<i class="fa-solid fa-circle-info" style="margin-right: 8px;"></i>' + t('menu.error.notInstalled', 'Game is not installed');
            contentContainer.appendChild(notInstalledWarning);
        }

        columnsContainer.appendChild(leftColumn);
        columnsContainer.appendChild(rightColumn);
        contentContainer.appendChild(columnsContainer);
        contentContainer.appendChild(creditMsg);
        body.appendChild(contentContainer);

        
        header.appendChild(title);
        header.appendChild(iconButtons);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'flex:0 0 auto;margin-top:16px;display:flex;gap:8px;justify-content:space-between;align-items:center;';

        const rightButtons = document.createElement('div');
        rightButtons.style.cssText = 'display:flex;gap:8px;';
        const gameFolderBtn = document.createElement('a');
        gameFolderBtn.className = '';
        gameFolderBtn.innerHTML = `<span><i class="fa-solid fa-folder" style="margin-right: 8px;"></i>${lt('Game folder')}</span>`;
        gameFolderBtn.href = '#';
        gameFolderBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 14px;border-radius:8px;border:1px solid rgba(220,220,220,0.35);background:rgba(255,255,255,0.08);color:#e6e6e6;text-decoration:none;font-size:13px;font-weight:600;transition:all 0.2s ease;';
        gameFolderBtn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.16)'; this.style.borderColor = '#e0e0e0'; this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.45)'; };
        gameFolderBtn.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.08)'; this.style.borderColor = 'rgba(220,220,220,0.35)'; this.style.boxShadow = 'none'; };
        gameFolderBtn.onclick = function(e){ 
            e.preventDefault(); 
            if (window.__LuaToolsGameInstallPath) {
                try {
                    Millennium.callServerMethod('luatools', 'OpenGameFolder', { path: window.__LuaToolsGameInstallPath, contentScriptQuery: '' });
                } catch(err) { backendLog('LuaTools: Failed to open game folder: ' + err); }
            }
        };
        rightButtons.appendChild(gameFolderBtn);

        const backBtn = document.createElement('a');
        backBtn.className = '';
        backBtn.innerHTML = '<span><i class="fa-solid fa-arrow-left"></i></span>';
        backBtn.href = '#';
        backBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:40px;height:34px;border-radius:8px;border:1px solid rgba(220,220,220,0.35);background:rgba(255,255,255,0.08);color:#e6e6e6;text-decoration:none;transition:all 0.2s ease;';
        backBtn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.16)'; this.style.borderColor = '#e0e0e0'; this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.45)'; };
        backBtn.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.08)'; this.style.borderColor = 'rgba(220,220,220,0.35)'; this.style.boxShadow = 'none'; };
        backBtn.onclick = function(e){
            e.preventDefault();
            try { overlay.remove(); } catch(_) {}
            showSettingsPopup();
        };
        btnRow.appendChild(backBtn);
        btnRow.appendChild(rightButtons);

        
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(btnRow);  
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        closeIconBtn.onclick = function(e) { e.preventDefault(); overlay.remove(); };
        discordBtn.onclick = function(e) {
            e.preventDefault();
            try { overlay.remove(); } catch(_) {}
            const url = 'https://discord.gg/luatools';
            try { Millennium.callServerMethod('luatools', 'OpenExternalUrl', { url, contentScriptQuery: '' }); } catch(_) {}
        };
        settingsBtn.onclick = function(e) {
            e.preventDefault();
            try { overlay.remove(); } catch(_) {}
            showSettingsManagerPopup(false, function() { showFixesResultsPopup(data, isGameInstalled); });
        };

        function startUnfix(appid) {
            try {
                Millennium.callServerMethod('luatools', 'UnFixGame', { appid: appid, installPath: window.__LuaToolsGameInstallPath, contentScriptQuery: '' }).then(function(res){
                    const payload = typeof res === 'string' ? JSON.parse(res) : res;
                    if (payload && payload.success) {
                        showUnfixProgress(appid);
                    } else {
                        const errorKey = (payload && payload.error) ? String(payload.error) : '';
                        const errorMsg = (errorKey && (errorKey.startsWith('menu.error.') || errorKey.startsWith('common.'))) ? t(errorKey) : (errorKey || lt('Failed to start un-fix'));
                        ShowLuaToolsAlert('LuaTools', errorMsg);
                    }
                }).catch(function(){
                    const msg = lt('Error starting un-fix');
                    ShowLuaToolsAlert('LuaTools', msg);
                });
            } catch(err) { backendLog('LuaTools: Un-Fix start error: ' + err); }
        }
    }

    function showFixesLoadingPopupAndCheck(appid) {
        if (document.querySelector('.luatools-loading-fixes-overlay')) return;
        try { const d = document.querySelector('.luatools-overlay'); if (d) d.remove(); } catch(_) {}
        try { closeToolsMenu(); } catch(_) {}
        try { const f = document.querySelector('.luatools-fixes-overlay'); if (f) f.remove(); } catch(_) {}

        ensureLuaToolsStyles();
        const overlay = document.createElement('div');
        overlay.className = 'luatools-loading-fixes-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:400px;max-width:560px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(102,192,244,0.3);animation:slideUp 0.1s ease-out;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:22px;color:#fff;margin-bottom:16px;font-weight:700;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        title.textContent = lt('Loading fixes...');

        const body = document.createElement('div');
        body.style.cssText = 'font-size:14px;line-height:1.6;margin-bottom:16px;color:#c7d5e0;';
        body.textContent = lt('Checking availability…');

        const progressWrap = document.createElement('div');
        progressWrap.style.cssText = 'background:rgba(42,71,94,0.5);height:12px;border-radius:4px;overflow:hidden;position:relative;border:1px solid rgba(102,192,244,0.3);';
        const progressBar = document.createElement('div');
        progressBar.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg, #66c0f4 0%, #a4d7f5 100%);transition:width 0.2s linear;box-shadow:0 0 10px rgba(102,192,244,0.5);';
        progressWrap.appendChild(progressBar);

        styleGreyscaleLoadingModal(modal);
        styleGreyscaleLoadingTitle(title);
        styleGreyscaleLoadingBody(body);
        styleGreyscaleLoadingProgress(progressWrap, progressBar, null);

        modal.appendChild(title);
        modal.appendChild(body);
        modal.appendChild(progressWrap);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        let progress = 0;
        const progressInterval = setInterval(function() {
            if (progress < 95) {
                progress += Math.random() * 5;
                progressBar.style.width = Math.min(progress, 95) + '%';
            }
        }, 200);

        Millennium.callServerMethod('luatools', 'CheckForFixes', { appid, contentScriptQuery: '' }).then(function(res){
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            if (payload && payload.success) {
                const isGameInstalled = window.__LuaToolsGameIsInstalled === true;
                showFixesResultsPopup(payload, isGameInstalled);
            } else {
                const errText = (payload && payload.error) ? String(payload.error) : lt('Failed to check for fixes.');
                ShowLuaToolsAlert('LuaTools', errText);
            }
        }).catch(function() {
            const msg = lt('Error checking for fixes');
            ShowLuaToolsAlert('LuaTools', msg);
        }).finally(function() {
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            setTimeout(function() {
                try {
                    const l = document.querySelector('.luatools-loading-fixes-overlay');
                    if (l) l.remove();
                } catch(_) {}
            }, 300);
        });
    }

    
    function applyFix(appid, downloadUrl, fixType, gameName, resultsOverlay) {
        try {
            
            if (resultsOverlay) {
                resultsOverlay.remove();
            }
            
            
            if (!window.__LuaToolsGameInstallPath) {
                const msg = lt('Game install path not found');
                ShowLuaToolsAlert('LuaTools', msg);
                return;
            }
            
            backendLog('LuaTools: Applying fix ' + fixType + ' for appid ' + appid);
            
            
            Millennium.callServerMethod('luatools', 'ApplyGameFix', { 
                appid: appid, 
                downloadUrl: downloadUrl, 
                installPath: window.__LuaToolsGameInstallPath,
                fixType: fixType,
                gameName: gameName || '',
                contentScriptQuery: '' 
            }).then(function(res){
                try {
                    const payload = typeof res === 'string' ? JSON.parse(res) : res;
                    if (payload && payload.success) {
                        
                        showFixDownloadProgress(appid, fixType);
                    } else {
                        const errorKey = (payload && payload.error) ? String(payload.error) : '';
                        const errorMsg = (errorKey && (errorKey.startsWith('menu.error.') || errorKey.startsWith('common.'))) ? t(errorKey) : (errorKey || lt('Failed to start fix download'));
                        ShowLuaToolsAlert('LuaTools', errorMsg);
                    }
                } catch(err) {
                    backendLog('LuaTools: ApplyGameFix response error: ' + err);
                    const msg = lt('Error applying fix');
                    ShowLuaToolsAlert('LuaTools', msg);
                }
            }).catch(function(err){
                backendLog('LuaTools: ApplyGameFix error: ' + err);
                const msg = lt('Error applying fix');
                ShowLuaToolsAlert('LuaTools', msg);
            });
        } catch(err) {
            backendLog('LuaTools: applyFix error: ' + err);
        }
    }

    
    function showFixDownloadProgress(appid, fixType) {
        
        if (document.querySelector('.luatools-overlay')) return;

        ensureLuaToolsStyles();
        const overlay = document.createElement('div');
        overlay.className = 'luatools-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:400px;max-width:560px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(102,192,244,0.3);animation:slideUp 0.1s ease-out;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:22px;color:#fff;margin-bottom:16px;font-weight:700;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        title.textContent = lt('Applying {fix}').replace('{fix}', fixType);

        const body = document.createElement('div');
        body.style.cssText = 'font-size:15px;line-height:1.6;margin-bottom:20px;color:#c7d5e0;';
        body.innerHTML = '<div id="lt-fix-progress-msg">' + lt('Downloading...') + '</div>';

        const btnRow = document.createElement('div');
        btnRow.className = 'lt-fix-btn-row';
        btnRow.style.cssText = 'margin-top:16px;display:flex;gap:12px;justify-content:center;';

        const hideBtn = document.createElement('a');
        hideBtn.href = '#';
        hideBtn.className = 'luatools-btn';
        hideBtn.style.flex = '1';
        hideBtn.innerHTML = `<span>${lt('Hide')}</span>`;
        hideBtn.onclick = function(e){ e.preventDefault(); overlay.remove(); };
        btnRow.appendChild(hideBtn);

        const cancelBtn = document.createElement('a');
        cancelBtn.href = '#';
        cancelBtn.className = 'luatools-btn primary';
        cancelBtn.style.flex = '1';
        cancelBtn.innerHTML = `<span>${lt('Cancel')}</span>`;
        cancelBtn.onclick = function(e){
            e.preventDefault();
            if (cancelBtn.dataset.pending === '1') return;
            cancelBtn.dataset.pending = '1';
            const span = cancelBtn.querySelector('span');
            if (span) span.textContent = lt('Cancelling...');
            const msgEl = document.getElementById('lt-fix-progress-msg');
            if (msgEl) msgEl.textContent = lt('Cancelling...');
            Millennium.callServerMethod('luatools', 'CancelApplyFix', { appid: appid, contentScriptQuery: '' }).then(function(res){
                try {
                    const payload = typeof res === 'string' ? JSON.parse(res) : res;
                    if (!payload || payload.success !== true) {
                        throw new Error((payload && payload.error) || lt('Cancellation failed'));
                    }
                } catch(err) {
                    cancelBtn.dataset.pending = '0';
                    if (span) span.textContent = lt('Cancel');
                    const msgEl2 = document.getElementById('lt-fix-progress-msg');
                    if (msgEl2 && msgEl2.dataset.last) msgEl2.textContent = msgEl2.dataset.last;
                    backendLog('LuaTools: CancelApplyFix response error: ' + err);
                    const msg = lt('Failed to cancel fix download');
                    ShowLuaToolsAlert('LuaTools', msg);
                }
            }).catch(function(err){
                cancelBtn.dataset.pending = '0';
                const span2 = cancelBtn.querySelector('span');
                if (span2) span2.textContent = lt('Cancel');
                const msgEl2 = document.getElementById('lt-fix-progress-msg');
                if (msgEl2 && msgEl2.dataset.last) msgEl2.textContent = msgEl2.dataset.last;
                backendLog('LuaTools: CancelApplyFix error: ' + err);
                const msg = lt('Failed to cancel fix download');
                ShowLuaToolsAlert('LuaTools', msg);
            });
        };
        btnRow.appendChild(cancelBtn);

        styleGreyscaleLoadingModal(modal);
        styleGreyscaleLoadingTitle(title);
        styleGreyscaleLoadingBody(body);
        styleGreyscaleLoadingButton(hideBtn, false);
        styleGreyscaleLoadingButton(cancelBtn, true);

        modal.appendChild(title);
        modal.appendChild(body);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        
        pollFixProgress(appid, fixType);
    }

    function replaceFixButtonsWithClose(overlayEl) {
        if (!overlayEl) return;
        const btnRow = overlayEl.querySelector('.lt-fix-btn-row');
        if (!btnRow) return;
        btnRow.innerHTML = '';
        btnRow.style.cssText = 'margin-top:16px;display:flex;justify-content:flex-end;';
        const closeBtn = document.createElement('a');
        closeBtn.href = '#';
        closeBtn.className = 'luatools-btn primary';
        closeBtn.style.minWidth = '140px';
        closeBtn.innerHTML = `<span>${lt('Close')}</span>`;
        closeBtn.onclick = function(e){ e.preventDefault(); overlayEl.remove(); };
        styleGreyscaleLoadingButton(closeBtn, true);
        btnRow.appendChild(closeBtn);
    }

    
    function pollFixProgress(appid, fixType) {
        const poll = function() {
            try {
                const overlayEl = document.querySelector('.luatools-overlay');
                if (!overlayEl) return; 
                
                Millennium.callServerMethod('luatools', 'GetApplyFixStatus', { appid: appid, contentScriptQuery: '' }).then(function(res){
                    try {
                        const payload = typeof res === 'string' ? JSON.parse(res) : res;
                        if (payload && payload.success && payload.state) {
                            const state = payload.state;
                            const msgEl = document.getElementById('lt-fix-progress-msg');
                            
                            if (state.status === 'downloading') {
                                const pct = state.totalBytes > 0 ? Math.floor((state.bytesRead / state.totalBytes) * 100) : 0;
                                if (msgEl) { msgEl.textContent = lt('Downloading: {percent}%').replace('{percent}', pct); msgEl.dataset.last = msgEl.textContent; }
                                setTimeout(poll, 500);
                            } else if (state.status === 'extracting') {
                                if (msgEl) { msgEl.textContent = lt('Extracting to game folder...'); msgEl.dataset.last = msgEl.textContent; }
                                setTimeout(poll, 500);
                            } else if (state.status === 'cancelled') {
                                if (msgEl) msgEl.textContent = lt('Cancelled: {reason}').replace('{reason}', state.error || lt('Cancelled by user'));
                                replaceFixButtonsWithClose(overlayEl);
                                return;
                            } else if (state.status === 'done') {
                                if (msgEl) msgEl.textContent = lt('{fix} applied successfully!').replace('{fix}', fixType);
                                replaceFixButtonsWithClose(overlayEl);
                                return; 
                            } else if (state.status === 'failed') {
                                if (msgEl) msgEl.textContent = lt('Failed: {error}').replace('{error}', state.error || lt('Unknown error'));
                                replaceFixButtonsWithClose(overlayEl);
                                return; 
                            } else {
                                
                                setTimeout(poll, 500);
                            }
                        }
                    } catch(err) {
                        backendLog('LuaTools: GetApplyFixStatus error: ' + err);
                    }
                });
            } catch(err) {
                backendLog('LuaTools: pollFixProgress error: ' + err);
            }
        };
        setTimeout(poll, 500);
    }

    
    function showUnfixProgress(appid) {
        
        try { const old = document.querySelector('.luatools-unfix-overlay'); if (old) old.remove(); } catch(_) {}

        ensureLuaToolsStyles();
        const overlay = document.createElement('div');
        overlay.className = 'luatools-unfix-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:400px;max-width:560px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(102,192,244,0.3);animation:slideUp 0.1s ease-out;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:22px;color:#fff;margin-bottom:16px;font-weight:700;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        title.textContent = lt('Un-Fixing game');

        const body = document.createElement('div');
        body.style.cssText = 'font-size:15px;line-height:1.6;margin-bottom:20px;color:#c7d5e0;';
        body.innerHTML = '<div id="lt-unfix-progress-msg">' + lt('Removing fix files...') + '</div>';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-top:16px;display:flex;justify-content:center;';
        const hideBtn = document.createElement('a');
        hideBtn.href = '#';
        hideBtn.className = 'luatools-btn';
        hideBtn.style.minWidth = '140px';
        hideBtn.innerHTML = `<span>${lt('Hide')}</span>`;
        hideBtn.onclick = function(e){ e.preventDefault(); overlay.remove(); };
        btnRow.appendChild(hideBtn);

        styleGreyscaleLoadingModal(modal);
        styleGreyscaleLoadingTitle(title);
        styleGreyscaleLoadingBody(body);
        styleGreyscaleLoadingButton(hideBtn, false);

        modal.appendChild(title);
        modal.appendChild(body);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        
        pollUnfixProgress(appid);
    }

    
    function pollUnfixProgress(appid) {
        const poll = function() {
            try {
                const overlayEl = document.querySelector('.luatools-unfix-overlay');
                if (!overlayEl) return; 
                
                Millennium.callServerMethod('luatools', 'GetUnfixStatus', { appid: appid, contentScriptQuery: '' }).then(function(res){
                    try {
                        const payload = typeof res === 'string' ? JSON.parse(res) : res;
                        if (payload && payload.success && payload.state) {
                            const state = payload.state;
                            const msgEl = document.getElementById('lt-unfix-progress-msg');
                            
                            if (state.status === 'removing') {
                                if (msgEl) msgEl.textContent = state.progress || lt('Removing fix files...');
                                
                                setTimeout(poll, 500);
                            } else if (state.status === 'done') {
                                const filesRemoved = state.filesRemoved || 0;
                                if (msgEl) msgEl.textContent = lt('Removed {count} files. Running Steam verification...').replace('{count}', filesRemoved);
                                
                                try {
                                    const btnRow = overlayEl.querySelector('div[style*="justify-content:flex-end"]');
                                    if (btnRow) {
                                        btnRow.innerHTML = '';
                                        const closeBtn = document.createElement('a');
                                        closeBtn.href = '#';
                                        closeBtn.className = 'luatools-btn primary';
                                        closeBtn.style.minWidth = '140px';
                                        closeBtn.innerHTML = `<span>${lt('Close')}</span>`;
                                        closeBtn.onclick = function(e){ e.preventDefault(); overlayEl.remove(); };
                                        styleGreyscaleLoadingButton(closeBtn, true);
                                        btnRow.appendChild(closeBtn);
                                    }
                                } catch(_) {}
                                
                                
                                setTimeout(function(){
                                    try {
                                        const verifyUrl = 'steam://validate/' + appid;
                                        window.location.href = verifyUrl;
                                        backendLog('LuaTools: Running verify for appid ' + appid);
                                    } catch(_) {}
                                }, 1000);
                                
                                return; 
                            } else if (state.status === 'failed') {
                                if (msgEl) msgEl.textContent = lt('Failed: {error}').replace('{error}', state.error || lt('Unknown error'));
                                
                                try {
                                    const btnRow = overlayEl.querySelector('div[style*="justify-content:flex-end"]');
                                    if (btnRow) {
                                        btnRow.innerHTML = '';
                                        const closeBtn = document.createElement('a');
                                        closeBtn.href = '#';
                                        closeBtn.className = 'luatools-btn primary';
                                        closeBtn.style.minWidth = '140px';
                                        closeBtn.innerHTML = `<span>${lt('Close')}</span>`;
                                        closeBtn.onclick = function(e){ e.preventDefault(); overlayEl.remove(); };
                                        styleGreyscaleLoadingButton(closeBtn, true);
                                        btnRow.appendChild(closeBtn);
                                    }
                                } catch(_) {}
                                return; 
                            } else {
                                
                                setTimeout(poll, 500);
                            }
                        }
                    } catch(err) {
                        backendLog('LuaTools: GetUnfixStatus error: ' + err);
                    }
                });
            } catch(err) {
                backendLog('LuaTools: pollUnfixProgress error: ' + err);
            }
        };
        setTimeout(poll, 500);
    }

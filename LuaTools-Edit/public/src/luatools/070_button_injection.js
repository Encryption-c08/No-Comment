    function ensureStyles() {
        if (!document.getElementById('luatools-spacing-styles')) {
            const style = document.createElement('style');
            style.id = 'luatools-spacing-styles';
            style.textContent = '.luatools-restart-button, .luatools-button, .luatools-icon-button{ margin-left:6px !important; }';
            document.head.appendChild(style); 
        }
    }

    
    function updateButtonTranslations() {
        try {
            
            const restartBtn = document.querySelector('.luatools-restart-button');
            if (restartBtn) {
                const restartText = lt('Restart Steam');
                restartBtn.title = restartText;
                restartBtn.setAttribute('data-tooltip-text', restartText);
                const rspan = restartBtn.querySelector('span');
                if (rspan) {
                    rspan.textContent = restartText;
                }
            }
            
            
            const luatoolsBtn = document.querySelector('.luatools-button');
            if (luatoolsBtn) {
                const addViaText = lt('Add via LuaTools');
                luatoolsBtn.title = addViaText;
                luatoolsBtn.setAttribute('data-tooltip-text', addViaText);
                const span = luatoolsBtn.querySelector('span');
                if (span) {
                    span.textContent = addViaText;
                }
            }
        } catch(err) {
            backendLog('LuaTools: updateButtonTranslations error: ' + err);
        }
    }

    
    function addLuaToolsButton() {
        
        try {
            const injected = document.querySelectorAll('.luatools-restart-button, .luatools-button, .luatools-icon-button');
            for (let i = 0; i < injected.length; i++) {
                try { injected[i].remove(); } catch(_) {}
            }
        } catch(_) {}
        return;

        
        const currentUrl = window.location.href;
        if (window.__LuaToolsLastUrl !== currentUrl) {
            
            window.__LuaToolsLastUrl = currentUrl;
            window.__LuaToolsButtonInserted = false;
            window.__LuaToolsRestartInserted = false;
            window.__LuaToolsIconInserted = false;
            window.__LuaToolsPresenceCheckInFlight = false;
            window.__LuaToolsPresenceCheckAppId = undefined;
            
            ensureTranslationsLoaded(false).then(function() {
                updateButtonTranslations();
            });
        }
        
        
        const steamdbContainer = document.querySelector('.steamdb-buttons') || 
                                document.querySelector('[data-steamdb-buttons]') ||
                                document.querySelector('.apphub_OtherSiteInfo');

        if (steamdbContainer) {
            
            const existingBtn = document.querySelector('.luatools-button');
            if (existingBtn) {
                ensureTranslationsLoaded(false).then(function() {
                    updateButtonTranslations();
                });
            }
            
            
            if (existingBtn || window.__LuaToolsButtonInserted) {
                if (!logState.existsOnce) { backendLog('LuaTools button already exists, skipping'); logState.existsOnce = true; }
                
                return;
            }

            
            try {
                if (!document.querySelector('.luatools-restart-button') && !window.__LuaToolsRestartInserted) {
                    ensureStyles();
                    const referenceBtn = steamdbContainer.querySelector('a');
                    const restartBtn = document.createElement('a');
                    if (referenceBtn && referenceBtn.className) {
                        restartBtn.className = referenceBtn.className + ' luatools-restart-button';
                    } else {
                        restartBtn.className = 'btnv6_blue_hoverfade btn_medium luatools-restart-button';
                    }
                    restartBtn.href = '#';
                    const restartText = lt('Restart Steam');
                    restartBtn.title = restartText;
                    restartBtn.setAttribute('data-tooltip-text', restartText);
                    const rspan = document.createElement('span');
                    rspan.textContent = restartText;
                    restartBtn.appendChild(rspan);
                    
                    try {
                        if (referenceBtn) {
                            const cs = window.getComputedStyle(referenceBtn);
                            restartBtn.style.marginLeft = cs.marginLeft;
                            restartBtn.style.marginRight = cs.marginRight;
                        }
                    } catch(_) {}

                    restartBtn.addEventListener('click', function(e){
                        e.preventDefault();
                        try { Millennium.callServerMethod('luatools', 'RestartSteam', { contentScriptQuery: '' }); } catch(_) {}
                    });

                    if (referenceBtn && referenceBtn.parentElement) {
                        referenceBtn.after(restartBtn);
                    } else {
                        steamdbContainer.appendChild(restartBtn);
                    }
                    
                    try {
                        if (!document.querySelector('.luatools-icon-button') && !window.__LuaToolsIconInserted) {
                            const iconBtn = document.createElement('a');
                            if (referenceBtn && referenceBtn.className) {
                                iconBtn.className = referenceBtn.className + ' luatools-icon-button';
                            } else {
                                iconBtn.className = 'btnv6_blue_hoverfade btn_medium luatools-icon-button';
                            }
                            iconBtn.href = '#';
                            iconBtn.title = 'LuaTools Helper';
                            iconBtn.setAttribute('data-tooltip-text', 'LuaTools Helper');
                            
                            try {
                                if (referenceBtn) {
                                    const cs = window.getComputedStyle(referenceBtn);
                                    iconBtn.style.marginLeft = cs.marginLeft;
                                    iconBtn.style.marginRight = cs.marginRight;
                                }
                            } catch(_) {}
                            const ispan = document.createElement('span');
                            const img = document.createElement('img');
                            img.alt = '';
                            img.style.height = '16px';
                            img.style.width = '16px';
                            img.style.verticalAlign = 'middle';
                            
                            try {
                                Millennium.callServerMethod('luatools', 'GetIconDataUrl', { contentScriptQuery: '' }).then(function(res){
                                    try {
                                        const payload = typeof res === 'string' ? JSON.parse(res) : res;
                                        if (payload && payload.success && payload.dataUrl) {
                                            img.src = payload.dataUrl;
                                        } else {
                                            img.src = 'LuaTools/luatools-icon.png';
                                        }
                                    } catch(_) { img.src = 'LuaTools/luatools-icon.png'; }
                                });
                            } catch(_) {
                                img.src = 'LuaTools/luatools-icon.png';
                            }
                            
                            img.onerror = function(){
                                ispan.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9.94 3.06l-2.12-.35a7.962 7.962 0 00-1.02-2.46l1.29-1.72a.75.75 0 00-.09-.97l-1.41-1.41a.75.75 0 00-.97-.09l-1.72 1.29c-.77-.44-1.6-.78-2.46-1.02L13.06 2.06A.75.75 0 0012.31 2h-1.62a.75.75 0 00-.75.65l-.35 2.12a7.962 7.962 0 00-2.46 1.02L5 4.6a.75.75 0 00-.97.09L2.62 6.1a.75.75 0 00-.09.97l1.29 1.72c-.44.77-.78 1.6-1.02 2.46l-2.12.35a.75.75 0 00-.65.75v1.62c0 .37.27.69.63.75l2.14.36c.24.86.58 1.69 1.02 2.46L2.53 18a.75.75 0 00.09.97l1.41 1.41c.26.26.67.29.97.09l1.72-1.29c.77.44 1.6.78 2.46 1.02l.35 2.12c.06.36.38.63.75.63h1.62c.37 0 .69-.27.75-.63l.36-2.14c.86-.24 1.69-.58 2.46-1.02l1.72 1.29c.3.2.71.17.97-.09l1.41-1.41c.26-.26.29-.67.09-.97l-1.29-1.72c.44-.77.78-1.6 1.02-2.46l2.12-.35c.36-.06.63-.38.63-.75v-1.62a.75.75 0 00-.65-.75z"/></svg>';
                            };
                            ispan.appendChild(img);
                            iconBtn.appendChild(ispan);
                            iconBtn.addEventListener('click', function(e){ e.preventDefault(); showSettingsPopup(); });
                            restartBtn.after(iconBtn);
                            window.__LuaToolsIconInserted = true;
                            backendLog('Inserted Icon button');
                        }
                    } catch(_) {}
                    window.__LuaToolsRestartInserted = true;
                    backendLog('Inserted Restart Steam button');
                }
            } catch(_) {}

            
            if (document.querySelector('.luatools-button') || window.__LuaToolsButtonInserted) {
                return;
            }
            
            
            let referenceBtn = steamdbContainer.querySelector('a');
            const luatoolsButton = document.createElement('a');
            luatoolsButton.href = '#';
            
            if (referenceBtn && referenceBtn.className) {
                luatoolsButton.className = referenceBtn.className + ' luatools-button';
            } else {
                luatoolsButton.className = 'btnv6_blue_hoverfade btn_medium luatools-button';
            }
            const span = document.createElement('span');
            const addViaText = lt('Add via LuaTools');
            span.textContent = addViaText;
            luatoolsButton.appendChild(span);
            
            luatoolsButton.title = addViaText;
            luatoolsButton.setAttribute('data-tooltip-text', addViaText);
            
            try {
                if (referenceBtn) {
                    const cs = window.getComputedStyle(referenceBtn);
                    luatoolsButton.style.marginLeft = cs.marginLeft;
                    luatoolsButton.style.marginRight = cs.marginRight;
                }
            } catch(_) {}
            
            
            luatoolsButton.addEventListener('click', function(e) {
                e.preventDefault();
                backendLog('LuaTools button clicked (delegated handler will process)');
            });
            
            
            try {
                const match = window.location.href.match(/https:\/\/store\.steampowered\.com\/app\/(\d+)/) || window.location.href.match(/https:\/\/steamcommunity\.com\/app\/(\d+)/);
                const appid = match ? parseInt(match[1], 10) : NaN;
                if (!isNaN(appid) && typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                    
                    if (window.__LuaToolsPresenceCheckInFlight && window.__LuaToolsPresenceCheckAppId === appid) {
                        return;
                    }
                    window.__LuaToolsPresenceCheckInFlight = true;
                    window.__LuaToolsPresenceCheckAppId = appid;
                    window.__LuaToolsCurrentAppId = appid;
                    Millennium.callServerMethod('luatools', 'HasLuaToolsForApp', { appid, contentScriptQuery: '' }).then(function(res){
                        try {
                            const payload = typeof res === 'string' ? JSON.parse(res) : res;
                            if (payload && payload.success && payload.exists === true) {
                                backendLog('LuaTools already present for this app; not inserting button');
                                window.__LuaToolsPresenceCheckInFlight = false;
                                return; 
                            }
                            
                            if (!document.querySelector('.luatools-button') && !window.__LuaToolsButtonInserted) {
                                const restartExisting = steamdbContainer.querySelector('.luatools-restart-button');
                                if (restartExisting && restartExisting.after) {
                                    restartExisting.after(luatoolsButton);
                                } else if (referenceBtn && referenceBtn.after) {
                                    referenceBtn.after(luatoolsButton);
                                } else {
                                    steamdbContainer.appendChild(luatoolsButton);
                                }
                                window.__LuaToolsButtonInserted = true;
                                backendLog('LuaTools button inserted');
                            }
                            window.__LuaToolsPresenceCheckInFlight = false;
                        } catch(_) {
                            if (!document.querySelector('.luatools-button') && !window.__LuaToolsButtonInserted) {
                                steamdbContainer.appendChild(luatoolsButton);
                                window.__LuaToolsButtonInserted = true;
                                backendLog('LuaTools button inserted');
                            }
                            window.__LuaToolsPresenceCheckInFlight = false;
                        }
                    });
                } else {
                    if (!document.querySelector('.luatools-button') && !window.__LuaToolsButtonInserted) {
                        const restartExisting = steamdbContainer.querySelector('.luatools-restart-button');
                        if (restartExisting && restartExisting.after) {
                            restartExisting.after(luatoolsButton);
                        } else if (referenceBtn && referenceBtn.after) {
                            referenceBtn.after(luatoolsButton);
                        } else {
                            steamdbContainer.appendChild(luatoolsButton);
                        }
                        window.__LuaToolsButtonInserted = true;
                        backendLog('LuaTools button inserted');
                    }
                }
            } catch(_) {
                if (!document.querySelector('.luatools-button') && !window.__LuaToolsButtonInserted) {
                    const restartExisting = steamdbContainer.querySelector('.luatools-restart-button');
                    if (restartExisting && restartExisting.after) {
                        restartExisting.after(luatoolsButton);
                    } else if (referenceBtn && referenceBtn.after) {
                        referenceBtn.after(luatoolsButton);
                    } else {
                        steamdbContainer.appendChild(luatoolsButton);
                    }
                    window.__LuaToolsButtonInserted = true;
                    backendLog('LuaTools button inserted');
                }
            }
        } else {
            if (!logState.missingOnce) { backendLog('LuaTools: steamdbContainer not found on this page'); logState.missingOnce = true; }
        }
    }
    
    

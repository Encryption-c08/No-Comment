    function showSettingsManagerPopup(forceRefresh, onBack) {
        if (document.querySelector('.NoComment-settings-manager-overlay')) return;

        try { closeToolsMenu(); } catch(_) {}

        ensureNoCommentStyles();
        ensureFontAwesome();

        const overlay = document.createElement('div');
        overlay.className = 'NoComment-settings-manager-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:100000;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.className = 'NoComment-settings-manager-modal';
        modal.style.cssText = 'position:relative;border-radius:8px;min-width:650px;max-width:750px;max-height:85vh;display:flex;flex-direction:column;animation:slideUp 0.1s ease-out;overflow:hidden;';

        const header = document.createElement('div');
        header.className = 'NoComment-settings-manager-header';
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:22px 24px 14px;';

        const title = document.createElement('div');
        title.className = 'NoComment-settings-manager-title';
        title.style.cssText = 'font-size:22px;font-weight:700;';
        title.textContent = t('settings.title', 'NoComment · Settings');

        const iconButtons = document.createElement('div');
        iconButtons.style.cssText = 'display:flex;gap:12px;';

        const closeIconBtn = document.createElement('a');
        closeIconBtn.href = '#';
        closeIconBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:rgba(48,48,48,0.8);border:1px solid rgba(150,150,150,0.35);border-radius:10px;color:#d0d0d0;font-size:18px;text-decoration:none;transition:all 0.3s ease;cursor:pointer;';
        closeIconBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeIconBtn.title = t('settings.close', 'Close');
        closeIconBtn.onmouseover = function() { this.style.background = 'rgba(70,70,70,0.9)'; this.style.transform = 'translateY(-2px) scale(1.05)'; this.style.boxShadow = '0 8px 16px rgba(0,0,0,0.45)'; this.style.borderColor = 'rgba(200,200,200,0.6)'; };
        closeIconBtn.onmouseout = function() { this.style.background = 'rgba(48,48,48,0.8)'; this.style.transform = 'translateY(0) scale(1)'; this.style.boxShadow = 'none'; this.style.borderColor = 'rgba(150,150,150,0.35)'; };
        iconButtons.appendChild(closeIconBtn);

        const contentWrap = document.createElement('div');
        contentWrap.className = 'NoComment-settings-manager-content';
        contentWrap.style.cssText = 'flex:1 1 auto;overflow-y:auto;overflow-x:hidden;padding:18px;margin:0 24px;border-radius:12px;';

        const tabsBar = document.createElement('div');
        tabsBar.className = 'NoComment-settings-tabs';

        const statusRow = document.createElement('div');
        statusRow.style.cssText = 'padding:6px 24px 0;min-height:20px;display:flex;align-items:center;justify-content:center;';
        const statusLine = document.createElement('div');
        statusLine.className = 'NoComment-settings-status';
        statusLine.style.cssText = 'font-size:12px;line-height:18px;color:#cfcfcf;min-height:18px;text-align:center;max-width:100%;';
        statusRow.appendChild(statusLine);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'padding:18px 24px 22px;display:flex;gap:12px;justify-content:space-between;align-items:center;';

        const backBtn = createSettingsButton('back', '<i class="fa-solid fa-arrow-left"></i>');
        const rightButtons = document.createElement('div');
        rightButtons.style.cssText = 'display:flex;gap:8px;';
        const refreshBtn = createSettingsButton('refresh', '<i class="fa-solid fa-arrow-rotate-right"></i>');
        const saveBtn = createSettingsButton('save', '<i class="fa-solid fa-floppy-disk"></i>', true);

        modal.appendChild(header);
        modal.appendChild(tabsBar);
        modal.appendChild(statusRow);
        modal.appendChild(contentWrap);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const state = {
            config: null,
            draft: {},
        };

        let refreshDefaultLabel = '';
        let saveDefaultLabel = '';
        let closeDefaultLabel = '';
        let backDefaultLabel = '';
        let activeTab = 'settings';
        const tabButtons = {};

        function createSettingsButton(id, text, isPrimary) {
            const btn = document.createElement('a');
            btn.id = 'lt-settings-' + id;
            btn.href = '#';
            btn.innerHTML = '<span>' + text + '</span>';

            btn.className = 'NoComment-btn';
            if (isPrimary) {
                btn.classList.add('primary');
            }

            btn.onmouseover = function() {
                if (this.dataset.disabled === '1') {
                    this.style.opacity = '0.6';
                    this.style.cursor = 'not-allowed';
                    return;
                }
            };

            btn.onmouseout = function() {
                if (this.dataset.disabled === '1') {
                    this.style.opacity = '0.5';
                    return;
                }
            };

            if (isPrimary) {
                btn.dataset.disabled = '1';
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }

            return btn;
        }

        header.appendChild(title);
        header.appendChild(iconButtons);
        function applyStaticTranslations() {
            title.textContent = t('settings.title', 'NoComment · Settings');
            refreshBtn.title = t('settings.refresh', 'Refresh');
            saveBtn.title = t('settings.save', 'Save Settings');
            backBtn.title = t('Back', 'Back');
            closeIconBtn.title = t('settings.close', 'Close');
            if (typeof updateTabLabels === 'function') {
                updateTabLabels();
            }
        }
        applyStaticTranslations();

        const tabs = [
            { id: 'settings', label: t('settings.tab.settings', 'Settings') },
            { id: 'games', label: t('settings.tab.games', 'Games') },
            { id: 'fixes', label: t('settings.tab.fixes', 'Online Fix') },
        ];
        tabs.forEach(function(tab) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'NoComment-settings-tab';
            btn.textContent = tab.label;
            btn.dataset.tab = tab.id;
            tabsBar.appendChild(btn);
            tabButtons[tab.id] = btn;
        });

        Object.keys(tabButtons).forEach(function(key) {
            const btn = tabButtons[key];
            if (!btn) return;
            btn.addEventListener('click', function(e){
                e.preventDefault();
                if (key === activeTab) return;
                setActiveTab(key);
            });
        });

        function updateTabLabels() {
            if (tabButtons.settings) tabButtons.settings.textContent = t('settings.tab.settings', 'Settings');
            if (tabButtons.games) tabButtons.games.textContent = t('settings.tab.games', 'Games');
            if (tabButtons.fixes) tabButtons.fixes.textContent = t('settings.tab.fixes', 'Online Fix');
        }
        updateTabLabels();

        function setStatus(text, color) {
            statusLine.textContent = text || '';
            statusLine.style.color = color || '#cfcfcf';
        }

        function clearStatus() {
            statusLine.textContent = '';
            statusLine.style.color = '#cfcfcf';
        }

        function ensureDraftGroup(groupKey) {
            if (!state.draft[groupKey] || typeof state.draft[groupKey] !== 'object') {
                state.draft[groupKey] = {};
            }
            return state.draft[groupKey];
        }

        function collectChanges() {
            if (!state.config || !Array.isArray(state.config.schema)) {
                return {};
            }
            const changes = {};
            for (let i = 0; i < state.config.schema.length; i++) {
                const group = state.config.schema[i];
                if (!group || !group.key) continue;
                const options = Array.isArray(group.options) ? group.options : [];
                const draftGroup = state.draft[group.key] || {};
                const originalGroup = (state.config.values && state.config.values[group.key]) || {};
                const groupChanges = {};
                for (let j = 0; j < options.length; j++) {
                    const option = options[j];
                    if (!option || !option.key) continue;
                    const newValue = draftGroup.hasOwnProperty(option.key) ? draftGroup[option.key] : option.default;
                    const oldValue = originalGroup.hasOwnProperty(option.key) ? originalGroup[option.key] : option.default;
                    if (newValue !== oldValue) {
                        groupChanges[option.key] = newValue;
                    }
                }
                if (Object.keys(groupChanges).length > 0) {
                    changes[group.key] = groupChanges;
                }
            }
            return changes;
        }

        function updateSaveState() {
            const hasChanges = Object.keys(collectChanges()).length > 0;
            const isBusy = saveBtn.dataset.busy === '1';
            if (hasChanges && !isBusy) {
                saveBtn.dataset.disabled = '0';
                saveBtn.style.opacity = '';
                saveBtn.style.cursor = 'pointer';
            } else {
                saveBtn.dataset.disabled = '1';
                saveBtn.style.opacity = '0.6';
                saveBtn.style.cursor = 'not-allowed';
            }
        }

        function optionLabelKey(groupKey, optionKey) {
            if (groupKey === 'general') {
                if (optionKey === 'language') return 'settings.language.label';
            }
            return null;
        }

        function optionDescriptionKey(groupKey, optionKey) {
            if (groupKey === 'general') {
                if (optionKey === 'language') return 'settings.language.description';
            }
            return null;
        }

        function renderSettings() {
            contentWrap.innerHTML = '';
            if (!state.config || !Array.isArray(state.config.schema) || state.config.schema.length === 0) {
                const emptyState = document.createElement('div');
                emptyState.style.cssText = 'padding:14px;background:#1a1a1a;border:1px solid #3a3a3a;border-radius:4px;color:#cfcfcf;';
                emptyState.textContent = t('settings.empty', 'No settings available yet.');
                contentWrap.appendChild(emptyState);
                updateSaveState();
                return;
            }

            for (let i = 0; i < state.config.schema.length; i++) {
                const group = state.config.schema[i];
                if (!group || !group.key) continue;

                const groupEl = document.createElement('div');
                groupEl.style.cssText = 'margin-bottom:18px;';

                const groupTitle = document.createElement('div');
                groupTitle.textContent = t('settings.' + group.key, group.label || group.key);
                if (group.key === 'general') {
                    groupTitle.style.cssText = 'font-size:20px;color:#e6e6e6;margin-bottom:16px;margin-top:0;font-weight:600;text-align:center;';
                } else {
                    groupTitle.style.cssText = 'font-size:14px;font-weight:600;color:#bdbdbd;text-align:center;';
                }
                groupEl.appendChild(groupTitle);

                if (group.description && group.key !== 'general') {
                    const groupDesc = document.createElement('div');
                    groupDesc.style.cssText = 'margin-top:4px;font-size:12px;color:#b0b0b0;';
                    groupDesc.textContent = t('settings.' + group.key + 'Description', group.description);
                    groupEl.appendChild(groupDesc);
                }

                const options = Array.isArray(group.options) ? group.options : [];
                for (let j = 0; j < options.length; j++) {
                    const option = options[j];
                    if (!option || !option.key) continue;
                    if (group.key === 'general' && option.key === 'donateKeys') {
                        continue;
                    }

                    ensureDraftGroup(group.key);
                    if (!state.draft[group.key].hasOwnProperty(option.key)) {
                        const sourceGroup = (state.config.values && state.config.values[group.key]) || {};
                        const initialValue = sourceGroup.hasOwnProperty(option.key) ? sourceGroup[option.key] : option.default;
                        state.draft[group.key][option.key] = initialValue;
                    }

                    const optionEl = document.createElement('div');
                    if (j === 0) {
                        optionEl.style.cssText = 'margin-top:12px;padding-top:0;';
                    } else {
                        optionEl.style.cssText = 'margin-top:12px;padding-top:12px;border-top:1px solid rgba(120,120,120,0.15);';
                    }

                    const optionLabel = document.createElement('div');
                    optionLabel.style.cssText = 'font-size:13px;font-weight:500;color:#e0e0e0;';
                    const labelKey = optionLabelKey(group.key, option.key);
                    optionLabel.textContent = t(labelKey || ('settings.' + group.key + '.' + option.key + '.label'), option.label || option.key);
                    optionEl.appendChild(optionLabel);

                    if (option.description) {
                        const optionDesc = document.createElement('div');
                        optionDesc.style.cssText = 'margin-top:2px;font-size:11px;color:#b0b0b0;';
                        const descKey = optionDescriptionKey(group.key, option.key);
                        optionDesc.textContent = t(descKey || ('settings.' + group.key + '.' + option.key + '.description'), option.description);
                        optionEl.appendChild(optionDesc);
                    }

                    const controlWrap = document.createElement('div');
                    controlWrap.style.cssText = 'margin-top:8px;';

                    if (option.type === 'select') {
                        const selectEl = document.createElement('select');
                        selectEl.style.cssText = 'width:100%;padding:6px 8px;background:#1c1c1c;color:#e0e0e0;border:1px solid #3a3a3a;border-radius:4px;';

                        const choices = Array.isArray(option.choices) ? option.choices : [];
                        for (let c = 0; c < choices.length; c++) {
                            const choice = choices[c];
                            if (!choice) continue;
                            const choiceOption = document.createElement('option');
                            choiceOption.value = String(choice.value);
                            choiceOption.textContent = choice.label || choice.value;
                            selectEl.appendChild(choiceOption);
                        }

                        const currentValue = state.draft[group.key][option.key];
                        if (typeof currentValue !== 'undefined') {
                            selectEl.value = String(currentValue);
                        }

                        selectEl.addEventListener('change', function(){
                            state.draft[group.key][option.key] = selectEl.value;
                            try { backendLog('NoComment: language select changed to ' + selectEl.value); } catch(_) {}
                            updateSaveState();
                            setStatus(t('settings.unsaved', 'Unsaved changes'), '#c7d5e0');
                        });

                        controlWrap.appendChild(selectEl);
                    } else if (option.type === 'toggle') {
                        const toggleWrap = document.createElement('div');
                        toggleWrap.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;';

                        let yesLabel = option.metadata && option.metadata.yesLabel ? String(option.metadata.yesLabel) : 'Yes';
                        let noLabel = option.metadata && option.metadata.noLabel ? String(option.metadata.noLabel) : 'No';

                        const yesBtn = document.createElement('a');
                        yesBtn.href = '#';
                        yesBtn.innerHTML = '<span>' + yesLabel + '</span>';
                        yesBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:130px;padding:7px 14px;border-radius:10px;border:1px solid rgba(150,150,150,0.35);background:linear-gradient(180deg, rgba(56,56,56,0.75), rgba(34,34,34,0.92));color:#d6d6d6;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.2px;transition:all 0.18s ease;box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);';

                        const noBtn = document.createElement('a');
                        noBtn.href = '#';
                        noBtn.innerHTML = '<span>' + noLabel + '</span>';
                        noBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:160px;padding:7px 14px;border-radius:10px;border:1px solid rgba(150,150,150,0.35);background:linear-gradient(180deg, rgba(56,56,56,0.75), rgba(34,34,34,0.92));color:#d6d6d6;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.2px;transition:all 0.18s ease;box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);';

                        const yesSpan = yesBtn.querySelector('span');
                        const noSpan = noBtn.querySelector('span');

                        function applyToggleButtonState(btn, isActive) {
                            btn.dataset.active = isActive ? '1' : '0';
                            if (isActive) {
                                btn.style.background = 'linear-gradient(180deg, rgba(175,175,175,0.9), rgba(122,122,122,0.95))';
                                btn.style.borderColor = 'rgba(230,230,230,0.68)';
                                btn.style.color = '#ffffff';
                                btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)';
                                btn.style.transform = 'translateY(-1px)';
                            } else {
                                btn.style.background = 'linear-gradient(180deg, rgba(56,56,56,0.75), rgba(34,34,34,0.92))';
                                btn.style.borderColor = 'rgba(150,150,150,0.35)';
                                btn.style.color = '#d6d6d6';
                                btn.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
                                btn.style.transform = 'translateY(0)';
                            }
                        }

                        function wireToggleHover(btn) {
                            btn.addEventListener('mouseenter', function() {
                                if (btn.dataset.active === '1') return;
                                btn.style.borderColor = 'rgba(205,205,205,0.5)';
                                btn.style.color = '#f1f1f1';
                                btn.style.transform = 'translateY(-1px)';
                            });
                            btn.addEventListener('mouseleave', function() {
                                if (btn.dataset.active === '1') return;
                                btn.style.borderColor = 'rgba(150,150,150,0.35)';
                                btn.style.color = '#d6d6d6';
                                btn.style.transform = 'translateY(0)';
                            });
                        }

                        wireToggleHover(yesBtn);
                        wireToggleHover(noBtn);

                        function refreshToggleButtons() {
                            const currentValue = state.draft[group.key][option.key] === true;
                            applyToggleButtonState(yesBtn, currentValue);
                            applyToggleButtonState(noBtn, !currentValue);
                            if (yesSpan) yesSpan.style.color = yesBtn.style.color;
                            if (noSpan) noSpan.style.color = noBtn.style.color;
                        }

                        yesBtn.addEventListener('click', function(e){
                            e.preventDefault();
                            state.draft[group.key][option.key] = true;
                            refreshToggleButtons();
                            updateSaveState();
                            setStatus(t('settings.unsaved', 'Unsaved changes'), '#c7d5e0');
                        });

                        noBtn.addEventListener('click', function(e){
                            e.preventDefault();
                            state.draft[group.key][option.key] = false;
                            refreshToggleButtons();
                            updateSaveState();
                            setStatus(t('settings.unsaved', 'Unsaved changes'), '#c7d5e0');
                        });

                        toggleWrap.appendChild(yesBtn);
                        toggleWrap.appendChild(noBtn);
                        controlWrap.appendChild(toggleWrap);
                        refreshToggleButtons();
                    } else {
                        const unsupported = document.createElement('div');
                        unsupported.style.cssText = 'font-size:12px;color:#ffb347;';
                        unsupported.textContent = lt('common.error.unsupportedOption').replace('{type}', option.type);
                        controlWrap.appendChild(unsupported);
                    }

                    optionEl.appendChild(controlWrap);
                    groupEl.appendChild(optionEl);
                }

                contentWrap.appendChild(groupEl);
            }

            updateSaveState();
        }

        function renderInstalledFixesSection(target, titleOverride, filterFn) {
            const host = target || contentWrap;
            const sectionEl = document.createElement('div');
            sectionEl.id = 'NoComment-installed-fixes-section';
            sectionEl.style.cssText = 'margin-top:8px;padding:18px;background:linear-gradient(135deg, rgba(70,70,70,0.2) 0%, rgba(30,30,30,0.6) 100%);border:1px solid rgba(150,150,150,0.35);border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03);position:relative;overflow:hidden;';

            const sectionGlow = document.createElement('div');
            sectionGlow.style.cssText = 'position:absolute;top:-100%;left:-100%;width:300%;height:300%;background:radial-gradient(circle, rgba(180,180,180,0.08) 0%, transparent 70%);pointer-events:none;';
            sectionEl.appendChild(sectionGlow);

            const sectionTitle = document.createElement('div');
            sectionTitle.style.cssText = 'font-size:18px;color:#e6e6e6;margin-bottom:16px;font-weight:700;text-align:center;text-shadow:none;position:relative;z-index:1;letter-spacing:0.5px;';
            sectionTitle.innerHTML = '<i class="fa-solid fa-wrench" style="margin-right:10px;"></i>' + (titleOverride || t('settings.installedFixes.title', 'Installed Fixes'));
            sectionEl.appendChild(sectionTitle);

            const listContainer = document.createElement('div');
            listContainer.id = 'NoComment-fixes-list';
            listContainer.style.cssText = 'min-height:50px;';
            sectionEl.appendChild(listContainer);

            host.appendChild(sectionEl);

            loadInstalledFixes(listContainer, filterFn);
        }

        function loadInstalledFixes(container, filterFn) {
            container.innerHTML = '<div style="padding:14px;text-align:center;color:#cfcfcf;">' + t('settings.installedFixes.loading', 'Scanning for installed fixes...') + '</div>';

            Millennium.callServerMethod('No-Comment', 'GetInstalledFixes', { contentScriptQuery: '' })
                .then(function(res) {
                    const response = typeof res === 'string' ? JSON.parse(res) : res;
                    if (!response || !response.success) {
                        container.innerHTML = '<div style="padding:14px;background:#2a1a1a;border:1px solid #ff5c5c;border-radius:4px;color:#ffb3b3;">' + t('settings.installedFixes.error', 'Failed to load installed fixes.') + '</div>';
                        return;
                    }

                    let fixes = Array.isArray(response.fixes) ? response.fixes : [];
                    if (typeof filterFn === 'function') {
                        fixes = fixes.filter(function(item){ return filterFn(item); });
                    }
                    if (fixes.length === 0) {
                        container.innerHTML = '<div style="padding:14px;background:#1a1a1a;border:1px solid #3a3a3a;border-radius:4px;color:#cfcfcf;text-align:center;">' + t('settings.installedFixes.empty', 'No fixes installed yet.') + '</div>';
                        return;
                    }

                    container.innerHTML = '';
                    for (let i = 0; i < fixes.length; i++) {
                        const fix = fixes[i];
                        const fixEl = createFixListItem(fix, container);
                        container.appendChild(fixEl);
                    }
                })
                .catch(function(err) {
                    container.innerHTML = '<div style="padding:14px;background:#2a1a1a;border:1px solid #ff5c5c;border-radius:4px;color:#ffb3b3;">' + t('settings.installedFixes.error', 'Failed to load installed fixes.') + '</div>';
                });
        }

        function createFixListItem(fix, container) {
            const itemEl = document.createElement('div');
            itemEl.style.cssText = 'margin-bottom:12px;padding:12px;background:rgba(20,20,20,0.85);border:1px solid rgba(140,140,140,0.3);border-radius:6px;display:flex;justify-content:space-between;align-items:center;transition:all 0.2s ease;';
            itemEl.onmouseover = function() { this.style.borderColor = '#bdbdbd'; this.style.background = 'rgba(28,28,28,0.95)'; };
            itemEl.onmouseout = function() { this.style.borderColor = 'rgba(140,140,140,0.3)'; this.style.background = 'rgba(20,20,20,0.85)'; };

            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = 'flex:1;';

            const gameName = document.createElement('div');
            gameName.style.cssText = 'font-size:14px;font-weight:600;color:#f0f0f0;margin-bottom:6px;';
            const fixNameText = fix.gameName ? String(fix.gameName) : '';
            gameName.textContent = fixNameText || ('Unknown Game (' + fix.appid + ')');
            if (!fixNameText || fixNameText.startsWith('Unknown Game') || fixNameText === lt('Unknown Game')) {
                fetchSteamGameName(fix.appid).then(function(name) {
                    if (!name) return;
                    fix.gameName = name;
                    gameName.textContent = name;
                }).catch(function(){});
            }
            infoDiv.appendChild(gameName);

            const detailsDiv = document.createElement('div');
            detailsDiv.style.cssText = 'font-size:11px;color:#b0b0b0;line-height:1.6;';

            if (fix.fixType) {
                const typeSpan = document.createElement('div');
                typeSpan.innerHTML = '<strong style="color:#d0d0d0;">' + t('settings.installedFixes.type', 'Type:') + '</strong> ' + fix.fixType;
                detailsDiv.appendChild(typeSpan);
            }

            if (fix.date) {
                const dateSpan = document.createElement('div');
                dateSpan.innerHTML = '<strong style="color:#d0d0d0;">' + t('settings.installedFixes.date', 'Installed:') + '</strong> ' + fix.date;
                detailsDiv.appendChild(dateSpan);
            }

            if (fix.filesCount > 0) {
                const filesSpan = document.createElement('div');
                filesSpan.innerHTML = '<strong style="color:#d0d0d0;">' + t('settings.installedFixes.files', '{count} files').replace('{count}', fix.filesCount) + '</strong>';
                detailsDiv.appendChild(filesSpan);
            }

            infoDiv.appendChild(detailsDiv);
            itemEl.appendChild(infoDiv);

            const deleteBtn = document.createElement('a');
            deleteBtn.href = '#';
            deleteBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:44px;height:44px;background:rgba(255,80,80,0.12);border:2px solid rgba(255,80,80,0.35);border-radius:12px;color:#ff5050;font-size:18px;text-decoration:none;transition:all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);cursor:pointer;flex-shrink:0;';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteBtn.title = t('settings.installedFixes.delete', 'Delete');
            deleteBtn.onmouseover = function() {
                this.style.background = 'rgba(255,80,80,0.25)';
                this.style.borderColor = 'rgba(255,80,80,0.6)';
                this.style.color = '#ff6b6b';
                this.style.transform = 'translateY(-2px) scale(1.05)';
                this.style.boxShadow = '0 6px 20px rgba(255,80,80,0.4), 0 0 0 4px rgba(255,80,80,0.1)';
            };
            deleteBtn.onmouseout = function() {
                this.style.background = 'rgba(255,80,80,0.12)';
                this.style.borderColor = 'rgba(255,80,80,0.35)';
                this.style.color = '#ff5050';
                this.style.transform = 'translateY(0) scale(1)';
                this.style.boxShadow = 'none';
            };

            deleteBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (deleteBtn.dataset.busy === '1') return;

                showNoCommentConfirm(
                    fix.gameName || 'No-Comment',
                    t('settings.installedFixes.deleteConfirm', 'Are you sure you want to remove this fix? This will delete fix files and run Steam verification.'),
                    function() {
                        
                        deleteBtn.dataset.busy = '1';
                        deleteBtn.style.opacity = '0.6';
                        deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

                        Millennium.callServerMethod('No-Comment', 'UnFixGame', {
                            appid: fix.appid,
                            installPath: fix.installPath || '',
                            fixDate: fix.date || '',
                            contentScriptQuery: ''
                        })
                        .then(function(res) {
                            const response = typeof res === 'string' ? JSON.parse(res) : res;
                            if (!response || !response.success) {
                                alert(t('settings.installedFixes.deleteError', 'Failed to remove fix.'));
                                deleteBtn.dataset.busy = '0';
                                deleteBtn.style.opacity = '1';
                                deleteBtn.innerHTML = '<span><i class="fa-solid fa-trash"></i> ' + t('settings.installedFixes.delete', 'Delete') + '</span>';
                                return;
                            }

                            
                            pollUnfixStatus(fix.appid, itemEl, deleteBtn, container);
                        })
                        .catch(function(err) {
                            alert(t('settings.installedFixes.deleteError', 'Failed to remove fix.') + ' ' + (err && err.message ? err.message : ''));
                            deleteBtn.dataset.busy = '0';
                            deleteBtn.style.opacity = '1';
                            deleteBtn.innerHTML = '<span><i class="fa-solid fa-trash"></i> ' + t('settings.installedFixes.delete', 'Delete') + '</span>';
                        });
                    },
                    function() {
                        
                    }
                );
            });

            itemEl.appendChild(deleteBtn);
            return itemEl;
        }

        function pollUnfixStatus(appid, itemEl, deleteBtn, container) {
            let pollCount = 0;
            const maxPolls = 60;

            function checkStatus() {
                if (pollCount >= maxPolls) {
                    alert(t('settings.installedFixes.deleteError', 'Failed to remove fix.') + ' (Timeout)');
                    deleteBtn.dataset.busy = '0';
                    deleteBtn.style.opacity = '1';
                    deleteBtn.innerHTML = '<span><i class="fa-solid fa-trash"></i> ' + t('settings.installedFixes.delete', 'Delete') + '</span>';
                    return;
                }

                pollCount++;

                Millennium.callServerMethod('No-Comment', 'GetUnfixStatus', { appid: appid, contentScriptQuery: '' })
                    .then(function(res) {
                        const response = typeof res === 'string' ? JSON.parse(res) : res;
                        if (!response || !response.success) {
                            setTimeout(checkStatus, 500);
                            return;
                        }

                        const state = response.state || {};
                        const status = state.status;

                        if (status === 'done' && state.success) {
                            
                            itemEl.style.transition = 'all 0.3s ease';
                            itemEl.style.opacity = '0';
                            itemEl.style.transform = 'translateX(-20px)';
                            setTimeout(function() {
                                itemEl.remove();
                                
                                if (container.children.length === 0) {
                                    container.innerHTML = '<div style="padding:14px;background:#102039;border:1px solid #2a475e;border-radius:4px;color:#c7d5e0;text-align:center;">' + t('settings.installedFixes.empty', 'No fixes installed yet.') + '</div>';
                                }
                            }, 300);
                            
                            
                            setTimeout(function(){
                                try {
                                    const verifyUrl = 'steam://validate/' + appid;
                                    window.location.href = verifyUrl;
                                    backendLog('NoComment: Running verify for appid ' + appid);
                                } catch(_) {}
                            }, 1000);
                            
                            return;
                        } else if (status === 'failed' || (status === 'done' && !state.success)) {
                            alert(t('settings.installedFixes.deleteError', 'Failed to remove fix.') + ' ' + (state.error || ''));
                            deleteBtn.dataset.busy = '0';
                            deleteBtn.style.opacity = '1';
                            deleteBtn.innerHTML = '<span><i class="fa-solid fa-trash"></i> ' + t('settings.installedFixes.delete', 'Delete') + '</span>';
                            return;
                        } else {
                            
                            setTimeout(checkStatus, 500);
                        }
                    })
                    .catch(function(err) {
                        setTimeout(checkStatus, 500);
                    });
            }

            checkStatus();
        }

        function renderInstalledLuaSection(target, titleOverride) {
            const host = target || contentWrap;
            const sectionEl = document.createElement('div');
            sectionEl.id = 'NoComment-installed-lua-section';
            sectionEl.style.cssText = 'margin-top:8px;padding:18px;background:linear-gradient(135deg, rgba(70,70,70,0.2) 0%, rgba(30,30,30,0.6) 100%);border:1px solid rgba(150,150,150,0.35);border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03);position:relative;overflow:hidden;';

            const sectionGlow = document.createElement('div');
            sectionGlow.style.cssText = 'position:absolute;top:-100%;left:-100%;width:300%;height:300%;background:radial-gradient(circle, rgba(180,180,180,0.08) 0%, transparent 70%);pointer-events:none;';
            sectionEl.appendChild(sectionGlow);

            const sectionTitle = document.createElement('div');
            sectionTitle.style.cssText = 'font-size:18px;color:#e6e6e6;margin-bottom:16px;font-weight:700;text-align:center;text-shadow:none;position:relative;z-index:1;letter-spacing:0.5px;';
            sectionTitle.innerHTML = '<i class="fa-solid fa-code" style="margin-right:10px;"></i>' + (titleOverride || t('settings.installedLua.title', 'Installed Lua Scripts'));
            sectionEl.appendChild(sectionTitle);

            const searchRow = document.createElement('div');
            searchRow.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:14px;position:relative;z-index:1;';
            const searchBox = document.createElement('div');
            searchBox.style.cssText = 'position:relative;flex:1;min-width:0;width:100%;';
            const searchIcon = document.createElement('i');
            searchIcon.className = 'fa-solid fa-magnifying-glass';
            searchIcon.style.cssText = 'position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#a8a8a8;font-size:12px;pointer-events:none;';
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = t('settings.installedLua.searchPlaceholder', 'Search games or AppID...');
            searchInput.style.cssText = 'display:block;width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:10px 32px 10px 32px;border-radius:10px;border:1px solid rgba(150,150,150,0.35);background:rgba(15,15,15,0.65);color:#e0e0e0;font-size:13px;outline:none;box-shadow:inset 0 1px 2px rgba(0,0,0,0.35);';
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.style.cssText = 'position:absolute;right:6px;top:50%;transform:translateY(-50%);width:26px;height:26px;border-radius:8px;border:1px solid rgba(160,160,160,0.35);background:rgba(80,80,80,0.25);color:#d0d0d0;cursor:pointer;display:none;align-items:center;justify-content:center;padding:0;';
            clearBtn.innerHTML = '<i class="fa-solid fa-xmark" style="font-size:12px;"></i>';
            clearBtn.onmouseover = function() { this.style.background = 'rgba(120,120,120,0.35)'; this.style.borderColor = 'rgba(200,200,200,0.6)'; };
            clearBtn.onmouseout = function() { this.style.background = 'rgba(80,80,80,0.25)'; this.style.borderColor = 'rgba(160,160,160,0.35)'; };
            searchBox.appendChild(searchIcon);
            searchBox.appendChild(searchInput);
            searchBox.appendChild(clearBtn);
            searchRow.appendChild(searchBox);
            sectionEl.appendChild(searchRow);

            const listContainer = document.createElement('div');
            listContainer.id = 'NoComment-lua-list';
            listContainer.style.cssText = 'min-height:50px;';
            sectionEl.appendChild(listContainer);

            host.appendChild(sectionEl);

            loadInstalledLuaScripts(listContainer, searchInput, clearBtn);
        }

        function loadInstalledLuaScripts(container, searchInput, clearBtn) {
            if (searchInput) {
                searchInput.value = '';
                if (clearBtn) clearBtn.style.display = 'none';
            }
            container.innerHTML = '<div style="padding:14px;text-align:center;color:#cfcfcf;">' + t('settings.installedLua.loading', 'Scanning for installed Lua scripts...') + '</div>';

            Millennium.callServerMethod('No-Comment', 'GetInstalledLuaScripts', { contentScriptQuery: '' })
                .then(function(res) {
                    const response = typeof res === 'string' ? JSON.parse(res) : res;
                    if (!response || !response.success) {
                        container.innerHTML = '<div style="padding:14px;background:#2a1a1a;border:1px solid #ff5c5c;border-radius:4px;color:#ffb3b3;">' + t('settings.installedLua.error', 'Failed to load installed Lua scripts.') + '</div>';
                        return;
                    }

                    const scripts = Array.isArray(response.scripts) ? response.scripts : [];
                    if (scripts.length === 0) {
                        container.innerHTML = '<div style="padding:14px;background:#1a1a1a;border:1px solid #3a3a3a;border-radius:4px;color:#cfcfcf;text-align:center;">' + t('settings.installedLua.empty', 'No Lua scripts installed yet.') + '</div>';
                        return;
                    }

                    function renderLuaList(filtered, query) {
                        container.innerHTML = '';

                        if (filtered.length === 0) {
                            const empty = document.createElement('div');
                            empty.style.cssText = 'padding:14px;background:#1a1a1a;border:1px solid #3a3a3a;border-radius:4px;color:#cfcfcf;text-align:center;';
                            empty.textContent = query ? t('settings.installedLua.searchEmpty', 'No games match your search.') : t('settings.installedLua.empty', 'No Lua scripts installed yet.');
                            container.appendChild(empty);
                            return;
                        }

                        
                        for (let i = 0; i < filtered.length; i++) {
                            const script = filtered[i];
                            const scriptEl = createLuaListItem(script, container);
                            container.appendChild(scriptEl);
                        }
                    }

                    function applyFilter() {
                        const term = searchInput ? (searchInput.value || '').trim().toLowerCase() : '';
                        if (clearBtn) clearBtn.style.display = term ? 'flex' : 'none';
                        if (!term) {
                            renderLuaList(scripts, '');
                            return;
                        }

                        const filtered = scripts.filter(function(s) {
                            const name = (s.gameName || '').toLowerCase();
                            const appid = s.appid ? String(s.appid) : '';
                            return name.includes(term) || appid.includes(term);
                        });
                        renderLuaList(filtered, term);
                    }

                    if (searchInput) {
                        searchInput.addEventListener('input', applyFilter);
                        if (clearBtn) {
                            clearBtn.addEventListener('click', function() {
                                searchInput.value = '';
                                searchInput.focus();
                                applyFilter();
                            });
                        }
                    }

                    applyFilter();
                })
                .catch(function(err) {
                    container.innerHTML = '<div style="padding:14px;background:#2a1a1a;border:1px solid #ff5c5c;border-radius:4px;color:#ffb3b3;">' + t('settings.installedLua.error', 'Failed to load installed Lua scripts.') + '</div>';
                });
        }

        function createLuaListItem(script, container) {
            const itemEl = document.createElement('div');
            itemEl.style.cssText = 'margin-bottom:12px;padding:12px;background:rgba(20,20,20,0.85);border:1px solid rgba(140,140,140,0.3);border-radius:6px;display:flex;justify-content:space-between;align-items:center;transition:all 0.2s ease;';
            itemEl.onmouseover = function() { this.style.borderColor = '#bdbdbd'; this.style.background = 'rgba(28,28,28,0.95)'; };
            itemEl.onmouseout = function() { this.style.borderColor = 'rgba(140,140,140,0.3)'; this.style.background = 'rgba(20,20,20,0.85)'; };

            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = 'flex:1;';

            const gameName = document.createElement('div');
            gameName.style.cssText = 'font-size:14px;font-weight:600;color:#f0f0f0;margin-bottom:6px;';
            const scriptNameText = script.gameName ? String(script.gameName) : '';
            gameName.textContent = scriptNameText || ('Unknown Game (' + script.appid + ')');
            if (!scriptNameText || scriptNameText.startsWith('Unknown Game') || scriptNameText === lt('Unknown Game')) {
                fetchSteamGameName(script.appid).then(function(name) {
                    if (!name) return;
                    script.gameName = name;
                    gameName.textContent = name;
                }).catch(function(){});
            }

            if (script.isDisabled) {
                const disabledBadge = document.createElement('span');
                disabledBadge.style.cssText = 'margin-left:8px;padding:2px 8px;background:rgba(140,140,140,0.2);border:1px solid rgba(200,200,200,0.5);border-radius:4px;font-size:10px;color:#e0e0e0;font-weight:500;';
                disabledBadge.textContent = t('settings.installedLua.disabled', 'Disabled');
                gameName.appendChild(disabledBadge);
            }

            infoDiv.appendChild(gameName);

            const detailsDiv = document.createElement('div');
            detailsDiv.style.cssText = 'font-size:11px;color:#b0b0b0;line-height:1.6;';

            if (script.modifiedDate) {
                const dateSpan = document.createElement('div');
                dateSpan.innerHTML = '<strong style="color:#d0d0d0;">' + t('settings.installedLua.modified', 'Modified:') + '</strong> ' + script.modifiedDate;
                detailsDiv.appendChild(dateSpan);
            }

            infoDiv.appendChild(detailsDiv);
            itemEl.appendChild(infoDiv);

            const actionsWrap = document.createElement('div');
            actionsWrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:12px;';

            function createActionButton(titleText, iconClass) {
                const btn = document.createElement('a');
                btn.href = '#';
                btn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:38px;height:38px;background:rgba(100,100,100,0.14);border:1px solid rgba(170,170,170,0.35);border-radius:10px;color:#e0e0e0;font-size:14px;text-decoration:none;transition:all 0.2s ease;cursor:pointer;';
                btn.innerHTML = '<i class="' + iconClass + '"></i>';
                btn.title = titleText;
                btn.onmouseover = function() {
                    this.style.background = 'rgba(140,140,140,0.24)';
                    this.style.borderColor = 'rgba(220,220,220,0.55)';
                    this.style.transform = 'translateY(-1px)';
                };
                btn.onmouseout = function() {
                    this.style.background = 'rgba(100,100,100,0.14)';
                    this.style.borderColor = 'rgba(170,170,170,0.35)';
                    this.style.transform = 'translateY(0)';
                };
                return btn;
            }

            const storeBtn = createActionButton(t('settings.installedLua.openStore', 'Open Store Page'), 'fa-solid fa-store');
            storeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                try {
                    if (typeof openSteamStore === 'function') {
                        openSteamStore(script.appid);
                    } else if (typeof openExternalUrl === 'function') {
                        openExternalUrl('https://store.steampowered.com/app/' + String(script.appid) + '/');
                    }
                } catch(_) {}
            });
            actionsWrap.appendChild(storeBtn);

            const steamDbBtn = createActionButton(t('settings.installedLua.openSteamDB', 'Open SteamDB Page'), 'fa-solid fa-database');
            steamDbBtn.addEventListener('click', function(e) {
                e.preventDefault();
                try {
                    if (typeof openSteamDbApp === 'function') {
                        openSteamDbApp(script.appid);
                    } else if (typeof openExternalUrl === 'function') {
                        openExternalUrl('https://steamdb.info/app/' + String(script.appid) + '/');
                    }
                } catch(_) {}
            });
            actionsWrap.appendChild(steamDbBtn);

            const deleteBtn = document.createElement('a');
            deleteBtn.href = '#';
            deleteBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:44px;height:44px;background:rgba(255,80,80,0.12);border:2px solid rgba(255,80,80,0.35);border-radius:12px;color:#ff5050;font-size:18px;text-decoration:none;transition:all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);cursor:pointer;flex-shrink:0;';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteBtn.title = t('settings.installedLua.delete', 'Remove');
            deleteBtn.onmouseover = function() {
                this.style.background = 'rgba(255,80,80,0.25)';
                this.style.borderColor = 'rgba(255,80,80,0.6)';
                this.style.color = '#ff6b6b';
                this.style.transform = 'translateY(-2px) scale(1.05)';
                this.style.boxShadow = '0 6px 20px rgba(255,80,80,0.4), 0 0 0 4px rgba(255,80,80,0.1)';
            };
            deleteBtn.onmouseout = function() {
                this.style.background = 'rgba(255,80,80,0.12)';
                this.style.borderColor = 'rgba(255,80,80,0.35)';
                this.style.color = '#ff5050';
                this.style.transform = 'translateY(0) scale(1)';
                this.style.boxShadow = 'none';
            };

            deleteBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (deleteBtn.dataset.busy === '1') return;

                deleteBtn.dataset.busy = '1';
                deleteBtn.style.opacity = '0.6';
                deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

                Millennium.callServerMethod('No-Comment', 'DeleteNoCommentForApp', {
                    appid: script.appid,
                    contentScriptQuery: ''
                })
                .then(function(res) {
                    const response = typeof res === 'string' ? JSON.parse(res) : res;
                    if (!response || !response.success) {
                        alert(t('settings.installedLua.deleteError', 'Failed to remove Lua script.'));
                        deleteBtn.dataset.busy = '0';
                        deleteBtn.style.opacity = '1';
                        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                        return;
                    }

                    try {
                        if (typeof invalidateInstalledLuaScriptsCache === 'function') {
                            invalidateInstalledLuaScriptsCache();
                        }
                    } catch(_) {}

                    itemEl.style.transition = 'all 0.3s ease';
                    itemEl.style.opacity = '0';
                    itemEl.style.transform = 'translateX(-20px)';
                    setTimeout(function() {
                        itemEl.remove();

                        if (container.children.length === 0) {
                            container.innerHTML = '<div style="padding:14px;background:#1a1a1a;border:1px solid #3a3a3a;border-radius:4px;color:#cfcfcf;text-align:center;">' + t('settings.installedLua.empty', 'No Lua scripts installed yet.') + '</div>';
                        }
                        scheduleRestartSteam(3);
                    }, 300);
                })
                .catch(function(err) {
                    alert(t('settings.installedLua.deleteError', 'Failed to remove Lua script.') + ' ' + (err && err.message ? err.message : ''));
                    deleteBtn.dataset.busy = '0';
                    deleteBtn.style.opacity = '1';
                    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                });
            });

            actionsWrap.appendChild(deleteBtn);
            itemEl.appendChild(actionsWrap);
            return itemEl;
        }

        function renderGamesTab() {
            contentWrap.innerHTML = '';
            clearStatus();
            renderInstalledLuaSection(contentWrap, t('settings.tab.gamesTitle', 'Games via NoComment'));
        }

        function renderFixesTab() {
            contentWrap.innerHTML = '';
            clearStatus();
            renderInstalledFixesSection(contentWrap, t('settings.tab.fixesTitle', 'Online Fix Installs'), function(item){
                const type = (item && item.fixType) ? String(item.fixType) : '';
                return type.toLowerCase().includes('online fix');
            });
        }

        function renderActiveTab() {
            if (activeTab === 'settings') {
                renderSettings();
                saveBtn.style.display = '';
            } else if (activeTab === 'games') {
                renderGamesTab();
                saveBtn.style.display = 'none';
            } else if (activeTab === 'fixes') {
                renderFixesTab();
                saveBtn.style.display = 'none';
            }
        }

        function setActiveTab(tabId) {
            activeTab = tabId;
            Object.keys(tabButtons).forEach(function(key) {
                if (tabButtons[key]) {
                    tabButtons[key].classList.toggle('active', key === tabId);
                }
            });
            renderActiveTab();
        }

        function handleLoad(force) {
            if (activeTab === 'settings') {
                setStatus(t('settings.loading', 'Loading settings...'), '#c7d5e0');
                saveBtn.dataset.disabled = '1';
                saveBtn.style.opacity = '0.6';
                contentWrap.innerHTML = '<div style="padding:20px;color:#c7d5e0;">' + t('common.status.loading', 'Loading...') + '</div>';
            }

            return fetchSettingsConfig(force).then(function(config){
                state.config = {
                    schemaVersion: config.schemaVersion,
                    schema: Array.isArray(config.schema) ? config.schema : [],
                    values: initialiseSettingsDraft(config),
                    language: config.language,
                    locales: config.locales,
                };
                state.draft = initialiseSettingsDraft(config);
                applyStaticTranslations();
                renderActiveTab();
                if (activeTab === 'settings') {
                    setStatus('', '#c7d5e0');
                }
            }).catch(function(err){
                const message = err && err.message ? err.message : t('settings.error', 'Failed to load settings.');
                if (activeTab === 'settings') {
                    contentWrap.innerHTML = '<div style="padding:20px;color:#ff5c5c;">' + message + '</div>';
                    setStatus(t('common.status.error', 'Error') + ': ' + message, '#ff5c5c');
                } else {
                    ShowNoCommentAlert('No-Comment', message);
                }
            });
        }

        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof onBack === 'function') {
                overlay.remove();
                onBack();
            }
        });

        rightButtons.appendChild(refreshBtn);
        rightButtons.appendChild(saveBtn);
        btnRow.appendChild(backBtn);
        btnRow.appendChild(rightButtons);

        refreshBtn.addEventListener('click', function(e){
            e.preventDefault();
            if (refreshBtn.dataset.busy === '1') return;
            refreshBtn.dataset.busy = '1';
            handleLoad(true).finally(function(){
                refreshBtn.dataset.busy = '0';
                refreshBtn.style.opacity = '1';
                applyStaticTranslations();
            });
        });

        saveBtn.addEventListener('click', function(e){
            e.preventDefault();
            if (saveBtn.dataset.disabled === '1' || saveBtn.dataset.busy === '1') return;

            const changes = collectChanges();
            try { backendLog('NoComment: collectChanges payload ' + JSON.stringify(changes)); } catch(_) {}
            if (!changes || Object.keys(changes).length === 0) {
                setStatus(t('settings.noChanges', 'No changes to save.'), '#c7d5e0');
                updateSaveState();
                return;
            }

            saveBtn.dataset.busy = '1';
            saveBtn.style.opacity = '0.6';
            setStatus(t('settings.saving', 'Saving...'), '#c7d5e0');
            saveBtn.style.opacity = '0.6';

            const payloadToSend = JSON.parse(JSON.stringify(changes));
            try { backendLog('NoComment: sending settings payload ' + JSON.stringify(payloadToSend)); } catch(_) {}
            
            Millennium.callServerMethod('No-Comment', 'ApplySettingsChanges', {
                contentScriptQuery: '',
                changesJson: JSON.stringify(payloadToSend)
            }).then(function(res){
                const response = typeof res === 'string' ? JSON.parse(res) : res;
                if (!response || response.success !== true) {
                    if (response && response.errors) {
                        const errorParts = [];
                        for (const groupKey in response.errors) {
                            if (!Object.prototype.hasOwnProperty.call(response.errors, groupKey)) continue;
                            const optionErrors = response.errors[groupKey];
                            for (const optionKey in optionErrors) {
                                if (!Object.prototype.hasOwnProperty.call(optionErrors, optionKey)) continue;
                                const errorMsg = optionErrors[optionKey];
                                errorParts.push(groupKey + '.' + optionKey + ': ' + errorMsg);
                            }
                        }
                        const errText = errorParts.length ? errorParts.join('\n') : 'Validation failed.';
                        setStatus(errText, '#ff5c5c');
                    } else {
                        const message = (response && response.error) ? response.error : t('settings.saveError', 'Failed to save settings.');
                        setStatus(message, '#ff5c5c');
                    }
                    return;
                }

                const newValues = (response && response.values && typeof response.values === 'object') ? response.values : state.draft;
                state.config.values = initialiseSettingsDraft({ schema: state.config.schema, values: newValues });
                state.draft = initialiseSettingsDraft({ schema: state.config.schema, values: newValues });

                try {
                    if (window.__NoCommentSettings) {
                        window.__NoCommentSettings.values = JSON.parse(JSON.stringify(state.config.values));
                        window.__NoCommentSettings.schemaVersion = state.config.schemaVersion;
                        window.__NoCommentSettings.lastFetched = Date.now();
                        if (response && response.translations && typeof response.translations === 'object') {
                            window.__NoCommentSettings.translations = response.translations;
                        }
                        if (response && response.language) {
                            window.__NoCommentSettings.language = response.language;
                        }
                    }
                } catch(_) {}

                if (response && response.translations && typeof response.translations === 'object') {
                    applyTranslationBundle({
                        language: response.language || (window.__NoCommentI18n && window.__NoCommentI18n.language) || 'en',
                        locales: (window.__NoCommentI18n && window.__NoCommentI18n.locales) || (state.config && state.config.locales) || [],
                        strings: response.translations
                    });
                    applyStaticTranslations();
                    updateButtonTranslations();
                }

                renderSettings();
                setStatus(t('settings.saveSuccess', 'Settings saved successfully.'), '#8bc34a');
            }).catch(function(err){
                const message = err && err.message ? err.message : t('settings.saveError', 'Failed to save settings.');
                setStatus(message, '#ff5c5c');
            }).finally(function(){
                saveBtn.dataset.busy = '0';
                applyStaticTranslations();
                updateSaveState();
            });
        });

        closeIconBtn.addEventListener('click', function(e){
            e.preventDefault();
            overlay.remove();
        });

        overlay.addEventListener('click', function(e){
            if (e.target === overlay) {
            overlay.remove();
        }
        });

        setActiveTab(activeTab);
        handleLoad(!!forceRefresh);
    }

    

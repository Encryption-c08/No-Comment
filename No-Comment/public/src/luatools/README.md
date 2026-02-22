# NoComment Frontend Source Layout

This folder contains the editable source split for the NoComment frontend.

Build output:
- `public/modules/NoComment.app.js` (generated runtime file loaded by bootstrap)

Build command:
- `python scripts/build_frontend.py`

Parts in load order:
- `000_core_widget_base.js` - runtime state, logging, styles, tools widget shell
- `010_tools_settings_popup.js` - tools popup UI and menu actions
- `020_store_bundle_core.js` - i18n helpers, app/bundle detection, store and bundle flows
- `030_fixes_workflow.js` - fixes modal, apply-fix, progress, and unfix orchestration
- `040_settings_config.js` - settings config fetch and draft initialization helpers
- `050_settings_manager_ui.js` - full settings manager UI flow (tabs, render, installed fixes/lua management)
- `060_notifications_alerts.js` - notifications, alerts, confirm dialogs, restart scheduling
- `070_button_injection.js` - Steam page button injection and translation updates
- `080_lifecycle_polling_loaded_apps.js` - frontend boot, click delegation, URL polling, observer wiring

Notes:
- Edit only files in this folder.
- Re-run the build command after editing.
- `deploy.ps1` runs the build automatically before deployment.

# No Comment

 is a Millennium plugin for Steam that injects No Comments UI and backend workflows into the Steam client.

## Base Lua Tools Features

- Remove LuaTools content for an app.
- Add games via LuaTools from Steam store pages.
- Online fix via unsteam
- Localization support with locale validation tooling.

## No Comment Additons & Features

- Bundle Support - Installs all games listed within a bundle.
- DLC/content manager for related app entries.
- Native-looking "In Library" indicators on relevant store surfaces.
- Notification System - No Comment adds a clean & smooth toast like system to notify the user of updates and much more.
- Clickable Ui - With No Comment you'll be able to use a nice UI to manage your games or find new ones, this includes installing games previously delisted.

## Requirements

- Windows + Steam.
- Millennium installed and active. ```https://github.com/SteamClientHomebrew/Millennium/releases/latest```
- Steam Tools. ```https://www.steamtools.net/download```

## Installation

- Inside steam, click the steam icon/text in the very top left
<img width="279" height="347" alt="image" src="https://github.com/user-attachments/assets/48418c58-a704-4d10-b314-042086b5555d" />

- Click on Millennium
- Open the plugins tab
<img width="223" height="349" alt="image" src="https://github.com/user-attachments/assets/e5a7d1ae-21e3-4555-a2b6-233a338e2480" />

- Click on browse local files
<img width="1670" height="144" alt="image" src="https://github.com/user-attachments/assets/3bcd1292-8883-45e7-a969-6b1895058bb7" />

- Extract No-Comment.zip into this plugins folder NOTE: make sure the extracted plugin is not embedded within a folder thats within a folder, it must be "Program Files (x86)\Steam\plugins\No-Comment"
- Enable No-Comment and click save changes, steam should restart shortly
- Vist any store page to check out the features No-Comment has!



## Development Workflow

### Frontend

- Edit source files in `public/src/luatools/`.
- Do not hand-edit `public/modules/luatools.app.js` (generated).
- Rebuild after edits:

```powershell
python scripts/build_frontend.py
```

### Deploy

Default deploy (build + copy + restart Steam):

```powershell
.\deploy.ps1
```

Deploy without restarting Steam:

```powershell
.\deploy.ps1 -NoRestart
```

Deploy to a custom plugins directory:

```powershell
.\deploy.ps1 -PluginsDir "D:\Steam\plugins"
```

## Repository Layout

```text
backend/                 Python backend methods exposed to Millennium
backend/data/            Runtime JSON/text state (settings, limits, update info)
backend/locales/         Locales
backend/settings/        Settings schema + manager
public/                  Injected web assets and bootstrap script
public/src/luatools/     Editable frontend modules (source of truth)
public/modules/          Built frontend bundle output
scripts/                 Utility scripts (build frontend, validate locales)
plugin.json              Millennium plugin manifest
deploy.ps1               Deployment used for testing
```

### Troubleshooting

- Why arent my games I added appearing?

Download ```https://drive.google.com/file/d/1YuhTfPvS-0PPNDc4eIfZ7hWAsvJL2WgJ/view?usp=drive_link```
Open Steam tools
Drag and Drop the lua (The Downloaded One) file onto the steam icon that pops up after opening steam tools
Right click the steam icon then click restart steam
Right click again if needed, otherwise go down to the last option in steam tools and click exit

- what does this do you may ask?

It does a manual install/add of a game and generates the needed files for steam tools to detect added games since it may fail on install

- What game does this install?

Cult Of The Lamb ```app id 1313140```
You may remove this game from your library at any point by going to the store page and clicking remove via No Comment or using the UI (steam icon in the bottom right) and clicking the same button



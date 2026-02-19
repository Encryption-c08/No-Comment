"""Generic helpers for file and data handling in the LuaTools backend."""

from __future__ import annotations

import json
import os
import re
import shutil
from typing import Any, Dict

from config import (
    API_JSON_FILE,
    APPID_LOG_FILE,
    DAILY_ADD_USAGE_FILE,
    LOADED_APPS_FILE,
    TEMP_DOWNLOAD_DIR,
    UPDATE_CONFIG_FILE,
    UPDATE_PENDING_INFO,
    UPDATE_PENDING_ZIP,
)
from paths import backend_path, get_plugin_dir


def read_text(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read()
    except Exception:
        return ""


def write_text(path: str, text: str) -> None:
    _ensure_parent_dir(path)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)


def read_json(path: str) -> Dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return {}


def write_json(path: str, data: Dict[str, Any]) -> None:
    try:
        _ensure_parent_dir(path)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2)
    except Exception:
        pass


def count_apis(text: str) -> int:
    try:
        data = json.loads(text)
        apis = data.get("api_list", [])
        if isinstance(apis, list):
            return len(apis)
    except Exception:
        pass
    return text.count('"name"')


def normalize_manifest_text(text: str) -> str:
    content = (text or "").strip()
    if not content:
        return content

    content = re.sub(r",\s*]", "]", content)
    content = re.sub(r",\s*}\s*$", "}", content)

    if content.startswith('"api_list"') or content.startswith("'api_list'") or content.startswith("api_list"):
        if not content.startswith("{"):
            content = "{" + content
        if not content.endswith("}"):
            content = content.rstrip(",") + "}"

    try:
        json.loads(content)
        return content
    except Exception:
        return text


def parse_version(version: str) -> tuple:
    try:
        parts = [int(part) for part in re.findall(r"\d+", str(version))]
        return tuple(parts or [0])
    except Exception:
        return (0,)


def get_plugin_version() -> str:
    try:
        plugin_json_path = os.path.join(get_plugin_dir(), "plugin.json")
        data = read_json(plugin_json_path)
        return str(data.get("version", "0"))
    except Exception:
        return "0"


def ensure_temp_download_dir() -> str:
    root = backend_path(TEMP_DOWNLOAD_DIR)
    try:
        os.makedirs(root, exist_ok=True)
    except Exception:
        pass
    return root


def _ensure_parent_dir(path: str) -> None:
    parent = os.path.dirname(path)
    if not parent:
        return
    os.makedirs(parent, exist_ok=True)


def _move_legacy_file(old_relative: str, new_relative: str) -> tuple[int, int]:
    old_path = backend_path(old_relative)
    new_path = backend_path(new_relative)
    if not os.path.exists(old_path):
        return (0, 0)
    _ensure_parent_dir(new_path)
    if not os.path.exists(new_path):
        shutil.move(old_path, new_path)
        return (1, 0)
    try:
        os.remove(old_path)
        return (0, 1)
    except Exception:
        return (0, 0)


def _merge_legacy_dir(old_relative: str, new_relative: str) -> int:
    old_path = backend_path(old_relative)
    new_path = backend_path(new_relative)
    if not os.path.isdir(old_path):
        return 0

    os.makedirs(new_path, exist_ok=True)

    for root, dirs, files in os.walk(old_path, topdown=False):
        rel = os.path.relpath(root, old_path)
        target_root = new_path if rel == "." else os.path.join(new_path, rel)
        os.makedirs(target_root, exist_ok=True)

        for filename in files:
            src = os.path.join(root, filename)
            dst = os.path.join(target_root, filename)
            if os.path.exists(dst):
                try:
                    os.remove(src)
                except Exception:
                    pass
            else:
                try:
                    shutil.move(src, dst)
                except Exception:
                    pass

        for dirname in dirs:
            try:
                os.rmdir(os.path.join(root, dirname))
            except Exception:
                pass

    try:
        os.rmdir(old_path)
        return 1
    except Exception:
        return 0


def migrate_legacy_backend_layout() -> Dict[str, int]:
    os.makedirs(backend_path("data"), exist_ok=True)

    legacy_pairs = [
        ("api.json", API_JSON_FILE),
        ("update.json", UPDATE_CONFIG_FILE),
        ("loadedappids.txt", LOADED_APPS_FILE),
        ("appidlogs.txt", APPID_LOG_FILE),
        ("daily_add_limit.json", DAILY_ADD_USAGE_FILE),
        ("update_pending.zip", UPDATE_PENDING_ZIP),
        ("update_pending.json", UPDATE_PENDING_INFO),
    ]

    moved_files = 0
    removed_legacy_files = 0
    for old_relative, new_relative in legacy_pairs:
        moved, removed = _move_legacy_file(old_relative, new_relative)
        moved_files += moved
        removed_legacy_files += removed

    merged_dirs = _merge_legacy_dir("temp_dl", TEMP_DOWNLOAD_DIR)

    return {
        "moved_files": moved_files,
        "removed_legacy_files": removed_legacy_files,
        "merged_dirs": merged_dirs,
    }


__all__ = [
    "backend_path",
    "ensure_temp_download_dir",
    "count_apis",
    "get_plugin_dir",
    "get_plugin_version",
    "normalize_manifest_text",
    "parse_version",
    "migrate_legacy_backend_layout",
    "read_json",
    "read_text",
    "write_json",
    "write_text",
]


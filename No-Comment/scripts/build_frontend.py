from __future__ import annotations

from pathlib import Path


def build_NoComment_frontend() -> None:
    project_root = Path(__file__).resolve().parent.parent
    parts_dir = project_root / "public" / "src" / "luatools"
    output_file = project_root / "public" / "modules" / "NoComment.app.js"

    if not parts_dir.exists():
        raise FileNotFoundError(f"Parts directory not found: {parts_dir}")

    parts = sorted(p for p in parts_dir.glob("*.js") if p.is_file())
    if not parts:
        raise RuntimeError(f"No frontend parts found in: {parts_dir}")

    combined: list[str] = []
    for part in parts:
        text = part.read_text(encoding="utf-8")
        combined.append(text.rstrip("\n"))

    wrapped_sections = [
        "(function() {",
        "    'use strict';",
        "",
        "    if (window.__NoCommentAppLoaded) {",
        "        return;",
        "    }",
        "    window.__NoCommentAppLoaded = true;",
        "",
        "\n\n".join(combined),
        "",
        "})();",
        "",
    ]
    output = "\n".join(wrapped_sections)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(output, encoding="utf-8", newline="")
    print(f"Built {output_file} from {len(parts)} part files.")


if __name__ == "__main__":
    build_NoComment_frontend()

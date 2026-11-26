"""Build the self-contained GameAtlas project website with Python's standard library."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil


# Bundle only simple, adjacent tags. Links with media or other attributes, inline
# scripts, async scripts and modules keep their original position and behavior.
CSS_PATH = r"""["'][\w.-]+\.css(?:\?[^"'<>]*)?["']"""
CSS_LINK = rf"""<link\s+(?:href={CSS_PATH}\s+rel=["']stylesheet["']|rel=["']stylesheet["']\s+href={CSS_PATH})\s*/?>"""
CSS_TAG = rf"(?:{CSS_LINK}|<style>.*?</style>)"
JS_TAG = r"""<script\s+src=["'][\w.-]+\.js(?:\?[^"'<>]*)?["']\s*>\s*</script>"""
FILE_ATTRIBUTE = re.compile(r"""(?:href|src)=["']([^"'?]+)""")


def bundle(section, tag_pattern, extension, site):
    tag = re.compile(tag_pattern, re.DOTALL | re.IGNORECASE)
    adjacent = re.compile(rf"{tag_pattern}(?:\s*{tag_pattern})+", tag.flags)

    def replace(group):
        pieces = []
        for match in tag.finditer(group[0]):
            markup = match[0]
            if markup.lower().startswith("<style>"):
                pieces.append(markup[len("<style>"):-len("</style>")])
            else:
                filename = FILE_ATTRIBUTE.search(markup)[1]
                pieces.append((site / filename).read_text(encoding="utf-8"))

        # Each input was originally a separate resource. A semicolon also
        # prevents two JS expressions from being joined by automatic insertion.
        separator = "\n;\n" if extension == "js" else "\n"
        content = (separator.join(pieces) + "\n").encode("utf-8")
        digest = hashlib.sha256(content).hexdigest()[:16]
        name = f"gameatlas-{digest}.{extension}"
        (site / name).write_bytes(content)
        if extension == "css":
            return f'<link rel="stylesheet" href="{name}">'
        return f'<script defer src="{name}"></script>'

    return adjacent.sub(replace, section)


def write_case_catalogs(site):
    """Keep the source catalog authoritative, while serving only the selected task."""
    assets = site / "case-assets"
    catalog = (assets / "catalog.json").read_bytes()
    version = hashlib.sha256(catalog).hexdigest()[:12]
    directory = assets / "catalog" / version
    directory.mkdir(parents=True)
    tasks = {}
    for row in json.loads(catalog):
        task = row["task"]
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", task):
            raise ValueError(f"Invalid case catalog task: {task!r}")
        tasks.setdefault(task, []).append(row)
    for task, records in tasks.items():
        (directory / f"{task}.json").write_text(
            json.dumps(records, separators=(",", ":"), ensure_ascii=False), encoding="utf-8"
        )
    return directory.relative_to(site).as_posix()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="New directory for the published site")
    output = parser.parse_args().output.resolve()
    source = Path(__file__).resolve().parents[1] / "docs" / "site"
    if source == output or source in output.parents:
        parser.error("Choose an output directory outside docs/site")
    shutil.copytree(source, output)
    index = output / "index.html"
    html = index.read_text(encoding="utf-8")
    catalogs = write_case_catalogs(output)
    html = html.replace('id="case-dialog"', f'id="case-dialog" data-catalog-dir="{catalogs}"', 1)
    head, body = html.split("</head>", 1)
    # The classic startup scripts run before the module that wires up the
    # interactive viewers. Keep that module and any subsequent tags intact.
    module = re.search(r"""<script\s+[^>]*\btype=["']module["']""", body, re.IGNORECASE)
    before_module = module.start() if module else len(body)
    head = bundle(head, CSS_TAG, "css", output)
    body = bundle(body[:before_module], JS_TAG, "js", output) + body[before_module:]
    index.write_text(head + "</head>" + body, encoding="utf-8")


if __name__ == "__main__":
    main()

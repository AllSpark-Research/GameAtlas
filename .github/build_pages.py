"""Prepare the static site for GitHub Pages within the published-site size limit."""
import json
import os
from pathlib import Path
import shutil
import sys
from urllib.parse import quote


def main():
    root = Path(__file__).resolve().parents[1]
    source = root / 'docs' / 'site'
    output = Path(sys.argv[1])
    revision = os.environ['GITHUB_SHA']
    repository = os.environ['GITHUB_REPOSITORY']
    shutil.copytree(source, output)
    scene_files = {}
    for model in output.glob('case-assets/*/sceneactbench-*/*.glb.gz'):
        path = model.relative_to(output).as_posix()
        asset = (source / path).relative_to(root).as_posix()
        scene_files[path] = f'https://raw.githubusercontent.com/{repository}/{revision}/{quote(asset)}'
        model.unlink()

    index = output / 'index.html'
    html = index.read_text()
    if html.count('</head>') != 1:
        raise ValueError('Expected a single HTML head in the project homepage')
    manifest = json.dumps(scene_files, sort_keys=True).replace('<', r'\u003c')
    index.write_text(html.replace('</head>', f'<script type="application/json" id="published-scene-files">{manifest}</script>\n</head>'))


if __name__ == '__main__':
    main()

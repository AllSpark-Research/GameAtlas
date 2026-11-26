# GameAtlas project website

The [project website](https://kylin1112.github.io/GameAtlas/) includes the interactive showcases, task browser and leaderboard. From a sparse checkout, run `git sparse-checkout add docs/site .github` first.

To preview the same build that GitHub Pages serves, run these commands from the repository root. The build uses Python's standard library and writes to a new directory.

```bash
site_dir="$(mktemp -d)/gameatlas"
python3 .github/build_pages.py "$site_dir"
python3 -m http.server 8000 --directory "$site_dir"
```

Open [localhost:8000](http://localhost:8000/). All website assets are served from that directory. The build embeds the shared styles in the HTML and bundles startup scripts into a content-hashed file. GitHub Pages publishes this build when the website changes on the public repository's `main` branch.

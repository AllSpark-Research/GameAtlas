# GameAtlas project website

The [live website](https://kylin1112.github.io/GameAtlas/) includes the interactive 3D showcases, task browser and leaderboard.

To preview it locally, run the following from a full checkout of the repository. If you used the sparse checkout in the main README, first run `git sparse-checkout add docs/site`.

```bash
python3 -m http.server 8000 --directory docs/site
```

Open [localhost:8000](http://localhost:8000/). For a public repository with GitHub Pages enabled, the Pages workflow publishes this directory when the site changes on `main`. Large scene-layout models are served from the same Git commit as the deployed page. Local previews read those files from `case-assets/`.

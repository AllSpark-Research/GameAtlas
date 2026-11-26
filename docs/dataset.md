# Task packages

GameAtlas distributes its 91 task packages on [Hugging Face](https://huggingface.co/datasets/AllSpark-Research/GameAtlas). The [dataset lock](dataset-lock.json) pins the exact revision, checksum manifest and executable file list used by this checkout.

From the repository root, download task 091 or the full collection:

```bash
python3 -m pip install huggingface_hub
python3 -m gameatlasharness.download --task gameatlas_091
# Full collection
python3 -m gameatlasharness.download
```

The downloader verifies each selected file against the pinned SHA-256 manifest and restores the task scripts' executable permissions. For a repository that requires authentication, sign in with `hf auth login` before downloading.

Each directory from `tasks/gameatlas_001` to `tasks/gameatlas_091` contains a `task.toml` with the discipline, environment and submission contract. The agent receives the task instructions and working assets from `environment/`. The evaluator uses `tests/` for scoring. The two Sponza rendering tasks, 087 and 088, have four ordered prompts in `steps/`. The other 89 tasks each have one `instruction.md`.

To evaluate the full collection, download all tasks and omit the `tasks` list from the run configuration. The harness discovers the locally installed packages.

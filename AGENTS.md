# Care Circle build rules

Read docs/BRIEF.md fully, docs/CONTRACT.md, and docs/PLAN.md before work. They govern this track. The user authorizes generous parallel lanes and subagents, all using gpt-6-astra with xhigh reasoning. No other model. Use herdr session carecircle, cc- names, --no-focus. Never use Superset.

Only edit your assigned paths. All agents share main in this tree. No branches, worktrees, reset, rebase, amend, stash, or force push. Commit and push small changes using explicit owned paths. Retry index locks without deleting them. Do not include other lanes' changes. cc-lead alone owns contract/, root docs, root README, AGENTS.md, and orchestration state.

Use scripts/devbrain for code map pages. Every lane maintains code/<component> with Purpose, Run, Files, API, Depends on wikilinks, Gotchas; update at milestones and extract links. Read dependency pages before integrating. Never run plain gbrain. Only cc-brain may use scripts/brain after service start. Never touch ~/.gbrain or the primary track. Do not read credentials. Do not output environment values. Mention needed variable names to cc-lead.

All demo data is synthetic. Bind only 127.0.0.1 and ports 4700 through 4719. Stop only your own exact PIDs. No external data submission without Emre approval except git pushes to this public repo. Reading public technical docs is allowed. Sponsor SDK installs are allowed; actual uploads, training submissions, telemetry traces, accounts and publication require explicit authorization recorded by cc-lead. Never message outside this track.

Authorization update: Emre approves uploading synthetic note/JSON data to River for training and evaluation. Only the River lane may load RIVER_API_KEY from ~/Workspace/qm-raid/services/forge/.env read-only into process env without printing it. Read only that named variable, never other file values, and dry-run until the file exists. This is the only qm-raid exception. Memorable/UFO remote submission and account creation still require approval; local work is approved.

No em dash or en dash characters in authored files, UI, or commit messages. Services communicate only over loopback HTTP. Cross-lane imports are forbidden except shared contract/ and the static world package consumed by brain for seeding. Every service has package metadata, README, GET /health and a smoke test. Prefer Node built-in APIs, no build pipeline unless useful.

Report milestone results to cc-lead with herdr --session carecircle agent prompt cc-lead. Include owned paths, test command/results, commit, blockers, sponsor reality. Freeze all code at 16:40 Pacific. From then until 16:55, demo prep only.

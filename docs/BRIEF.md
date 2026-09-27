# Care Circle: kickoff brief for the Codex orchestrator

Written by the Analyst (Emre's chief of staff) on Sunday 2026-09-27 at about 14:50 Pacific. You are the orchestrator of this track. Read this whole brief, then run the track on your own until 16:40.

## 1. The hackathon

**Event.** "Own Your Intelligence Hackathon" at YC, San Francisco, today.
- **Due:** projects at 17:00. Judging runs 17:00 to 17:45.
- **Build window for this track:** now until a code freeze at 16:40. From 16:40 to 16:55: demo prep only.

**Official goal (verbatim):** "Extend QM and GBrain. Push further with River AI, Memorable, Superset and UFO. Ship something that didn't exist this morning. This isn't a pitch competition."

**Rules:**
- Build something using GBrain.
- No prebuilt projects, and no forks of existing projects.
- Everything must be built during hackathon hours. Every line in this repo must be written today, and the public git history will show that.

**Prizes:**
- **Main:** Grand prize is a YC interview, a 1:1 with Garry Tan, and $5000. Second place is $2000; third is $1000.
- **River AI:** "Best custom LLM/Agent (trained using River API)". 50k, 25k and 15k credits, plus dinner. https://river.ai/own-your-intelligence-hackathon
- **GBrain:** "Automate a tedious task with GBrain". Signed hats.
- **UFO:** "Best new extension" and "Best Automation for startups". Everyone gets $100 in credits.
- **Memorable:** "Most Memorable".
- **QM:** "Extend QM in the most impressive or creative way". Prize: a Mac mini.
- **Superset:** use it and present in a Superset page. Emre decided against Superset today; do not use it.

**Two tracks.**
- **Primary: QM Raid.** An RTS-style agent board for QM swarms with GBrain as a building the agents visit. Repo: `~/Workspace/qm-raid`, github.com/aemrebarut/qm-raid. Claude and Codex agents build it in herdr session `default`.
- **Backup: Care Circle (this track).** Built only by Codex agents in herdr session `carecircle`. Emre will choose what to present near the end. So Care Circle must be demo-ready on its own by 16:40, with an honest README and a 2-minute demo path.

**Sponsor tools (what we know):**
- **GBrain 0.59** (github.com/garrytan/gbrain) is installed as `gbrain`. It is a personal knowledge brain:
  - markdown pages with typed links between them, stored in PGLite;
  - `put`, `get`, `search`, `query`, `remember`, `recall`;
  - `graph`, `graph-query`, `backlinks`, `link --link-type`, `extract links`;
  - `timeline-add`, skills, and an MCP server (`gbrain serve`, or `gbrain serve --http`).
- **River** trains custom models through an API (SFT, RL, distillation, save and serve).
  - Python `river-client`; docs at https://docs.river.ai/
  - The key is `RIVER_API_KEY`, which Emre sets himself.
- **Memorable** (https://www.memorable.sh/) learns reusable procedures from agent tool traces and integrates with GBrain.
- **UFO** (https://ufo.ai) builds extensions and automations; our earlier check could not reach its docs. Emre's note: "UFO can use a browser use MCP to fetch details from the website".
- **QM** (github.com/yc-software/qm) is an agent platform. The primary track owns the local QM instance, so do not touch it. Using QM here is optional and low priority.

## 2. The idea: Care Circle, a shared brain for a family caring for Mom

**The human problem.** Three adult siblings look after their mother, "Rose Alvarez, 81". She sees four specialists who never read each other's notes. The medication list is wrong on every intake form. The siblings text each other "what did the cardiologist say". Every insurer phone tree makes someone retell the whole story. Nothing about this is a startup problem, which is exactly why Emre likes it: it is orthogonal to every other project in the room, and everyone judging has a parent or is one.

**The product.** A family brain in GBrain plus a small web app. Every doctor, medication, visit, lab result and insurer call becomes a typed page linked to the others. The graph then does the work nobody else does:

- **Paste a messy note, get structured updates.** A sibling pastes "cardiology today, lisinopril up to 20mg, wants potassium rechecked".
  - The agent creates the visit page and updates the lisinopril page (dose, who changed it, when, citing the visit).
  - It adds an open question for the nephrologist ("potassium recheck requested by cardiology") and links everything.
  - The pages update live in the UI.
- **"What is Mom on right now?"** The app answers with the current medication list and a citation for every line: which visit changed it, and who was there.
- **Pre-visit brief, the hero moment.** Run `previsit nephrologist` before Tuesday's appointment. The skill walks the graph from that doctor and collects:
  - every medication changed since their last visit, by anyone;
  - every visit to another doctor since then;
  - every open question tagged for them;
  - any contradictions.

  It renders a one-page brief the family brings to the appointment. The nephrologist finally knows what the cardiologist changed last week.
- **Contradiction catcher.** Two pages disagree on a dose, for example the pharmacy fill says 10 mg but the cardiology visit says 20 mg. The app flags it with both sources, instead of silently picking one.
- **Insurer call procedure (Memorable).** One sibling's agent works through a synthetic prior-authorization call. Memorable learns the procedure from that trace, and a second sibling's agent replays it in one step.
- **Fetching details from the web (UFO, per Emre's note).** An agent uses a browser tool to pull details (clinic hours, pharmacy phone numbers, formulary status) from a local synthetic website that you build and serve on 127.0.0.1. Never scrape real sites for the demo.
- **Custom model (River).** Train a small model with River that turns messy after-visit notes into structured JSON updates (visit, medication changes, questions, follow-ups).
  - Generate a few hundred synthetic messy notes with gold JSON; hold out a test set.
  - Report honest accuracy against the base model with the same prompt. This targets the River prize directly, and competitors will likely skip River.

**Safety framing (put it in the UI and README).**
- Care Circle organizes information and cites sources; it never recommends doses or treatments.
- All data is synthetic, with no real patients, people or providers.
- A footer reads "Not medical advice".

**Suggested 2-minute demo.**
1. Open Rose's circle and show the graph and med list.
2. Paste the cardiology note and watch the pages update, including the River model's extraction.
3. Ask "what is Mom on now?" and show the cited answer.
4. Show the contradiction flag.
5. Generate the nephrologist pre-visit brief.
6. Replay the insurer procedure from the second sibling's agent (Memorable).
7. Show the UFO extension fetching the clinic's details.
8. End on the River numbers.

## 3. How to run this track

**Your role.**
- You are the orchestrator, herdr agent `cc-lead` in session `carecircle`, working in `~/Workspace/care-circle`.
- Work on your own. Do not message the Analyst or Emre except for the two things only Emre can do:
  - setting API keys;
  - deciding anything that sends data outside this machine beyond pushing to this track's GitHub repo.
- For those, write the question at the top of `docs/STATUS.md` under "Needs Emre". The Analyst reads it. Keep STATUS.md current: every 20 minutes, add a short entry saying what works now and how to test it.

**Models.** Use only `gpt-6-astra` with reasoning effort `xhigh`, for every lane agent and every subagent; no Claude models. Codex credits are plentiful, so be generous: run parallel lanes, use Codex subagents inside lanes, and give complex components a planner, one or more implementers, and a reviewer.

**Start lanes with herdr.** You run inside herdr, so `HERDR_ENV=1` and your pane is `--current`.
- **Layout:** `herdr tab create --cwd ~/Workspace/care-circle --label <lane> --no-focus`, then `herdr pane split <pane> --direction right|down --cwd ~/Workspace/care-circle --no-focus`.
- **Start an agent:** `herdr agent start <name> --kind codex --pane <pane> -- -m gpt-6-astra -c model_reasoning_effort=xhigh`.
  - If the start reports the agent blocked, read the pane (`herdr pane read <pane> --source recent-unwrapped --lines 30`). A folder trust prompt is answered with `herdr agent send-keys <name> enter`.
  - If the agent runs but lost its name, use `herdr agent rename <pane> <name>`.
- **Dispatch:** `herdr agent prompt <name> "<instructions>"`.
- **Monitor:** `herdr agent list`, `herdr agent read <name> --source recent-unwrapped --lines 80`.
- **Pings:** lanes report to you with `herdr agent prompt cc-lead "M<n> <lane> ready: ..."`.
- **Naming:** prefix every agent name with `cc-`.

**Architecture: microservices, orthogonal lanes.** Emre's rule: every component is its own small service or package in its own folder, with a single owner, so nobody steps on anyone else.
- Services talk only over HTTP on 127.0.0.1, using ports 4700 to 4719 only. Each one has:
  - its own `package.json` or `pyproject`;
  - a README and a run command;
  - `GET /health`;
  - a smoke test.
- Shared types live in one `contract/` folder that only you edit.
- Write `docs/CONTRACT.md` (APIs, ports, owners) and `docs/PLAN.md` (milestones about every 20 minutes: 15:15, 15:35, 15:55, 16:15, 16:35) before dispatching lanes. Each milestone must leave something Emre could test.

A sensible lane split (you decide):
1. **Family brain and world.** Synthetic Rose Alvarez world: 3 siblings, 4 doctors, 7 medications, 6 visits, 2 insurer calls, labs. It is written as markdown with wikilinks, imported, links extracted, and served by the brain service, which is the only process that opens the family brain.
2. **Note ingest.** Messy note to structured updates; deterministic first, River model later.
3. **Pre-visit brief and contradiction catcher** (graph walks).
4. **Web app.** The family room: graph, med list with citations, paste box, briefs, alerts; warm, calm and clear.
5. **River.** Dataset, SFT, eval, serving the extractor.
6. **Sponsors.** Memorable procedure capture and replay; UFO extension with browser fetch from the local synthetic clinic site.

**GBrain setup (read carefully).** Never run plain `gbrain` in this project. `~/.gbrain` belongs to the primary track's game brain, and a stray `gbrain init` would break it. Use only the wrappers, which set `GBRAIN_HOME` and serialize access; PGLite is single-writer.
- `scripts/brain <args>`: the family (product) brain at `~/Workspace/care-circle-brain`. Once the brain service runs, it owns that brain and everything else goes through its HTTP API.
- `scripts/devbrain <args>`: the codebase-map brain at `~/Workspace/care-circle-devbrain`. Emre requires every agent to record the codebase structure in GBrain:
  - Keep one page per component, `code/<service>`, with Purpose, Run, Files, API, Depends on ([[code/other]] wikilinks) and Gotchas.
  - Keep decision pages `code/decisions/<slug>`.
  - Read other components' pages before using them, update yours at every milestone, and run `scripts/devbrain extract links --source db` after writing.
- Useful facts:
  - `import <dir> --no-embed` then `extract links --source db` builds typed links without an LLM. "Role at [[companies/x]]" gives works_at, "Attendees: [[people/a]]" gives attended, and other wikilinks give mentions.
  - A meeting is skipped if an attendee page is missing.
  - Custom link types must be declared in the schema pack. The fallback is built-in types plus clear page sections.

**Git.** Create a public GitHub repo now with `gh repo create aemrebarut/care-circle --public --source . --remote origin --push`, after `git init`, a `.gitignore` (node_modules, .venv, .env*, *.pglite, logs) and a README. Emre authorized a public repo for this track.
- Add a pre-commit hook that blocks secrets. Copy the idea from `~/Workspace/qm-raid/.git/hooks/pre-commit`; read that file, do not modify it.
- Everyone works on `main` in this one working tree:
  - no branches or worktrees;
  - no rebase, amend, reset, stash or force push;
  - never touch another lane's paths.
- Commit small and often, only your own paths: `git add -- <paths> && git commit -m "<agent>: <what>" -- <paths> && git push origin main`. On index.lock, wait and retry.

**Hard rules.**
- **Data:** synthetic only; nothing real about any person.
- **Credentials:** never read, print or copy keys, tokens or credential files (for example `~/.codex/auth.json`). If a key is needed, name the env var in STATUS.md; Emre sets it himself.
- **Networking:** bind 127.0.0.1 only, never 0.0.0.0. Never use port 8787 or ports 4610 to 4617 (the primary track). Leave Tailscale alone.
- **Hands off:**
  - `~/Workspace/qm-raid`, `~/Workspace/hackathon-gbrain`, `~/Workspace/qm-raid-devbrain`, `~/.gbrain`;
  - the local QM instance;
  - `~/Workspace/emre-team`, `~/Workspace/e3-tb`;
  - any process you did not start.
- **Processes:** stop only your own processes, by exact PID; never kill by pattern.
- **External actions:** no accounts, no publishing beyond this repo, no messages to anyone.
- **Style:** no em dashes or en dashes anywhere (code, docs, UI text, commit messages).
- **Dependencies:** keep them small and mainstream. Installed: Bun 1.4.2, Node 26, Python 3.14, Docker.
- **Honesty:** if something is simulated or did not work, say so in the README and in the demo.

**Definition of done at 16:40:**
- The demo path in section 2 runs twice in a row from `scripts/demo-reset`.
- The README explains the idea, the architecture, how GBrain, River, Memorable and UFO are used, what is real versus simulated, and how to run it.
- `docs/STATUS.md` ends with a 2-minute demo script.
- The dev brain holds the codebase map, and everything is pushed.

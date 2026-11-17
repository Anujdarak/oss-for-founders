# Discovery report

Generated: 2026-11-06T11:45:46.279Z

## Results

- Unique repos seen: **12213**
- Written to `data/discovered.json`: **4857**
- Dropped: 7356
- Hidden gem candidates: 230
- Median stars: 1,402
- Engine: GraphQL
- GraphQL: 1155 requests, 1154 points used
- REST: 0 requests

## Filters applied

- Stars >= 500, or >= 200 for a hidden gem scoring >= 0.8
- Not a fork, not archived, not disabled
- Has a licence GitHub can resolve to an SPDX id, and a description
- Pushed within 365 days, created more than 180 days ago
- Quality score >= 0.55, founder relevance >= 0.4
- Excluded: awesome-lists, tutorials, courses, books, dotfiles, interview prep,
  research, demos, boilerplates, and vendor SDKs

## Correction applied after this run

The run finished flagging **2,535 of 4,857** entries as hidden gems — 52% of the
catalogue, which makes the label worthless. The thresholds were set against a
39-repo catalogue and did not survive contact with a real one. Measured across
these 4,906 entries:

| | p25 | p50 | p75 | p90 | p95 |
| --- | --- | --- | --- | --- | --- |
| quality score | – | 0.905 | 0.937 | 0.964 | 0.981 |
| stars | 610 | 1,434 | 4,634 | 13,563 | – |

So the old rule was broken in two ways at once: a 0.80 score floor sits *below
the median*, and a 200–2,000 star band straddles the median star count.

Recalibrated to **200–1,000 stars and score >= 0.92**, which flags 230
entries (4.7%) — below-median adoption,
above-median quality. The flag was recomputed in place; nothing else changed.

## Per category

| Category | Primary | Also tagged | Gems |
| --- | --- | --- | --- |
| AI & ML | 866 | 186 | 357 |
| SaaS Development | 248 | 83 | 149 |
| Authentication & Security | 313 | 26 | 186 |
| Marketing & SEO | 182 | 43 | 115 |
| CRM & Sales | 83 | 27 | 60 |
| Analytics & BI | 386 | 110 | 200 |
| Infrastructure & DevOps | 833 | 170 | 466 |
| E-commerce | 86 | 9 | 51 |
| Customer Support | 154 | 91 | 103 |
| Productivity & Automation | 470 | 103 | 250 |
| Design & UI Components | 130 | 87 | 74 |
| Databases | 555 | 92 | 264 |
| Developer Tools | 551 | 130 | 260 |

## Drops by reason

| Reason | Count |
| --- | --- |
| no licence GitHub can resolve | 2103 |
| founder relevance below 0.4 | 2009 |
| under 500 stars, and not a gem candidate | 699 |
| created less than 180 days ago | 635 |
| reads as something you study, not something you run | 465 |
| name looks like a list, course, template, or SDK | 457 |
| description is not mostly Latin script | 352 |
| description looks like a list, course, template, or SDK | 332 |
| carries an excluded topic | 222 |
| already in repos.json | 45 |
| no description | 29 |
| quality score below 0.55 | 7 |
| no push in 365 days | 1 |

## Sample of what was dropped

### no licence GitHub can resolve (2103)

- `aj-geddes/claude-code-bmad-skills`
- `quchangle1/LLM-Tool-Survey`
- `SeekingDream/Static-to-Dynamic-LLMEval`
- `xr843/Master-skill`
- `jhljx/RecSys-Industrial-Book`
- `OmniJev/awesome-jev-gallery`
- `wangtunan/blog`
- `haddock-development/claude-reflect-system`
- `java-ai-tech/spring-ai-summary`
- `IvanCampos/Foundation-Models-Playgrounds`
- `zhuhanqing/APOLLO`
- `ScrapeGraphAI/toonify`
- ...and 2091 more

### founder relevance below 0.4 (2009)

- `Kurama622/llm.nvim`
- `agent-sh/agnix`
- `symgraph/IDAssist`
- `ggml-org/llama.vim`
- `microsoft/TypeChat`
- `andretietz/retroauth`
- `marcominerva/SimpleAuthentication`
- `flask-extensions/Flask-SimpleLogin`
- `ramosbugs/openidconnect-rs`
- `codemagic-ci-cd/cli-tools`
- `k8sgpt-ai/k8sgpt-operator`
- `microsoft/PSRule`
- ...and 1997 more

### under 500 stars, and not a gem candidate (699)

- `withcatai/catai`
- `AlexAnys/opencrew`
- `THU-SI/Spatial-MLLM`
- `eidolon-ai/eidolon`
- `Claw-Company/clawcompany`
- `smkalami/prompt-decorators`
- `antgroup/Agentar-Scale-SQL`
- `lone-cloud/gerbil`
- `AI-Hypercomputer/JetStream`
- `op7418/Claude-to-IM`
- `hiDaDeng/cntext`
- `aiming-lab/AutoHarness`
- ...and 687 more

### created less than 180 days ago (635)

- `strands-agents/box`
- `simonlin1212/investment-news`
- `tudoumashu/ai-memory-skillpack`
- `Cygnux-Labs/Tracekit`
- `SuperJJ007/CSSwitch`
- `flohoeller/affectui`
- `FrigadeHQ/hob`
- `taovc/pr-cockpit`
- `HRuiCcc/RuiC-oc-ferry`
- `walidboulanouar/awesome-jev-use-cases`
- `chiennv2000/orthrus`
- `Yinsongxu/LLM2Jev`
- ...and 623 more

### reads as something you study, not something you run (465)

- `agent-next/polymarket-paper-trader`
- `baby-llm/baby-agent`
- `HUST-AI-HYZ/MemoryAgentBench`
- `baidu-baige/LoongFlow`
- `candle-org/step_into_llm`
- `Kenza-AI/sagify`
- `neuml/annotateai`
- `AMAP-ML/Tree-GRPO`
- `foundation-interface/graphologue`
- `ethiack/ai4eh`
- `RUC-NLPIR/FinSight`
- `psmarter/mini-infer`
- ...and 453 more

### name looks like a list, course, template, or SDK (457)

- `githubnext/awesome-continuous-ai`
- `langgptai/awesome-gemini-prompts`
- `coree/awesome-rag`
- `OpenRouterTeam/openrouter-examples`
- `baidubce/bce-qianfan-sdk`
- `w95/awesome-claude-corporate-skills`
- `NeuZhou/awesome-ai-anatomy`
- `Zefan-Cai/Awesome-LLM-KV-Cache`
- `DavidZWZ/Awesome-RAG-Reasoning`
- `amitshekhariitbhu/machine-learning-interview-questions`
- `gyunggyung/AGI-Papers`
- `CelaDaniel/free-ai-resources-x`
- ...and 445 more

### description is not mostly Latin script (352)

- `aahl/mcp-aktools`
- `DjangoPeng/GitHubSentinel`
- `Golden-Promise/vscode-cc-switch`
- `599yongyang/DatasetLoom`
- `tedhappy/ragflow-admin`
- `FunnySaltyFish/Better-Ruozhiba`
- `mtkresearch/BreezeApp`
- `little51/llm-dev`
- `FutureUnreal/What-to-eat-today`
- `livehl/aimirror`
- `XBigRoad/prompt-optimizer-studio`
- `mymagicpower/AIAS`
- ...and 340 more

### description looks like a list, course, template, or SDK (332)

- `ahpxex/read-aware`
- `NishkarshRaj/100DaysofMLCode`
- `anakin87/qwen-scheduler-grpo`
- `upstash/rag-chat`
- `jmont-dev/ollama-hpp`
- `arorarishi/Prompt-Engineering-Jumpstart`
- `umbertogriffo/rag-chatbot`
- `IBM/mcp`
- `DemonDamon/AgenticX`
- `NVIDIA/cuvs`
- `Exorust/TorchLeet`
- `kayba-ai/agentic-context-engine`
- ...and 320 more

### carries an excluded topic (222)

- `aicademyorg/AIcademy`
- `onlyphantom/llm-python`
- `superiorlu/AITreasureBox`
- `HeyNina101/generative_ai_project`
- `thiswillbeyourgithub/AnkiAIUtils`
- `sangrokjung/claude-forge`
- `zkywsg/Daily-LLM`
- `wanikua/danghuangshang`
- `agentuniverse-ai/agentUniverse`
- `samchon/nestia`
- `google/adk-go`
- `qualcomm/GenieX`
- ...and 210 more

### already in repos.json (45)

- `ollama/ollama`
- `huggingface/transformers`
- `langchain-ai/langchain`
- `appwrite/appwrite`
- `surrealdb/surrealdb`
- `nextauthjs/next-auth`
- `espocrm/espocrm`
- `knadh/listmonk`
- `mautic/mautic`
- `twentyhq/twenty`
- `krayin/laravel-crm`
- `grafana/grafana`
- ...and 33 more

### no description (29)

- `Tencent-Hunyuan/ArtifactsBenchmark`
- `pandolia/easy-service`
- `elastic/apm-agent-nodejs`
- `elastic/apm-server`
- `yy0931/sqlite3-editor`
- `consta-design-system/uikit`
- `bansalkanav/Ultimate-Data-Science-Toolkit---From-Python-Basics-to-GenerativeAI`
- `antflydb/antfly`
- `mindscale-noah/MindMemOS`
- `Surajmaurya1/easyui`
- `elastic/mcp-server-elasticsearch`
- `hashicorp-education/learn-terraform-provision-eks-cluster`
- ...and 17 more

### quality score below 0.55 (7)

- `snok/django-auth-adfs`
- `cevoaustralia/aws-google-auth`
- `stanford-mast/nn_dataflow`
- `peter-wangxu/persist-queue`
- `Sammyjo20/lasso`
- `Mixaill/FakePDB`
- `alephdata/aleph`

### no push in 365 days (1)

- `FairyFali/SLMs-Survey`

## Highest ranked entries kept

| Repo | Stars | Score | Category |
| --- | --- | --- | --- |
| `louislam/uptime-kuma` | 93,311 | 1.00 | Infrastructure & DevOps |
| `koala73/worldmonitor` | 90,256 | 1.00 | Analytics & BI |
| `netdata/netdata` | 81,293 | 1.00 | Infrastructure & DevOps |
| `unslothai/unsloth` | 79,102 | 1.00 | AI & ML |
| `headroomlabs-ai/headroom` | 78,981 | 1.00 | AI & ML |
| `AppFlowy-IO/AppFlowy` | 78,289 | 1.00 | Productivity & Automation |
| `apache/superset` | 75,433 | 1.00 | Analytics & BI |
| `Mintplex-Labs/anything-llm` | 67,999 | 1.00 | AI & ML |
| `ZhuLinsen/daily_stock_analysis` | 67,628 | 1.00 | AI & ML |
| `usememos/memos` | 64,312 | 1.00 | Infrastructure & DevOps |
| `upstash/context7` | 64,273 | 1.00 | AI & ML |
| `makeplane/plane` | 62,063 | 1.00 | Productivity & Automation |
| `pathwaycom/serviette` | 58,725 | 1.00 | AI & ML |
| `nexu-io/open-design` | 1,06,221 | 1.00 | Design & UI Components |
| `run-llama/llama_index` | 52,830 | 1.00 | AI & ML |
| `HKUDS/nanobot` | 49,875 | 1.00 | Infrastructure & DevOps |
| `AstrBotDevs/AstrBot` | 46,223 | 1.00 | AI & ML |
| `payloadcms/payload` | 45,692 | 1.00 | SaaS Development |
| `ColorlibHQ/AdminLTE` | 45,675 | 1.00 | SaaS Development |
| `The-Vibe-Company/quivr` | 39,634 | 1.00 | AI & ML |
| `apache/airflow` | 47,389 | 0.98 | Productivity & Automation |
| `TriliumNext/Trilium` | 38,723 | 0.99 | Infrastructure & DevOps |
| `google-ai-edge/mediapipe` | 37,581 | 0.99 | AI & ML |
| `agentscope-ai/QwenPaw` | 37,418 | 0.99 | AI & ML |
| `1Panel-dev/1Panel` | 37,379 | 0.99 | Infrastructure & DevOps |
| `dgtlmoon/changedetection.io` | 35,581 | 0.99 | Infrastructure & DevOps |
| `alibaba/nacos` | 33,500 | 0.99 | Infrastructure & DevOps |
| `Zackriya-Solutions/meetily` | 32,479 | 0.99 | AI & ML |
| `filamentphp/filament` | 32,429 | 0.99 | Marketing & SEO |
| `googleworkspace/cli` | 32,141 | 0.99 | Productivity & Automation |

## What is stored

Only data the GitHub API returned: id, owner, name, url, avatar, description,
stars, forks, language, licence, topics, open issues, and the push/create
dates. Descriptions are verbatim apart from stripped emoji. No description,
review, pro, con, or difficulty is generated for a discovered repo -- those
stay empty and the UI labels the entry unreviewed.

# AgentGuard — 4-Minute Hackathon Pitch

**Presenters:** P1 (non-tech / product), P2 (tech / engineer)
**Total:** ~4 min | **Demo:** ~75 seconds of live screen

---

## 0:00 – The Problem (45s) — *P1*

Welcome. We built **AgentGuard** — a zero-trust runtime security layer for AI agents.

Here's the problem. Companies are deploying autonomous agents that browse the web, read files, execute commands. Same agents getting hit with prompt injections, privilege escalations, data exfiltration. Traditional perimeter security doesn't work — the agent *is* the insider.

So we asked: can we detect and stop an attack *while it's happening*, without a human in the loop? That's AgentGuard.

## 0:45 – What It Does (45s) — *P1*

AgentGuard sits between the agent and every tool it calls. Every `search_web`, `read_file`, `http_get` — we intercept it, score it for risk in real time, and decide: allow, deny, or contain. When risk exceeds a threshold, we quarantine the agent automatically.

Three core layers: a **policy engine** that blocks unauthorized tools, a **behavioral anomaly detector** using Isolation Forest that spots deviation from normal patterns, and **decoy honeytools** — fake sensitive endpoints that trigger instant containment if touched.

## 1:30 – Live Demo (75s) — *P1 driving, P2 narrating*

Let me show you the dashboard. *[open browser to AgentGuard dashboard]*

We have six demo agents — Research, Finance, Email, DevOps, Data, Support — each with different behavior profiles. The dashboard shows live risk scores, tool call volume, threats detected.

*[click "Simulate Attack" in sidebar]* I'll trigger a simulated attack. AgentGuard picks a random active agent and sends a honeytool command — say `download_customer_database`.

*[watch for containment toast / agent status change]* Watch the dashboard — immediate risk spike to 100, agent status flips to QUARANTINED. All in under a second, no human needed.

*[navigate to Agent Detail page for the quarantined agent]* Here's the agent detail — you can see the full timeline: normal calls, then the honeytool trigger, then containment. The incident report is automatically generated with recommended actions.

Now let's run a full attack scenario. *[go to Scenarios page, click "Run" on "Live Demonstration Attack"]*. This walks through the entire kill chain — normal ops, prompt injection, honeytool trigger, containment — step by step with live risk updates.

*[let it run for ~15 seconds — point at step counter and risk updates]* You can see each step executing, risk climbing, and finally containment. All logged, all auditable.

## 2:45 – Technical Depth (45s) — *P2*

Behind the scenes: our **risk engine** is additive — honeytool touch is +100 instant containment, denied calls +15, privilege chains +35, burst detection +10. The **anomaly detector** trains an Isolation Forest on 5 behavioral features per agent — tool frequency, denied rate, diversity, burst patterns, failure rate. With just 10+ samples it can flag outliers.

Every tool executes in a **sandbox** with path traversal and SSRF protection. WebSockets push real-time events to the UI — containment alerts, risk updates, audit events — so the dashboard stays live without polling.

## 3:30 – Why We Win (30s) — *P1*

What makes AgentGuard different: it's **lightweight** (deploys beside any agent framework), **real-time** (decision in milliseconds), and **fully autonomous** (detect → decide → contain, no human). Existing tools are either too slow, too complex, or require manual review.

We've built 20 dashboard pages, a full REST API, real-time WebSocket pipeline, and a demo mode that seeds 6 agents with realistic behavior — all in one hackathon.

## 4:00 – Close

AgentGuard — runtime security for the agent age. Thank you.

# ComfyUI RunPod API Endpoint — Project Guide

> **Project:** ComfyUI Serverless API Endpoint for the AI Studio App  
> **Goal:** Set up a serverless ComfyUI endpoint on RunPod that the AI Studio app can send API requests to  
> **Private Repo:** [majdsalim/LXOtesting](https://github.com/majdsalim/LXOtesting) (forked from lum3on/wan2.2_runpod-temp)  
> **Local Workspace:** `c:\Users\majds\OneDrive\Desktop\Liquidox`  
> **Date Started:** February 2026
>
> **IMPORTANT CONTEXT FOR NEW AGENT:** This project is part of a larger AI Studio app.
> The studio app has a complex pipeline — ComfyUI handles some parts of it.
> The user has strong ComfyUI experience (builds custom workflows, has done Python API integration
> with localhost:8188) but no JavaScript/TypeScript or serverless experience.
> The base repo (wan2.2_runpod-temp) provides WAN 2.2 video generation, but the user will be
> developing their OWN workflows with their OWN models and custom nodes — not using WAN defaults.
> The repo was chosen because it has a ready-made serverless infrastructure (handler.py, start.sh, etc.)

---

## Table of Contents

1. [Key Concepts (Quick Reference)](#1-key-concepts-quick-reference)
2. [Architecture Overview](#2-architecture-overview)
3. [How Serverless Works (End to End)](#3-how-serverless-works-end-to-end)
4. [Development Phases](#4-development-phases)
5. [What the Repo Already Has](#5-what-the-repo-already-has)
6. [What We Need to Change](#6-what-we-need-to-change)
7. [Setup Steps](#7-setup-steps)
8. [API Reference](#8-api-reference)
9. [Known Blockers & Gotchas](#9-known-blockers--gotchas)
10. [TypeScript Test App Plan](#10-typescript-test-app-plan)
11. [SETUP_LOG.md — Tracking Changes](#11-setup_logmd--tracking-changes)
12. [Decisions Log](#12-decisions-log)

---

## 1. Key Concepts (Quick Reference)

| Term | What It Is |
|---|---|
| **ComfyUI API Endpoint** | A URL that accepts workflow JSON and returns generated images/video. Same as localhost:8188, but in the cloud. |
| **RunPod** | GPU rental platform. Like renting a gaming PC by the minute. |
| **Serverless Endpoint** | A RunPod service that spins up GPU workers only when a request comes in. You pay per second of actual use. The endpoint URL is **stable** (never changes). |
| **Cold Start** | The time it takes for a worker to boot up when there's no idle worker available. Includes loading the Docker image, initializing ComfyUI, loading models into GPU memory. |
| **Worker** | A GPU instance that processes one job at a time. Multiple workers can run in parallel for concurrent requests. |
| **Docker Image** | A snapshot/"save game" of a fully configured machine. Contains ComfyUI, custom nodes, handler script, and optionally models. |
| **Dockerfile** | The recipe that produces a Docker image. Lists every install step explicitly. |
| **CI/CD** | Automation (GitHub Actions) that rebuilds the Docker image whenever you push code. |
| **Network Volume** | Persistent cloud storage on RunPod. Can be attached to serverless endpoints for storing large models outside the Docker image. |
| **GHCR** | GitHub Container Registry — where built Docker images are stored and pulled by RunPod. |
| **Handler (`handler.py`)** | Python script that receives jobs from RunPod, sends them to ComfyUI's internal API, waits for results, and returns them. Already written in the repo. |
| **WAN 2.2** | A video generation model. The base repo is built around it. |

---

## 2. Architecture Overview

### How It Works

```
┌──────────────────────────┐
│  AI Studio App / Test App│
│  (sends HTTP requests)   │
└───────────┬──────────────┘
            │
            │  POST https://api.runpod.ai/v2/<endpoint_id>/run
            │  Authorization: Bearer <RUNPOD_API_KEY>
            │  Body: { "input": { "workflow": {...} } }
            │
            v
┌──────────────────────────────────────────────────────────────┐
│  RunPod Serverless Endpoint (stable URL, auto-scaling)       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Worker (GPU instance — spins up on demand)          │     │
│  │                                                     │     │
│  │  ┌─────────────┐      ┌──────────────────────┐     │     │
│  │  │ handler.py  │ ───→ │ ComfyUI (internal)   │     │     │
│  │  │ (receives   │      │ (processes workflow,  │     │     │
│  │  │  RunPod job)│ ←─── │  generates output)   │     │     │
│  │  └─────────────┘      └──────────────────────┘     │     │
│  │                                                     │     │
│  │  Models loaded from: Docker image or Network Volume │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  Auto-scales: 0 workers when idle → N workers under load     │
│  You only pay for actual GPU seconds used                    │
└──────────────────────────────────────────────────────────────┘
            │
            │  Response: { "output": { "images": [...] } }
            v
┌──────────────────────────┐
│  AI Studio App / Test App│
│  (receives results)      │
└──────────────────────────┘
```

### Key Benefits of Serverless (vs. Compute Pod)
- **Stable URL** — endpoint ID never changes (no more pod ID in the URL)
- **Auto-scaling** — handles 0 to many concurrent requests automatically
- **Pay per use** — no GPU cost when idle
- **API key auth** — built-in security (no public URLs)
- **No network volume mount issues** — no stop/start restrictions

---

## 3. How Serverless Works (End to End)

### The Boot Sequence (What Happens on Cold Start)

```
1. Request arrives at RunPod endpoint
2. No idle worker available → RunPod starts a new one
3. Docker image is pulled and container starts
4. /start.sh runs:
   a. runtime-init.sh (verifies ComfyUI, compiles SageAttention, sets up nodes)
   b. download_models.sh (downloads models if not in image/network volume)
   c. ComfyUI starts in BACKGROUND (listens on localhost:8188)
   d. handler.py starts (connects to RunPod job queue)
5. handler.py picks up the waiting job
6. handler.py sends workflow to ComfyUI via internal WebSocket
7. ComfyUI processes the workflow, generates output
8. handler.py collects results (base64 images or S3 upload)
9. handler.py returns results to RunPod → RunPod returns to your app
```

### The Handler Flow (handler.py — Already Written)

The handler does all the heavy lifting. For each job it:
1. Validates the input (requires a `workflow` field)
2. Optionally uploads input images to ComfyUI (for img2vid, etc.)
3. Queues the workflow on ComfyUI via POST to `localhost:8188/prompt`
4. Monitors progress via WebSocket (`ws://localhost:8188/ws`)
5. When done, fetches output images from ComfyUI's `/view` endpoint
6. Returns images as base64 data (or uploads to S3 if `BUCKET_ENDPOINT_URL` is set)

---

## 4. Development Phases

### Phase 1: Develop Workflows on Compute Pod (COMPLETE ✓)
Deploy a compute pod from your own Docker image (`ghcr.io/majdsalim/lxotesting:latest`).
Keep the pod running while developing. No network volume needed — data lives in the container.

- [x] Fork wan2.2_runpod-temp into private repo → https://github.com/majdsalim/LXOtesting
- [x] Pull to Cursor workspace
- [x] Set up CI/CD (GitHub Actions) → `.github/workflows/docker-build.yml`
- [x] Fix Dockerfile.ci: use latest ComfyUI, no model auto-downloads
- [x] Push to GitHub → CI/CD builds Docker image → `ghcr.io/majdsalim/lxotesting:latest`
- [x] Create RunPod pod template `LXOtemp` using own image (GHCR credentials required — private repo)
- [x] Deploy compute pod — verified working (2026-02-10)
- [x] Install YOUR models and custom nodes (not the WAN defaults) — ComfyUI-Sharp, GaussianViewer, Qwen Image Edit FP8, SHARP, LoRAs (2026-02-10)
- [x] Build and test YOUR ComfyUI workflows in the browser UI — 3 Gaussian Splatting workflows (2026-02-10)
- [x] **Maintain SETUP_LOG.md** — log every model, node, and package installed (2026-02-10)
- [x] Export finalized workflows via "Save (API Format)" in ComfyUI — 3 workflows exported (2026-02-10)
- [x] Translate SETUP_LOG.md into runtime scripts — nodes added to runtime-init.sh, models added to download_models.sh (DOWNLOAD_GAUSSIAN flag) (2026-02-10)
- [x] Rebuild image, deploy fresh pod, verify everything auto-installs correctly (2026-02-10)
- [x] Test workflows work via API (curl to the compute pod's URL) — simple_test.json verified (2026-02-10)

**Compute pod template `LXOtemp` settings:**
- Container image: `ghcr.io/majdsalim/lxotesting:latest`
- Container disk: 50 GB (models stored in container, no network volume)
- Volume disk: 0 GB
- HTTP Ports: `8188, 8189`
- Start Command: *(use default — no custom start command needed)*
- Docker credentials: Required (private GHCR image — use GitHub username + PAT with `read:packages`)
- Environment Variables:
  - `COMFYUI_USE_LATEST=true` (install latest ComfyUI at boot)
  - `DOWNLOAD_ALL=false` (no auto model downloads — you install your own)
  - `COMFY_LOG_LEVEL=DEBUG`

> **NOTE on compute pod without network volume:** You CAN pause/resume the pod.
> Data persists as long as you don't terminate. The pod ID stays the same across pause/start.
> First boot: ~5 min (verified 2026-02-10 — installs ComfyUI, PyTorch, nodes, SageAttention).
> Subsequent boots (pause/start): ~2-5 min (skips install if `.initialized` exists).
> ComfyUI: `https://<pod-id>-8188.proxy.runpod.net`
> JupyterLab: `https://<pod-id>-8189.proxy.runpod.net`

**Verified boot info (2026-02-10):**
- ComfyUI v0.12.3 (latest at time of deploy)
- ComfyUI-Manager V3.39.2
- PyTorch 2.10.0+cu128
- SageAttention 2.2.0 (prebuilt wheel for RTX 4090)
- GPU: NVIDIA GeForce RTX 4090, 22564 MB VRAM
- Boot time: ~5 minutes (from container start to ComfyUI ready)
- 18 custom nodes loaded, all functioning
- JupyterLab running on port 8189
- No model downloads (DOWNLOAD_ALL=false working correctly)

### Phase 2: Dockerize for Serverless (COMPLETE ✓)
Once workflows are stable and tested:

- [x] Translate SETUP_LOG.md into Dockerfile instructions — already done in Phase 1 (runtime-init.sh + download_models.sh)
- [x] Add serverless mode to Dockerfile.ci via BUILD_MODE arg (serverless start.sh: ComfyUI background + handler.py, no JupyterLab) (2026-02-10)
- [x] Update CI/CD to build both images: `:latest` (compute) and `:serverless` (2026-02-10)
- [x] Push to GitHub → CI/CD builds both Docker images (2026-02-10)
- [x] Create Serverless Endpoint on RunPod with the `:serverless` image (2026-02-11)
- [x] Test with API request — simple_test.json completed in 855ms via RunPod Serverless API (2026-02-11)

**Serverless Endpoint Info:**
- Endpoint URL: `https://api.runpod.ai/v2/j8rzwzndlbstn0`
- Image: `ghcr.io/majdsalim/lxotesting:serverless`
- Container Disk: 75 GB+ (needed for runtime PyTorch + models)
- Environment Variables: `COMFYUI_USE_LATEST=true`, `DOWNLOAD_GAUSSIAN=true`, `COMFY_LOG_LEVEL=DEBUG`
- Cold start: ~15-20 min (runtime installs + model downloads). Subsequent boots use cached data if worker persists.

### Phase 3: TypeScript Test App
- [ ] Build simple TypeScript app to test workflows via RunPod Serverless API
- [ ] Prototype UI/UX patterns for the AI Studio app
- [ ] Handle async job polling (RunPod serverless is async by default)

### Phase 4: Production Optimization
- [ ] Optimize cold start times (bake models into image if needed)
- [ ] Test concurrent requests and scaling
- [ ] Hand off to main AI Studio app team

---

## 5. What the Repo Has

| File | Purpose | Status |
|---|---|---|
| `Dockerfile.ci` | CI-optimized Dockerfile with `BUILD_MODE` arg (compute/serverless) | **Active** — used by CI/CD, builds both `:latest` and `:serverless` images |
| `Dockerfile.wan22` | Full Dockerfile (bakes PyTorch + nodes into image) | **Available** — not used by CI, alternative approach |
| `.github/workflows/docker-build.yml` | CI/CD: auto-builds both compute and serverless images on push to main | **Active** — matrix strategy builds two images |
| `runpod-worker-comfyui/handler.py` | Receives RunPod jobs, sends to ComfyUI, returns results | **Active** — used by serverless endpoint |
| `runpod-worker-comfyui/src/start.sh` | Original serverless start script from base repo | **Superseded** — start.sh is now generated inline in Dockerfile.ci |
| `scripts/runtime-init.sh` | Installs ComfyUI, PyTorch, nodes, SageAttention at runtime | **Active** — defaults to COMFYUI_USE_LATEST=true |
| `scripts/download_models.sh` | Downloads models (flag-based, supports /workspace) | **Active** — DOWNLOAD_GAUSSIAN=true on serverless |
| `runpod-worker-comfyui/src/extra_model_paths.yaml` | Tells ComfyUI to also look for models in /runpod-volume | **Ready** — useful for network volume |
| `SETUP_LOG.md` | Tracks all changes made on compute pod for Dockerization | **Active** — update as you install things |
| `workflows/*.json` | Exported ComfyUI workflows (API format) | **Active** — 3 Gaussian Splatting + 1 simple test |

---

## 6. How the Dockerfile Works (BUILD_MODE) — DONE

The `Dockerfile.ci` uses a `BUILD_MODE` build argument to generate different start scripts:

| Mode | `BUILD_MODE=` | What It Does | Image Tag |
|---|---|---|---|
| **Compute** | `compute` (default) | ComfyUI foreground on 0.0.0.0:8188 + JupyterLab on 8189 | `:latest` |
| **Serverless** | `serverless` | ComfyUI background on localhost:8188 + handler.py foreground | `:serverless` |

**Serverless start.sh flow:**
1. `runtime-init.sh` — installs ComfyUI, PyTorch, custom nodes, SageAttention
2. `download_models.sh` — downloads enabled models (DOWNLOAD_GAUSSIAN=true)
3. ComfyUI starts in background (`&`) on localhost:8188
4. Readiness check loop — waits up to 10 min for ComfyUI HTTP to respond
5. `handler.py` starts in foreground — connects to RunPod job queue

**Key difference from compute:** ComfyUI is internal only (no `--listen 0.0.0.0`), no JupyterLab,
handler.py receives jobs from RunPod instead of users connecting via browser.

### Model Strategy: Two Options

| | **Option A: Runtime Download** (current) | **Option B: Bake Into Image** |
|---|---|---|
| **Docker image size** | ~5-8 GB (no models) | ~30-50 GB (models included) |
| **Cold start time** | ~15-20 min (downloads ~30 GB) | ~5 min (models already local) |
| **Adding new models** | Set env vars, no rebuild needed | Edit Dockerfile, rebuild image |
| **Best for** | Development, frequently changing models | Production, stable model set |

**Current approach:** Option A (runtime download via `download_models.sh`).
Switch to Option B in Phase 4 when your model set stabilizes.

---

## 7. Setup Steps

### Step 1: Fork the Repo ✅ DONE
- Forked to https://github.com/majdsalim/LXOtesting (private)
- Cloned to `c:\Users\majds\OneDrive\Desktop\Liquidox`

### Step 2: Set Up CI/CD ✅ DONE
- Created `.github/workflows/docker-build.yml`
- Builds `Dockerfile.ci` on push to main, pushes to GHCR
- Image: `ghcr.io/majdsalim/lxotesting:latest`

### Step 3: Fix Image for Own Use ✅ DONE
- `Dockerfile.ci`: removed pinned ComfyUI v0.3.56, updated labels
- `runtime-init.sh`: default `COMFYUI_USE_LATEST=true`
- `download_models.sh`: default `DOWNLOAD_ALL=false`
- Build scripts: updated to `majdsalim/lxotesting`

### Step 4: Deploy Compute Pod ✅ DONE
- Template `LXOtemp` created with own image + GHCR credentials
- Pod deployed, verified boot, ComfyUI v0.12.3 running on RTX 4090
- ~5 min boot time

### Step 5: Develop Workflows on Compute Pod ✅ DONE (Phase 1)
- Workflows built and tested on compute pod's ComfyUI UI
- 3 Gaussian Splatting workflows + 1 simple test workflow exported
- All models, nodes, packages logged in SETUP_LOG.md
- Translated SETUP_LOG.md into runtime-init.sh + download_models.sh

### Step 6: Dockerize for Serverless ✅ DONE (Phase 2)
- Added `BUILD_MODE` arg to Dockerfile.ci (compute vs. serverless)
- CI/CD updated to build both `:latest` and `:serverless` images
- Created Serverless Endpoint on RunPod
- Tested with simple_test.json — completed in 855ms

### Step 7: Build TypeScript Test App (NOW — Phase 3)
- Build simple TypeScript app to submit workflows and display results
- Prototype UI/UX patterns for the AI Studio app
- Handle async job polling (RunPod serverless is async by default)

---

## 8. API Reference

### RunPod Serverless API (What Your App Uses)

**Base URL:** `https://api.runpod.ai/v2/<endpoint_id>`

**Authentication:** `Authorization: Bearer <RUNPOD_API_KEY>` header on every request

#### Submit a Job (Async)
```
POST /run
{
  "input": {
    "workflow": { <ComfyUI workflow JSON from "Save API Format"> },
    "images": [                    // Optional: input images for img2vid, etc.
      {
        "name": "input.png",
        "image": "data:image/png;base64,..." // or raw base64 string
      }
    ]
  }
}

Response:
{
  "id": "job-abc123",
  "status": "IN_QUEUE"
}
```

#### Submit a Job (Sync — Waits for Result)
```
POST /runsync
{
  "input": {
    "workflow": { ... }
  }
}

Response (when complete):
{
  "id": "job-abc123",
  "status": "COMPLETED",
  "output": {
    "images": [
      {
        "filename": "ComfyUI_00001_.png",
        "type": "base64",
        "data": "<base64 encoded image>"
      }
    ]
  }
}
```

#### Check Job Status (For Async Jobs)
```
GET /status/<job_id>

Response:
{
  "id": "job-abc123",
  "status": "COMPLETED",   // IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED
  "output": { ... }        // Only present when COMPLETED
}
```

#### Check Endpoint Health
```
GET /health

Response:
{
  "jobs": { "completed": 5, "failed": 0, "inProgress": 1, "inQueue": 0 },
  "workers": { "idle": 1, "running": 1, "throttled": 0 }
}
```

### Output Format (From handler.py)

The handler returns images in this format:

```json
{
  "images": [
    {
      "filename": "ComfyUI_00001_.png",
      "type": "base64",
      "data": "<base64 string>"
    }
  ]
}
```

If `BUCKET_ENDPOINT_URL` environment variable is set (for S3-compatible storage),
images are uploaded to S3 instead:

```json
{
  "images": [
    {
      "filename": "ComfyUI_00001_.png",
      "type": "s3_url",
      "data": "https://your-bucket.s3.amazonaws.com/..."
    }
  ]
}
```

---

## 9. Known Blockers & Gotchas

### BLOCKER: Cold Start Time
The first request after the endpoint has been idle will trigger a cold start.
Current cold start: **~15-20 minutes** (runtime PyTorch install + SageAttention compilation + model downloads).
- Container disk must be 75 GB+ to fit all runtime installs and models.

**Mitigation strategies:**
- Set `Idle Timeout` to 60-300 seconds to keep workers warm between requests
- Set `Min Workers: 1` to always have one warm worker (costs money when idle)
- **Phase 4:** Bake models + PyTorch into Docker image to reduce cold start to ~5 min
- Use `FlashAttention` instead of SageAttention to skip compilation (if your GPU supports it)

### ~~BLOCKER: The Dockerfile Needs Modification~~ — RESOLVED 2026-02-10
Resolved: Dockerfile.ci now uses `BUILD_MODE` arg to generate compute or serverless start.sh at build time.

### ~~BLOCKER: CI/CD Not Set Up on the Fork~~ — RESOLVED 2026-02-10
Resolved: CI/CD builds both `:latest` (compute) and `:serverless` images via matrix strategy.

### GOTCHA: Container Disk Size for Serverless
Serverless workers need **75 GB+** container disk. The default (10-20 GB) causes `ENOSPC` errors
during runtime PyTorch installation and model downloads. Set this in the RunPod Endpoint config.

### GOTCHA: GHCR Image Is Private
Since the repo is private, the Docker image on GHCR is also private by default.
RunPod requires Docker credentials (GitHub username + PAT with `read:packages` scope) in the
pod template to pull the image. Alternative: make the GHCR package public (repo stays private)
via GitHub Packages settings.

### NOTE: Minor Warnings in Boot Log (Non-Blocking)
These were observed on first successful boot (2026-02-10) and are safe to ignore:
- `WARNING: You need pytorch with cu130 or higher to use optimized CUDA operations` — ComfyUI's
  new `comfy_kitchen` CUDA backend wants cu130+. Falls back to `eager` backend. Works fine.
- `FantasyPortrait nodes not available: No module named 'onnx'` — fix with `pip install onnx` if needed.
- `Cannot import 'guidedFilter' from 'cv2.ximgproc'` — LayerStyle nodes need `opencv-contrib-python`.
- `ComfyUI-Manager security level raised from 'weak' to 'normal'` — auto-corrected, fine for compute.
- Several DEPRECATION warnings for legacy JS APIs in custom nodes — cosmetic, everything works.

### GOTCHA: Async vs. Sync API
- `/run` — Returns immediately with job ID. You must poll `/status/<job_id>` to get results.
- `/runsync` — Waits for the result (has a timeout, default ~30 seconds, configurable up to 300s).

For long video generation (which can take minutes), use `/run` + polling.

### GOTCHA: Network Volume Is Region-Locked
If using a network volume for models, the volume and endpoint must be in the same region.
Not needed if models are baked into the Docker image.

### GOTCHA: No Interactive ComfyUI Access on Serverless
Unlike compute pods, there's no browser UI for ComfyUI on serverless.
Develop workflows on the **compute pod** (Phase 1), then export the API-format JSON for serverless.

### GOTCHA: Handler Only Returns Images
The current handler.py only processes nodes that output `images`.
If your workflow produces video files, GIFs, or other formats via custom nodes,
the handler may need modification to collect those outputs.
(Check `handler.py` lines 669-767 — it looks for `"images"` key in outputs.)

### GOTCHA: Model Download on First Cold Start
Without baked-in models, the first cold start downloads all enabled models (~30 GB for Gaussian Splatting set).
This makes first cold start **very slow** (~15-20 min). Subsequent cold starts with the same worker
are faster if data is cached. Phase 4 addresses this by baking models into the image.

### NOTE: Workflow Development Happens on the Compute Pod
You build workflows using ComfyUI on the compute pod (Phase 1), not on serverless.
The compute pod gives you the interactive browser UI to drag nodes, connect them, and test.
Export via "Save (API Format)" → that JSON is what you send to the serverless endpoint.
You already know how to use ComfyUI's API from your Python + localhost:8188 experience.

### NOTE: CORS Is Not an Issue for Serverless
Your TypeScript app calls RunPod's API (`api.runpod.ai`), not the ComfyUI instance directly.
RunPod's API handles CORS. This is one of the benefits of serverless over compute.

---

## 10. TypeScript Test App Plan

### Purpose
- Validate API integration before implementing in the main AI Studio app
- Prototype UI/UX patterns
- Serve as a reference implementation for the main team

### Architecture
```
TypeScript Test App
├── api/
│   └── runpod.ts           ← RunPod Serverless API wrapper
├── workflows/
│   └── *.json               ← Exported ComfyUI workflows (API format)
├── components/              ← UI components
└── app/                     ← Pages
```

### Key Design Decisions
- **API wrapper talks to RunPod's API** (not ComfyUI directly) — stable URL, built-in auth
- **Handle async job polling** — submit job, poll for status, display result
- **Store workflow JSONs** in the repo (exported from local ComfyUI via "Save API Format")
- **No CORS issues** — RunPod API handles cross-origin requests
- **Environment variables:** `RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_ID`

### Example API Wrapper

```typescript
// api/runpod.ts
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;
const BASE_URL = `https://api.runpod.ai/v2/${ENDPOINT_ID}`;

export async function submitJob(workflow: object, images?: Array<{name: string, image: string}>) {
  const response = await fetch(`${BASE_URL}/run`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RUNPOD_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: { workflow, images }
    }),
  });
  return response.json(); // { id: "job-abc123", status: "IN_QUEUE" }
}

export async function getJobStatus(jobId: string) {
  const response = await fetch(`${BASE_URL}/status/${jobId}`, {
    headers: { "Authorization": `Bearer ${RUNPOD_API_KEY}` },
  });
  return response.json(); // { status: "COMPLETED", output: { images: [...] } }
}

export async function pollUntilComplete(jobId: string, intervalMs = 2000, maxAttempts = 150) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getJobStatus(jobId);
    if (status.status === "COMPLETED") return status;
    if (status.status === "FAILED") throw new Error(status.error || "Job failed");
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error("Job timed out");
}
```

---

## 11. SETUP_LOG.md — Tracking Changes

Whenever you modify the Docker setup (add models, custom nodes, pip packages),
tell the Cursor agent and it will update SETUP_LOG.md. This log is the source of truth
for what goes into the Dockerfile when you rebuild.

**What to track:**
- Custom nodes added/removed (git clone URL)
- Models added/removed (download URL, target path)
- Pip packages added
- ComfyUI version changes
- Any configuration changes

This file should live in the repo alongside the Dockerfile.

---

## 12. Decisions Log

| Date | Decision | Reasoning |
|---|---|---|
| 2026-02-09 | Use Compute Pod for workflow development | Need interactive ComfyUI UI to build/test workflows. Can't do this on serverless. |
| 2026-02-09 | Deploy to Serverless for production API | Stable URLs, auto-scaling, pay-per-use, API key auth. Better than compute for the studio app. |
| 2026-02-09 | ~~Use Network Volume on compute pod~~ | ~~Persists models/nodes across pod recreations.~~ **Superseded 2026-02-10.** |
| 2026-02-09 | ~~Use Start Command for symlink automation~~ | ~~Every pod boot re-creates symlinks.~~ **Superseded 2026-02-10.** |
| 2026-02-09 | Maintain SETUP_LOG.md during development | Every model, node, package logged → becomes the Dockerfile recipe for serverless image. |
| 2026-02-09 | Will develop OWN workflows, not use WAN defaults | The repo was chosen for its serverless infrastructure, not its specific models/workflows. |
| 2026-02-09 | Fork wan2.2_runpod-temp as starting point | Has handler.py, start.sh, runtime-init.sh, download_models.sh — all serverless components ready. |
| 2026-02-09 | TypeScript test app calls RunPod API (not ComfyUI) | Stable URL, built-in auth, no CORS issues, async job support. |
| 2026-02-10 | Drop network volume, use pause/start instead | Symlinks caused issues. Without NV, pod can pause/resume and data persists in container. |
| 2026-02-10 | Build own Docker image before Phase 1 dev | Fixes outdated ComfyUI (v0.3.56), gives full control. CI/CD set up now, not deferred to Phase 2. |
| 2026-02-10 | Use Dockerfile.ci for CI/CD builds | Lightweight image (~5-8 GB), fast CI builds. PyTorch/nodes/SageAttention installed at runtime. |
| 2026-02-10 | Default COMFYUI_USE_LATEST=true | Always install latest ComfyUI. Avoids version pinning issues with ComfyUI-Manager. |
| 2026-02-10 | Default DOWNLOAD_ALL=false | No models auto-download. User installs only what they need during development. |
| 2026-02-10 | GHCR image is private, credentials in template | Repo is private → GHCR package is private. PAT with read:packages required in RunPod template. Can make package public later. |
| 2026-02-10 | Pod deployed and verified | ComfyUI v0.12.3, PyTorch 2.10.0+cu128, SageAttention 2.2.0, RTX 4090. ~5 min boot. All systems working. |
| 2026-02-10 | Single Dockerfile with BUILD_MODE arg | One Dockerfile.ci generates both compute and serverless start.sh via conditional `if/else` in RUN. Avoids maintaining two Dockerfiles. |
| 2026-02-10 | CI/CD matrix for dual image builds | GitHub Actions matrix builds `:latest` (compute) and `:serverless` from same Dockerfile.ci. Both images always stay in sync. |
| 2026-02-11 | 75 GB+ container disk for serverless | Runtime PyTorch install + model downloads need ~50-60 GB. Default 10-20 GB causes ENOSPC. |
| 2026-02-11 | Readiness probe before handler.py | Shell `while` loop polls `http://127.0.0.1:8188/` for up to 600s before starting handler.py. Prevents "server not reachable" errors on cold boot. |
| 2026-02-11 | Phase 2 complete | Serverless endpoint tested — simple_test.json completed in 855ms via `/runsync`. |

---

## Quick Reference: Common Commands

**Endpoint:** `https://api.runpod.ai/v2/j8rzwzndlbstn0`

```bash
# Check endpoint health
curl -H "Authorization: Bearer $RUNPOD_API_KEY" \
  https://api.runpod.ai/v2/j8rzwzndlbstn0/health

# Submit an async job
curl -X POST \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"workflow": '"$(cat workflow.json)"'}}' \
  https://api.runpod.ai/v2/j8rzwzndlbstn0/run

# Check job status
curl -H "Authorization: Bearer $RUNPOD_API_KEY" \
  https://api.runpod.ai/v2/j8rzwzndlbstn0/status/JOB_ID

# Submit a sync job (waits for result)
curl -X POST \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"workflow": '"$(cat workflow.json)"'}}' \
  https://api.runpod.ai/v2/j8rzwzndlbstn0/runsync
```

### PowerShell (Windows) — Tested & Working

```powershell
# Health check
curl.exe -H "Authorization: Bearer $env:RUNPOD_API_KEY" https://api.runpod.ai/v2/j8rzwzndlbstn0/health

# Submit sync job (reads workflow from file)
$workflow = Get-Content -Raw workflows/simple_test.json | ConvertFrom-Json
$payload = @{ input = @{ workflow = $workflow } } | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText("$PWD\payload.json", $payload)
curl.exe -X POST -H "Authorization: Bearer $env:RUNPOD_API_KEY" -H "Content-Type: application/json" -d "@payload.json" https://api.runpod.ai/v2/j8rzwzndlbstn0/runsync
```

---

## What to Do Right Now (Next Steps)

**You are in Phase 3: TypeScript Test App.**

**Status as of 2026-02-11:**
- Phase 1 (Workflow Development): COMPLETE ✓
- Phase 2 (Dockerize for Serverless): COMPLETE ✓
- CI/CD: Working. Images: `:latest` (compute) and `:serverless` on GHCR
- Serverless Endpoint: `https://api.runpod.ai/v2/j8rzwzndlbstn0` — tested and working
- API Key: Stored (user has it)
- Workflows: 3 Gaussian Splatting + 1 simple test, all exported in API format

**Immediate next steps (Phase 3):**

1. **Build a TypeScript test app** to submit workflows to the serverless endpoint
2. **Implement async job polling** — submit via `/run`, poll `/status/<id>` until complete
3. **Display results** — decode base64 images and render in the UI
4. **Prototype UI/UX patterns** that the main AI Studio app will reuse

**Phase 4 (later):**
- Optimize cold start (bake models into image)
- Test concurrent requests and scaling
- Hand off to main AI Studio app team

### Key Files in This Repo

```
c:\Users\majds\OneDrive\Desktop\Liquidox\
├── COMFYUI_RUNPOD_GUIDE.md          ← THIS FILE (project guide)
├── SETUP_LOG.md                      ← Tracks all changes for Dockerization
├── Dockerfile.ci                     ← CI-optimized Dockerfile (used by GitHub Actions)
├── Dockerfile.wan22                  ← Full Dockerfile (alternative, not used by CI)
├── .github/workflows/
│   └── docker-build.yml              ← CI/CD: auto-builds image on push
├── runpod-worker-comfyui/
│   ├── handler.py                    ← Serverless handler (READY, no changes needed)
│   └── src/
│       ├── start.sh                  ← Serverless start script (READY)
│       └── extra_model_paths.yaml    ← Model path config for network volumes
├── scripts/
│   ├── runtime-init.sh               ← Runtime setup (ComfyUI, nodes, SageAttention)
│   └── download_models.sh            ← Model downloader (defaults to no downloads)
├── docs/                             ← Original repo documentation
├── build_and_deploy_ghcr.ps1         ← Manual build script (PowerShell)
├── build_and_deploy_ghcr.sh          ← Manual build script (Bash)
└── docker-compose.wan22.yml          ← Docker compose config
```

---

*This guide is maintained alongside the project. Update it as decisions change.*

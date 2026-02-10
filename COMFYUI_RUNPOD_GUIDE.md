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

### Phase 1: Develop Workflows on Compute Pod (CURRENT)
Deploy a compute pod from your own Docker image (`ghcr.io/majdsalim/lxotesting:latest`).
Keep the pod running while developing. No network volume needed — data lives in the container.

- [x] Fork wan2.2_runpod-temp into private repo → https://github.com/majdsalim/LXOtesting
- [x] Pull to Cursor workspace
- [x] Set up CI/CD (GitHub Actions) → `.github/workflows/docker-build.yml`
- [x] Fix Dockerfile.ci: use latest ComfyUI, no model auto-downloads
- [x] Push to GitHub → CI/CD builds Docker image → `ghcr.io/majdsalim/lxotesting:latest`
- [ ] Create RunPod pod template `LXOtemp` using YOUR image
- [ ] Deploy compute pod (no network volume — keep pod running, pause/start to persist)
- [ ] Install YOUR models and custom nodes (not the WAN defaults)
- [ ] Build and test YOUR ComfyUI workflows in the browser UI
- [ ] **Maintain SETUP_LOG.md** — log every model, node, and package installed
- [ ] Export finalized workflows via "Save (API Format)" in ComfyUI
- [ ] Test workflows work via API (curl to the compute pod's URL)

**Compute pod template `LXOtemp` settings:**
- Container image: `ghcr.io/majdsalim/lxotesting:latest`
- Container disk: 50 GB (models stored in container, no network volume)
- Volume disk: 0 GB
- HTTP Ports: `8188, 8189`
- Start Command: *(use default — no custom start command needed)*
- Environment Variables:
  - `COMFYUI_USE_LATEST=true` (install latest ComfyUI at boot)
  - `DOWNLOAD_ALL=false` (no auto model downloads — you install your own)
  - `COMFY_LOG_LEVEL=DEBUG`

> **NOTE on compute pod without network volume:** You CAN pause/resume the pod.
> Data persists as long as you don't terminate. The pod ID stays the same across pause/start.
> First boot: ~15-20 min (installs ComfyUI, PyTorch, nodes, SageAttention).
> Subsequent boots (pause/start): ~2-5 min (skips install if `.initialized` exists).
> ComfyUI: `https://<pod-id>-8188.proxy.runpod.net`
> JupyterLab: `https://<pod-id>-8189.proxy.runpod.net`

### Phase 2: Dockerize for Serverless
Once workflows are stable and tested:

- [ ] Translate SETUP_LOG.md into Dockerfile instructions (your models, your nodes)
- [ ] Create a serverless Dockerfile (modify start.sh: ComfyUI background + handler.py foreground)
- [ ] Push to GitHub → CI/CD rebuilds the Docker image
- [ ] Create Serverless Endpoint on RunPod with the built image
- [ ] Test with API request (curl)

### Phase 3: TypeScript Test App
- [ ] Build simple TypeScript app to test workflows via RunPod Serverless API
- [ ] Prototype UI/UX patterns for the AI Studio app
- [ ] Handle async job polling (RunPod serverless is async by default)

### Phase 4: Production Optimization
- [ ] Optimize cold start times (bake models into image if needed)
- [ ] Test concurrent requests and scaling
- [ ] Hand off to main AI Studio app team

---

## 5. What the Repo Already Has

Everything needed for serverless is already in the repo:

| File | Purpose | Status |
|---|---|---|
| `Dockerfile.wan22` | Builds the Docker image (currently compute mode) | **Needs modification** for serverless |
| `runpod-worker-comfyui/handler.py` | Receives RunPod jobs, sends to ComfyUI, returns results | **Ready** — no changes needed |
| `runpod-worker-comfyui/src/start.sh` | Serverless start script (ComfyUI background + handler) | **Ready** — this is what we need |
| `scripts/runtime-init.sh` | Installs SageAttention, verifies nodes at runtime | **Ready** — no changes needed |
| `scripts/download_models.sh` | Downloads models (supports network volume paths) | **Ready** — already handles /workspace |
| `runpod-worker-comfyui/src/extra_model_paths.yaml` | Tells ComfyUI to also look for models in /runpod-volume | **Ready** — useful for network volume |

---

## 6. What We Need to Change

### The Dockerfile's Start Script

The current Dockerfile creates a **compute mode** start.sh that:
- Runs ComfyUI in FOREGROUND (listening on 0.0.0.0:8188 for direct access)
- Starts JupyterLab on port 8189
- Does NOT start the RunPod handler

For serverless, the start.sh needs to:
- Run runtime-init.sh (SageAttention, node verification)
- Run download_models.sh (model downloads)
- Start ComfyUI in BACKGROUND (on localhost:8188, internal only)
- Start the RunPod handler (handler.py) which receives jobs

### What the New start.sh Should Look Like

```bash
#!/usr/bin/env bash
echo "WAN 2.2 RunPod Serverless - Starting initialization..."

# Run runtime initialization (SageAttention, custom nodes, etc.)
/scripts/runtime-init.sh

# Use libtcmalloc for better memory management
TCMALLOC="$(ldconfig -p | grep -Po "libtcmalloc.so.\d" | head -n 1)"
export LD_PRELOAD="${TCMALLOC}"

# Download models (uses /workspace if network volume attached, else /comfyui/models)
echo "Checking for models..."
/scripts/download_models.sh

# Allow operators to tweak verbosity; default is DEBUG
: "${COMFY_LOG_LEVEL:=DEBUG}"

echo "Starting ComfyUI in background on localhost:8188..."
python -u /comfyui/main.py \
    --disable-auto-launch \
    --disable-metadata \
    --verbose "${COMFY_LOG_LEVEL}" \
    --log-stdout \
    --use-sage-attention &

echo "Starting RunPod Handler..."
python -u /handler.py
```

**Key difference from compute mode:** ComfyUI runs in background (`&`) on localhost only,
and `handler.py` runs in foreground (receives jobs from RunPod).

### Other Dockerfile Changes

1. **Remove JupyterLab stage** — not needed for serverless (saves image size)
2. **Change labels** — update from "compute" to "serverless"
3. **Remove port 8189 exposure** — no JupyterLab

### Model Strategy: Two Options

| | **Option A: Network Volume** | **Option B: Bake Into Image** |
|---|---|---|
| **Docker image size** | ~15-20 GB (no models) | ~30-150 GB (models included) |
| **Cold start time** | Faster image pull, but models load from network storage | Slower image pull, but models already local |
| **Adding new models** | Put them on the network volume (no rebuild) | Edit Dockerfile, rebuild image |
| **Best for** | Development, frequently changing models | Production, stable model set |
| **Setup complexity** | Need to create network volume per region | Just rebuild the image |

**Recommendation for now:** Use **Option A (Network Volume)** for development.
The `download_models.sh` script already supports this — it automatically uses `/workspace/models`
if a network volume is mounted, and downloads models there on first run.

When your model set stabilizes, you can switch to Option B by baking them into the Dockerfile.

---

## 7. Setup Steps

### Step 1: Fork the Repo ✅ DONE
- Forked to https://github.com/majdsalim/LXOtesting (private)
- Cloned to `c:\Users\majds\OneDrive\Desktop\Liquidox`

### Step 2: Modify the Dockerfile for Serverless
1. Change the start.sh creation in `Dockerfile.wan22` to use serverless mode (see Section 6)
2. Optionally remove JupyterLab stage to reduce image size
3. Update labels from "compute" to "serverless"

### Step 3: Set Up CI/CD (GitHub Actions)
1. Create `.github/workflows/docker-build.yml` in the repo
2. Configure it to build `Dockerfile.wan22` and push to GHCR
3. Set up `GITHUB_TOKEN` permissions for GHCR push
4. Push to `main` branch → image builds automatically
5. Image will be available at: `ghcr.io/majdsalim/lxotesting:latest`

### Step 4: Create a Network Volume (Optional but Recommended)
1. Go to [RunPod Console → Storage](https://www.runpod.io/console/user/storage)
2. Create a network volume (50-100 GB)
3. Choose region based on **GPU availability and price** (not team location — latency is irrelevant)
4. Note: the `download_models.sh` script auto-downloads models to the volume on first cold start

### Step 5: Create Serverless Endpoint on RunPod
1. Go to [RunPod Console → Serverless](https://www.runpod.io/console/serverless)
2. Click "New Endpoint"
3. Configure:
   - **Name:** `comfyui-wan22-dev`
   - **Docker Image:** `ghcr.io/majdsalim/lxotesting:latest`
   - **GPU:** Select appropriate GPU type
   - **Workers:**
     - Min Workers: 0 (scale to zero when idle — saves cost)
     - Max Workers: 1 (for development, increase for production)
   - **Idle Timeout:** 60 seconds (keep worker warm for 60s after last request)
   - **Network Volume:** Attach the one from Step 4 (optional)
   - **Environment Variables:**
     - `COMFY_LOG_LEVEL=DEBUG`
     - `DOWNLOAD_ALL=false` (then enable only the model flags you need)
     - `DOWNLOAD_WAN_CORE=true` (or whichever models you need)
4. Note the **Endpoint ID** — this is part of your API URL

### Step 6: Test the API

```bash
# Check endpoint status
curl -H "Authorization: Bearer YOUR_RUNPOD_API_KEY" \
  https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/health

# Submit a job (async — returns immediately with job ID)
curl -X POST \
  -H "Authorization: Bearer YOUR_RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"workflow": YOUR_WORKFLOW_JSON}}' \
  https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/run

# Check job status
curl -H "Authorization: Bearer YOUR_RUNPOD_API_KEY" \
  https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/status/JOB_ID

# Or use /runsync for synchronous (waits for result — has timeout)
curl -X POST \
  -H "Authorization: Bearer YOUR_RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"workflow": YOUR_WORKFLOW_JSON}}' \
  https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync
```

### Step 7: Develop Workflows on Compute Pod (Phase 1 — Do This First)
- Use the compute pod's ComfyUI browser UI to build and test workflows
- Install YOUR models and custom nodes (the WAN defaults are just a base — you'll add your own)
- **Log every change in SETUP_LOG.md** — this becomes the Dockerfile when you're ready for serverless
- Export finalized workflows via "Save (API Format)" in ComfyUI
- The exported JSON is what you send as the `workflow` field in the API request

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
Expected cold start: **3-10 minutes** depending on:
- Docker image size (pull time)
- SageAttention compilation (3-5 min on first boot)
- Model download time (if using network volume and models aren't cached yet)

**Mitigation strategies:**
- Set `Idle Timeout` to 60-300 seconds to keep workers warm between requests
- Set `Min Workers: 1` to always have one warm worker (costs money when idle)
- Bake models into Docker image to eliminate download time
- Use `FlashAttention` instead of SageAttention to skip compilation (if your GPU supports it)

### BLOCKER: The Dockerfile Needs Modification
The current Dockerfile is for compute mode. The start.sh must be changed to serverless mode.
This is the first task before anything else can work. (See Section 6)

### BLOCKER: CI/CD Not Set Up on the Fork
The original repo's GitHub Actions workflow wasn't included in the fork.
We need to create `.github/workflows/docker-build.yml` to automate image builds.

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
If using a network volume, the first cold start after creating the volume will download
all enabled models (could be 50-150 GB). This first cold start will be **very slow** (30-60 min).
Subsequent cold starts will be much faster (models already on volume).

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

---

## Quick Reference: Common Commands

```bash
# Check endpoint health
curl -H "Authorization: Bearer $RUNPOD_API_KEY" \
  https://api.runpod.ai/v2/$ENDPOINT_ID/health

# Submit an async job
curl -X POST \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"workflow": '"$(cat workflow.json)"'}}' \
  https://api.runpod.ai/v2/$ENDPOINT_ID/run

# Check job status
curl -H "Authorization: Bearer $RUNPOD_API_KEY" \
  https://api.runpod.ai/v2/$ENDPOINT_ID/status/JOB_ID

# Submit a sync job (waits for result)
curl -X POST \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"workflow": '"$(cat workflow.json)"'}}' \
  https://api.runpod.ai/v2/$ENDPOINT_ID/runsync
```

---

## What to Do Right Now (Next Steps)

**You are in Phase 1: Workflow Development on Compute Pod.**

**CI/CD is set up. Your image is: `ghcr.io/majdsalim/lxotesting:latest`**

1. **Wait for the GitHub Actions build** to complete (check Actions tab on the repo)
2. **Create a RunPod pod template** `LXOtemp` using `ghcr.io/majdsalim/lxotesting:latest`
   - Container disk: 50 GB, HTTP Ports: `8188,8189`
   - Env vars: `COMFYUI_USE_LATEST=true`, `DOWNLOAD_ALL=false`, `COMFY_LOG_LEVEL=DEBUG`
3. **Deploy a compute pod** (no network volume needed — use pause/start to persist data)
4. **Wait for first boot** (~15-20 min — installs everything from scratch)
5. **Access ComfyUI** at `https://<pod-id>-8188.proxy.runpod.net`
6. **Install YOUR models and custom nodes** — your own pipeline needs
7. **Build and test YOUR workflows** in the ComfyUI browser UI
8. **Log every change** — tell the Cursor agent what you installed so it updates SETUP_LOG.md
9. **Export workflows** via "Save (API Format)" when they're working
10. **Test API calls** to the compute pod (curl to `<pod-url>/prompt`) to verify the API format works

**When workflows are stable → move to Phase 2 (Dockerize for Serverless).**

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

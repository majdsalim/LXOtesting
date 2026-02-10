# Setup Log — ComfyUI RunPod Endpoint

> **Purpose:** Track every model, custom node, pip package, and configuration change
> made on the compute pod. This log becomes the Dockerfile recipe when transitioning to serverless.
>
> **How to use:** Tell the Cursor agent whenever you install something.
> Example: "I just installed ComfyUI-AnimateDiff from https://github.com/... and downloaded model X"
> The agent will update this file with the exact commands needed to reproduce the change in a Dockerfile.

---

## Custom Nodes Installed

| Node | Git URL | Install Command | Date | Notes |
|---|---|---|---|---|
| *(none yet — base WAN repo nodes are pre-installed in the Docker image)* | | | | |

## Models Installed

| Model | Download URL | Target Path | Size | Date | Notes |
|---|---|---|---|---|---|
| *(none yet — base WAN repo models are pre-installed or downloaded via download_models.sh)* | | | | | |

## Pip Packages Installed

| Package | Version | Install Command | Date | Notes |
|---|---|---|---|---|
| *(none yet)* | | | | |

## Configuration Changes

| Change | Details | Date |
|---|---|---|
| *(none yet)* | | |

## ComfyUI Workflows (API Format)

| Workflow | Description | File | Date |
|---|---|---|---|
| *(none yet — export from ComfyUI via "Save API Format")* | | | |

---

*Updated by the Cursor agent. Tell the agent about every change you make on the compute pod.*

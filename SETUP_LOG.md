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
| Qwen Image VAE | https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors | /models/vae/ | TBD | 2026-02-10 | VAE for Qwen Image model |
| Qwen Image Edit 2511 FP8 | https://huggingface.co/1038lab/Qwen-Image-Edit-2511-FP8/resolve/main/Qwen-Image-Edit-2511-FP8_e4m3fn.safetensors | /models/diffusion_models/ | 20.4 GB | 2026-02-10 | FP8 (e4m3fn) quantized model |

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

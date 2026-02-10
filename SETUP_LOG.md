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
| ComfyUI-Sharp | https://github.com/PozzettiAndrea/ComfyUI-Sharp.git | `cd /comfyui/custom_nodes && git clone https://github.com/PozzettiAndrea/ComfyUI-Sharp.git && pip install -r /comfyui/custom_nodes/ComfyUI-Sharp/requirements.txt` | 2026-02-10 | SHARP (Apple) wrapper for monocular 3D Gaussian Splatting; model auto-downloads on first run (offline: place `sharp_2572gikvuh.pt` in `ComfyUI/models/sharp/`). |
| comfyui-GaussianViewer | https://github.com/CarlMarkswx/comfyui-GaussianViewer.git | `cd /comfyui/custom_nodes && git clone https://github.com/CarlMarkswx/comfyui-GaussianViewer.git && pip install -r /comfyui/custom_nodes/comfyui-GaussianViewer/requirements.txt` | 2026-02-10 | Interactive preview + high-quality render for Gaussian Splatting PLY files (node: `GaussianViewer`). |

## Models Installed

| Model | Download URL | Target Path | Size | Date | Notes |
|---|---|---|---|---|---|
| Qwen Image VAE | https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors | /models/vae/ | TBD | 2026-02-10 | VAE for Qwen Image model |
| Qwen Image Edit 2511 FP8 | https://huggingface.co/1038lab/Qwen-Image-Edit-2511-FP8/resolve/main/Qwen-Image-Edit-2511-FP8_e4m3fn.safetensors | /models/diffusion_models/ | 20.4 GB | 2026-02-10 | FP8 (e4m3fn) quantized model |
| Qwen 2.5 VL 7B FP8 Scaled (Text Encoder) | https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors | /models/text_encoders/ | 7.5 GB | 2026-02-10 | Qwen VL text encoder weights for Qwen Image ComfyUI |
| Qwen Image Edit 2511 Gaussian Splash (Sharp) LoRA | https://huggingface.co/dx8152/Qwen-Image-Edit-2511-Gaussian-Splash/resolve/main/%E9%AB%98%E6%96%AF%E6%B3%BC%E6%BA%85-Sharp.safetensors | /models/loras/高斯泼溅-Sharp.safetensors | TBD | 2026-02-10 | LoRA (Gaussian Splash / Sharp). Filename is Chinese — downloaded via huggingface-cli to avoid URL encoding issues. |
| Qwen Image Edit 2511 Lightning 8 Steps (fp32) LoRA | https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main/Qwen-Image-Edit-2511-Lightning-8steps-V1.0-fp32.safetensors | /models/loras/ | TBD | 2026-02-10 | LoRA (Lightning / 8 steps) |
| SHARP model weights (`sharp_2572gikvuh.pt`) | https://huggingface.co/apple/Sharp/resolve/main/sharp_2572gikvuh.pt | /models/sharp/ | TBD | 2026-02-10 | Required by ComfyUI-Sharp (offline placement path) |

## Pip Packages Installed

| Package | Version | Install Command | Date | Notes |
|---|---|---|---|---|
| *(none yet)* | | | | |

## Configuration Changes

| Change | Details | Date |
|---|---|---|
| ComfyUI-Manager security level | Set `security_level = weak` in `/user/__manager/config.ini` | 2026-02-10 |

## ComfyUI Workflows (API Format)

| Workflow | Description | File | Date |
|---|---|---|---|
| Gaussiansplt simple | Gaussian splatting simple workflow (API format) | `workflows/Gaussiansplt_simple.json` | 2026-02-10 |
| Gaussiansplt simple (SHARP) | Gaussian splatting simple workflow using SHARP | `workflows/Gaussiansplt_simple_sharp.json` | 2026-02-10 |
| Gaussiansplt simple (Qwen) | Gaussian splatting simple workflow using Qwen | `workflows/Gaussiansplt_simple_qwen.json` | 2026-02-10 |
| Simple Test | Lightweight API test: LoadImage → Resize (KJNodes) → SaveImage. No models needed. | `workflows/simple_test.json` | 2026-02-10 |

---


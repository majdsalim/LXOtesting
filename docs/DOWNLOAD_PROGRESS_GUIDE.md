# Download Progress Guide - Quick Reference

## Understanding the Download Output

This guide helps you understand what you're seeing when WAN 2.2 models are being downloaded in your RunPod deployment.

## Output Sections Explained

### 1. Initial Header
```
╔═══════════════════════════════════════════════════════════════════════╗
║           🎬 WAN 2.2 Model Download Manager 🎬                        ║
║  Total Download Size: ~80GB                                          ║
║  Storage Location: /workspace/models                                 ║
╚═══════════════════════════════════════════════════════════════════════╝
```
**What it means:** Overview of what's about to be downloaded and where it will be stored.

### 2. Configuration Summary
```
🔧 Download Configuration:
   ✅ Primary: HuggingFace CLI (optimized transfer protocol)
   ✅ Fallback: aria2c (32 parallel connections)
   ✅ Concurrent downloads: Up to 6 files simultaneously
```
**What it means:** Shows which download tools are available and how many files will download at once.

### 3. Download Plan
```
📋 Download Plan:
   • Phase 1: Diffusion Models (4 files, ~60GB)
   • Phase 2: Text Encoders, VAE, LoRAs (6 files, ~15GB)
   • Phase 3: Upscale Models (5 files, ~5GB)

⏱️  Estimated time: 15-30 minutes (depending on network speed)
```
**What it means:** Breakdown of what will be downloaded in each phase and how long it might take.

### 4. Phase Headers
```
╔═══════════════════════════════════════════════════════════════════════╗
║  PHASE 1/3: Diffusion Models (Core WAN 2.2 Models)                   ║
║  Files: 4 | Size: ~60GB | Format: fp16 + fp8_scaled                  ║
╚═══════════════════════════════════════════════════════════════════════╝
```
**What it means:** You're starting a new phase of downloads. This tells you which phase and what's in it.

### 5. Parallel Download Manager
```
╔════════════════════════════════════════════════════════════════════╗
║  Parallel Download Manager: Up to 6 concurrent downloads          ║
║  Total files in queue: 4                                          ║
╚════════════════════════════════════════════════════════════════════╝
```
**What it means:** The system is about to start downloading multiple files at the same time.

### 6. File Start Notification
```
🚦 Starting download 1/4: wan2.2_t2v_high_noise_14B_fp16.safetensors
```
**What it means:** A new file download is starting. The number shows progress (1 out of 4 total files).

### 7. Individual File Download
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📥 Downloading: wan2.2_t2v_high_noise_14B_fp16.safetensors
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Method: HuggingFace CLI (optimized transfer protocol)
📦 Repository: Comfy-Org/Wan_2.2_ComfyUI_Repackaged
📄 File: split_files/diffusion_models/wan2.2_t2v_high_noise_14B_fp16.safetensors

⏳ Starting download...
```
**What it means:** 
- The file being downloaded
- Which method is being used (HuggingFace CLI is fastest)
- Where the file is coming from
- Download is in progress

### 8. Download Complete
```
✅ Download complete!
   📊 Size: 14.23 GB
   ⏱️  Time: 3m 45s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
**What it means:** 
- File downloaded successfully
- Final file size
- How long it took to download

### 9. Progress Update
```
📊 Progress: 2/4 files completed
```
**What it means:** Overall progress for the current batch. 2 files done, 2 more to go.

### 10. Batch Complete
```
╔════════════════════════════════════════════════════════════════════╗
║  ✅ All downloads in this batch complete! (4/4)                   ║
╚════════════════════════════════════════════════════════════════════╝
```
**What it means:** All files in the current phase have been downloaded successfully.

### 11. Final Summary
```
╔═══════════════════════════════════════════════════════════════════════╗
║              ✅ ALL DOWNLOADS COMPLETED SUCCESSFULLY! ✅              ║
╚═══════════════════════════════════════════════════════════════════════╝

📊 Download Summary:
   📁 Storage location: /workspace/models
   📦 Total files downloaded: 15
   💾 Total storage used: 82.4GB

🎉 WAN 2.2 is ready to use!
```
**What it means:** Everything is done! Shows final statistics and confirms the system is ready.

## Download Methods Explained

### 🚀 HuggingFace CLI (Primary)
- **Fastest method** for HuggingFace repositories
- Uses optimized transfer protocol
- Automatically used when available
- Best for large model files

### 🚀 aria2c (Fallback #1)
- **Fast multi-connection downloads**
- Uses 32 parallel connections
- Good for general file downloads
- Used if HuggingFace CLI fails or isn't available

### 🚀 wget (Fallback #2)
- **Reliable single-connection download**
- Used as last resort
- Slower but very stable
- Works everywhere

## What to Look For

### ✅ Good Signs
- `✅ Download complete!` - File downloaded successfully
- `📊 Progress: X/Y files completed` - Making progress
- `🚀 Method: HuggingFace CLI` - Using fastest method
- `✅ ALL DOWNLOADS COMPLETED SUCCESSFULLY!` - Everything done

### ⚠️ Warning Signs
- `⚠️ huggingface-cli failed, trying aria2c...` - Fallback to slower method (still OK)
- `⚠️ aria2c failed, trying wget...` - Using slowest method (still OK, just slower)

### ❌ Error Signs
- `ERROR` in output - Something went wrong
- Download stuck for a long time - May need to restart
- File size shows as 0 GB - Download may have failed

## Typical Timeline

### Fast Network (1 Gbps+)
- **Phase 1** (Diffusion Models): 5-10 minutes
- **Phase 2** (Text Encoders, VAE, LoRAs): 3-5 minutes
- **Phase 3** (Upscale Models): 1-2 minutes
- **Total**: ~10-20 minutes

### Medium Network (100-500 Mbps)
- **Phase 1** (Diffusion Models): 15-25 minutes
- **Phase 2** (Text Encoders, VAE, LoRAs): 5-10 minutes
- **Phase 3** (Upscale Models): 2-5 minutes
- **Total**: ~25-40 minutes

### Slow Network (<100 Mbps)
- **Phase 1** (Diffusion Models): 30-60 minutes
- **Phase 2** (Text Encoders, VAE, LoRAs): 10-20 minutes
- **Phase 3** (Upscale Models): 5-10 minutes
- **Total**: ~45-90 minutes

## Troubleshooting

### Downloads are slow
- **Normal if using aria2c or wget** - HuggingFace CLI is fastest
- **Check your network speed** - RunPod network is usually very fast
- **Wait for completion** - Large files take time even on fast networks

### Download failed
- **Check the error message** - Usually indicates network issue
- **Restart the container** - Will resume from where it left off
- **Check RunPod status** - May be a temporary issue

### Files already exist
```
✅ wan2.2_t2v_high_noise_14B_fp16.safetensors already exists (14.23 GB), skipping...
```
- **This is good!** - Means files are already downloaded
- **Saves time** - Won't re-download existing files
- **Safe to continue** - Script will only download missing files

## FAQ

**Q: Why do I see multiple files downloading at once?**  
A: The script downloads up to 6 files simultaneously to speed up the process.

**Q: What if a download fails?**  
A: The script will try fallback methods (aria2c, then wget). If all fail, you'll see an error.

**Q: Can I pause and resume?**  
A: Not currently, but if you restart the container, it will skip already-downloaded files.

**Q: How much disk space do I need?**  
A: At least 85GB free space (80GB for models + 5GB buffer).

**Q: What if I run out of disk space?**  
A: The download will fail. Make sure you have enough space before starting.

**Q: Why are some files fp16 and others fp8_scaled?**  
A: Different precision formats. fp16 is higher quality, fp8_scaled is more memory-efficient.

## Need Help?

If you encounter issues:
1. Check the error messages in the output
2. Look for the specific file that failed
3. Check your RunPod disk space
4. Check your network connection
5. Try restarting the container
6. Contact support with the error messages

---

**Remember:** The download process is fully automated. Just wait for the final success message!


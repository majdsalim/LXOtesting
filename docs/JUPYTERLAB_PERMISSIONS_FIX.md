# JupyterLab File Upload & Folder Creation Permissions Fix

**Date:** October 13, 2025  
**Issue:** Users unable to upload files or create folders in JupyterLab  
**Status:** Fixed - Awaiting Testing

## Problem Description

### Symptoms
- JupyterLab accessible on port 8189 ✅
- Cannot upload files via JupyterLab interface ❌
- Cannot create new folders in `/comfyui` directory ❌
- File system appears read-only to JupyterLab ❌

### Root Cause Analysis

The issue was caused by **insufficient permissions and timing problems**:

1. **Insufficient Permissions (755)**
   - Previous fix used `chmod -R 755 /comfyui`
   - 755 = `rwxr-xr-x` (owner: rwx, group: r-x, others: r-x)
   - While root (owner) had write access, JupyterLab's file operations may have been affected by group/other restrictions

2. **Timing Issues**
   - Permissions were set during runtime-init.sh
   - Model downloads happened AFTER runtime-init.sh completed
   - JupyterLab started AFTER model downloads
   - New files/directories created during downloads may not have inherited proper permissions

3. **Missing JupyterLab Configuration**
   - No explicit configuration for file operations
   - Default ContentsManager settings may have been too restrictive

## Solution Implemented

### 1. Enhanced JupyterLab Configuration

**File:** `scripts/runtime-init.sh` (Lines 212-225)

Added two new configuration options to JupyterLab config:

```python
c.FileContentsManager.delete_to_trash = False
c.ContentsManager.allow_hidden = True
```

**Why this helps:**
- `delete_to_trash = False`: Prevents permission issues with trash directory
- `allow_hidden = True`: Allows JupyterLab to work with hidden files/folders

### 2. Upgraded Permissions to 777

**Files Modified:**
- `scripts/runtime-init.sh` (Lines 231-238)
- `Dockerfile.ci` (Lines 102-105)

Changed from `chmod -R 755` to `chmod -R 777`:

```bash
chmod -R 777 /comfyui
chown -R root:root /comfyui
```

**Why 777:**
- 777 = `rwxrwxrwx` (full read/write/execute for owner, group, and others)
- Ensures JupyterLab can create/modify files regardless of how it's running
- Safe in a single-user Docker container environment
- Eliminates any permission-related edge cases

### 3. Dual Permission Setting (Defense in Depth)

Permissions are now set in **TWO places**:

**A. During Runtime Initialization** (`runtime-init.sh`)
```bash
# Set proper permissions for JupyterLab file uploads and folder creation
# Using 777 to ensure full write access for all operations
echo "🔐 Setting permissions for JupyterLab..."
chmod -R 777 /comfyui
chown -R root:root /comfyui

# Ensure the .initialized marker is writable
chmod 666 /comfyui/.initialized 2>/dev/null || true

# Mark as initialized
touch /comfyui/.initialized
```

**B. Before JupyterLab Starts** (`Dockerfile.ci` start.sh)
```bash
# Ensure /comfyui has proper permissions for JupyterLab file operations
echo "🔐 Ensuring /comfyui permissions for JupyterLab..."
chmod -R 777 /comfyui
chown -R root:root /comfyui
```

**Why dual setting:**
- First setting: After ComfyUI installation and custom nodes
- Second setting: After model downloads, right before JupyterLab starts
- Ensures permissions are correct regardless of what happens in between

## Technical Details

### Permission Breakdown

| Permission | Octal | Binary | Owner | Group | Others |
|------------|-------|--------|-------|-------|--------|
| Old (755)  | 755   | rwxr-xr-x | rwx | r-x | r-x |
| New (777)  | 777   | rwxrwxrwx | rwx | rwx | rwx |

### Execution Flow

```
1. Runtime Init (runtime-init.sh)
   ├─ Install ComfyUI
   ├─ Install PyTorch
   ├─ Install Custom Nodes
   ├─ Build SageAttention
   ├─ Install JupyterLab
   ├─ Configure JupyterLab (NEW: added file operation configs)
   └─ Set Permissions (UPDATED: 755 → 777)

2. Start Script (start.sh in Dockerfile.ci)
   ├─ Download Models
   ├─ Set Permissions AGAIN (NEW: ensures correct permissions after downloads)
   ├─ Start JupyterLab on port 8189
   └─ Start ComfyUI on port 8188
```

### Security Considerations

**Q: Is 777 safe?**

**A: Yes, in this context:**
- Single-user Docker container (not a multi-user system)
- Container runs as root (no privilege escalation risk)
- No external users have access to the container filesystem
- RunPod environment is isolated per user
- JupyterLab has no authentication (already assumes trusted environment)

**Q: Why not use a dedicated user?**

**A: Complexity vs. benefit:**
- Would require creating a new user
- Would need to ensure all processes run as that user
- Would complicate volume mounts and persistence
- Minimal security benefit in a single-user container
- Current approach is simpler and more maintainable

## Testing Checklist

When testing the fix, verify:

- [ ] JupyterLab accessible on port 8189
- [ ] Can upload files via drag-and-drop
- [ ] Can upload files via Upload button
- [ ] Can create new folders
- [ ] Can create new files (notebooks, text files)
- [ ] Can rename files and folders
- [ ] Can delete files and folders
- [ ] Can move files between folders
- [ ] Uploaded files are readable by ComfyUI
- [ ] Files created in JupyterLab persist after container restart (if using volumes)

## Deployment

### Commit Information
- **Commit:** Pending
- **Branch:** master
- **Files Modified:**
  - `scripts/runtime-init.sh`
  - `Dockerfile.ci`
  - `docs/JUPYTERLAB_PERMISSIONS_FIX.md` (this file)

### Build & Deploy
```bash
# Commit changes
git add scripts/runtime-init.sh Dockerfile.ci docs/JUPYTERLAB_PERMISSIONS_FIX.md
git commit -m "fix: JupyterLab file upload permissions - use 777 and dual permission setting"
git push origin master

# GitHub Actions will automatically build and push to GHCR
# Monitor at: https://github.com/lum3on/wan2.2_runpod-temp/actions
```

### Testing in RunPod
1. Deploy new template from `ghcr.io/lum3on/wan22-runpod:latest`
2. Wait for initialization to complete
3. Access JupyterLab at `http://<pod-ip>:8189`
4. Test file upload and folder creation
5. Report results

## Troubleshooting

### If Issue Persists

1. **Check JupyterLab logs:**
   ```bash
   cat /var/log/jupyter.log
   ```

2. **Verify permissions:**
   ```bash
   ls -la /comfyui
   ls -la /comfyui/models
   ```

3. **Check filesystem type:**
   ```bash
   df -T /comfyui
   mount | grep comfyui
   ```

4. **Test manual file creation:**
   ```bash
   # In JupyterLab terminal
   touch /comfyui/test.txt
   mkdir /comfyui/test_folder
   ```

5. **Check for SELinux/AppArmor:**
   ```bash
   getenforce  # Should be "Disabled" or "Permissive"
   aa-status   # Should show no profiles
   ```

### Alternative Solutions (If Still Failing)

If 777 permissions still don't work:

1. **Try ACLs (Access Control Lists):**
   ```bash
   setfacl -R -m u:root:rwx /comfyui
   setfacl -R -d -m u:root:rwx /comfyui
   ```

2. **Check for immutable flags:**
   ```bash
   lsattr /comfyui
   # If +i flag is set, remove it:
   chattr -R -i /comfyui
   ```

3. **Investigate volume mount options:**
   - Check if volume is mounted read-only
   - Check for noexec, nosuid flags
   - Try remounting with different options

## References

- [JupyterLab File Operations Documentation](https://jupyterlab.readthedocs.io/en/stable/user/files.html)
- [Jupyter Server Configuration](https://jupyter-server.readthedocs.io/en/latest/other/full-config.html)
- [Docker Container Permissions Best Practices](https://docs.docker.com/engine/security/userns-remap/)
- [Linux File Permissions Guide](https://www.linux.com/training-tutorials/understanding-linux-file-permissions/)

## Related Issues

- Initial permission fix attempt: commit e818044
- JupyterLab early access enhancement: commit 25ce7b1
- Custom nodes addition: commit 749da21


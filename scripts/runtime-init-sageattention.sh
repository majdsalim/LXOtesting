#!/usr/bin/env bash
# WAN 2.2 SageAttention Runtime Initialization Script
# Compiles SageAttention2++ at container startup (only on first run)
# This runs in RunPod where GPU is available for compilation

set -e

echo "==================================================================="
echo "SageAttention2++ Runtime Initialization"
echo "==================================================================="

# Check if already initialized (for persistent storage)
if [ -f "/comfyui/.sageattention_initialized" ]; then
    echo "✅ SageAttention already initialized - skipping compilation"
    exit 0
fi

echo "==================================================================="
echo "⚡⚡⚡ SAGEATTENTION2++ BUILD STARTING ⚡⚡⚡"
echo "==================================================================="
echo "📦 Installing SageAttention dependencies (wheel, setuptools, ninja, triton)..."
uv pip install --no-cache \
    wheel \
    setuptools \
    packaging \
    ninja \
    triton

echo ""
echo "==================================================================="
echo "🚀🚀🚀 BUILDING SAGEATTENTION2++ FROM SOURCE 🚀🚀🚀"
echo "==================================================================="
echo "⏳ Cloning SageAttention repository..."
cd /tmp
git clone https://github.com/thu-ml/SageAttention.git
cd SageAttention

echo "⏳ Compiling CUDA kernels with parallel build..."
echo "💡 This may take 5-10 minutes depending on GPU availability..."
echo "-------------------------------------------------------------------"
EXT_PARALLEL=4 NVCC_APPEND_FLAGS="--threads 8" MAX_JOBS=32 python setup.py install
echo "-------------------------------------------------------------------"
echo "✅✅✅ SAGEATTENTION2++ BUILD COMPLETE ✅✅✅"
echo "==================================================================="
echo ""

# Clean up build artifacts
cd /
rm -rf /tmp/SageAttention

# Clean up pip/uv cache
echo "🧹 Cleaning up..."
rm -rf /root/.cache/pip
rm -rf /root/.cache/uv
rm -rf /tmp/*

# Mark as initialized
touch /comfyui/.sageattention_initialized

echo "==================================================================="
echo "✅ SageAttention2++ initialization complete!"
echo "==================================================================="


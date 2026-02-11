"""
SavePLY — A minimal ComfyUI OUTPUT_NODE that registers a PLY file in the
job history so the RunPod serverless handler can discover and return it.

Problem solved:
    SharpPredict (ComfyUI-Sharp) writes .ply files to /comfyui/output/ but
    does NOT set OUTPUT_NODE = True, so ComfyUI's history shows 0 outputs.
    By wiring SharpPredict's `ply_path` output into this node, the PLY file
    appears in the history in the same dict-format that the handler already
    knows how to fetch (filename / subfolder / type).

Usage in a workflow JSON:
    "300": {
        "inputs": { "ply_path": ["144", 0] },
        "class_type": "SavePLY",
        "_meta": { "title": "Save PLY File" }
    }
"""

import os

# ComfyUI's default output folder — matches what the /view endpoint serves.
COMFYUI_OUTPUT_FOLDER = os.environ.get(
    "COMFYUI_OUTPUT_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "output"),
)


class SavePLY:
    """Register a .ply file in ComfyUI history so the handler can return it."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "ply_path": (
                    "STRING",
                    {
                        "forceInput": True,
                        "tooltip": "Absolute path to a .ply file (e.g. from SharpPredict)",
                    },
                ),
            },
        }

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "save_ply"
    CATEGORY = "output"

    def save_ply(self, ply_path: str):
        if not ply_path:
            print("[SavePLY] ERROR: No PLY path provided")
            return {"ui": {"ply_files": []}}

        if not os.path.exists(ply_path):
            print(f"[SavePLY] ERROR: PLY file not found: {ply_path}")
            return {"ui": {"ply_files": []}}

        filename = os.path.basename(ply_path)

        # Work out subfolder relative to ComfyUI output directory
        if COMFYUI_OUTPUT_FOLDER and ply_path.startswith(COMFYUI_OUTPUT_FOLDER):
            relative = os.path.relpath(ply_path, COMFYUI_OUTPUT_FOLDER)
            subfolder = os.path.dirname(relative)
        else:
            subfolder = ""

        file_size = os.path.getsize(ply_path)
        file_size_mb = file_size / (1024 * 1024)

        print(f"[SavePLY] Registering PLY file:")
        print(f"  Path:      {ply_path}")
        print(f"  Filename:  {filename}")
        print(f"  Subfolder: {subfolder or '(root)'}")
        print(f"  Size:      {file_size_mb:.2f} MB ({file_size:,} bytes)")

        # Return ui data in the same dict format that handler.py already
        # iterates over for non-image outputs:
        #   { "filename": ..., "subfolder": ..., "type": "output" }
        return {
            "ui": {
                "ply_files": [
                    {
                        "filename": filename,
                        "subfolder": subfolder,
                        "type": "output",
                    }
                ]
            }
        }


NODE_CLASS_MAPPINGS = {
    "SavePLY": SavePLY,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SavePLY": "Save PLY File",
}

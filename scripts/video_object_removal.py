#!/usr/bin/env python3
# video_object_removal.py - Local video object removal with ProPainter and OpenCV fallback
import os
import sys
import argparse
import subprocess
import shutil
import tempfile

def parse_args():
    parser = argparse.ArgumentParser(description="Click AI Video Object Removal")
    parser.add_argument("--video", required=True, help="Path to input video file")
    parser.add_argument("--mask", required=True, help="Path to mask video (or image) file")
    parser.add_argument("--output", required=True, help="Path to output video file")
    parser.add_argument("--radius", type=int, default=3, help="Inpainting radius for OpenCV fallback")
    parser.add_argument("--method", default="telea", choices=["telea", "ns"], help="OpenCV inpainting method")
    return parser.parse_args()

def check_propainter():
    # Check if ProPainter directory exists and has the required script and weights
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    propainter_dir = os.path.join(project_root, "ProPainter")
    inference_script = os.path.join(propainter_dir, "inference_propainter.py")
    weights_path = os.path.join(propainter_dir, "weights")
    
    if os.path.isdir(propainter_dir) and os.path.exists(inference_script) and os.path.isdir(weights_path):
        return inference_script
    return None

def run_propainter(inference_script, video_path, mask_path, output_path):
    print("🚀 ProPainter detected. Running high-fidelity deep learning inpainting...")
    
    # Run the ProPainter inference command
    # python ProPainter/inference_propainter.py --video input.mp4 --mask mask.mp4 --output output.mp4
    cmd = [
        sys.executable,
        inference_script,
        "--video", video_path,
        "--mask", mask_path,
        "--output", output_path,
        "--save_fps", "30"  # standard output FPS
    ]
    
    print(f"Executing: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print("✅ ProPainter completed successfully.")
        return True
    else:
        print(f"❌ ProPainter failed. Stderr: {result.stderr}")
        return False

def run_opencv_fallback(video_path, mask_path, output_path, radius, method_str):
    print("⚠️ ProPainter not found/failed. Running CPU-friendly OpenCV patch inpainting fallback...")
    
    # Try importing cv2 and numpy (installed in our .venv)
    try:
        import cv2
        import numpy as np
    except ImportError:
        print("❌ Error: opencv-python or numpy is not installed in the virtual environment.")
        return False
        
    inpaint_flag = cv2.INPAINT_TELEA if method_str == "telea" else cv2.INPAINT_NS
    
    # Open input video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ Error: Cannot open input video {video_path}")
        return False
        
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Open mask (could be a video or a static image)
    mask_cap = cv2.VideoCapture(mask_path)
    is_mask_video = mask_cap.isOpened()
    static_mask = None
    
    if not is_mask_video or mask_cap.get(cv2.CAP_PROP_FRAME_COUNT) <= 1:
        # Try reading as static image
        static_mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        if static_mask is not None:
            # Resize static mask to match video dimensions if needed
            if static_mask.shape[1] != width or static_mask.shape[0] != height:
                static_mask = cv2.resize(static_mask, (width, height), interpolation=cv2.INTER_NEAREST)
            # Threshold to binary
            _, static_mask = cv2.threshold(static_mask, 127, 255, cv2.THRESH_BINARY)
            print("ℹ️ Using static image mask for inpainting.")
        else:
            print(f"❌ Error: Cannot open mask image or video {mask_path}")
            cap.release()
            if is_mask_video:
                mask_cap.release()
            return False
    else:
        print("ℹ️ Using dynamic video mask for inpainting.")

    # Create temporary directory for processed frames
    temp_dir = tempfile.mkdtemp()
    frame_pattern = os.path.join(temp_dir, "frame_%06d.png")
    
    frame_idx = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            # Get mask for current frame
            if static_mask is not None:
                mask = static_mask
            else:
                m_ret, mask_frame = mask_cap.read()
                if m_ret:
                    # Convert to grayscale
                    mask = cv2.cvtColor(mask_frame, cv2.COLOR_BGR2GRAY)
                    # Resize if needed
                    if mask.shape[1] != width or mask.shape[0] != height:
                        mask = cv2.resize(mask, (width, height), interpolation=cv2.INTER_NEAREST)
                    # Threshold
                    _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
                else:
                    # Fallback if mask video is shorter: use a blank mask (no change)
                    mask = np.zeros((height, width), dtype=np.uint8)
            
            # Perform inpainting
            inpainted = cv2.inpaint(frame, mask, radius, inpaint_flag)
            
            # Save frame
            out_frame_path = frame_pattern % frame_idx
            cv2.imwrite(out_frame_path, inpainted)
            frame_idx += 1
            
            if frame_idx % 30 == 0 or frame_idx == total_frames:
                print(f"Progress: {frame_idx}/{total_frames} frames processed...")
                
        cap.release()
        if is_mask_video:
            mask_cap.release()
            
        print(f"Finished processing {frame_idx} frames. Compiling output video using FFmpeg...")
        
        # Use FFmpeg to assemble the frame sequence back to mp4
        temp_video_only = os.path.join(temp_dir, "video_only.mp4")
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-framerate", str(fps),
            "-i", os.path.join(temp_dir, "frame_%06d.png"),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-crf", "18",
            temp_video_only
        ]
        subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Combine video with original audio (if any)
        combine_cmd = [
            "ffmpeg", "-y",
            "-i", temp_video_only,
            "-i", video_path,
            "-map", "0:v",
            "-map", "1:a?",  # optional audio mapping (won't fail if no audio)
            "-c:v", "copy",
            "-c:a", "aac",
            "-shortest",
            output_path
        ]
        subprocess.run(combine_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"✅ Video compiled successfully: {output_path}")
        return True
        
    except Exception as e:
        print(f"❌ Error during OpenCV processing: {e}")
        return False
    finally:
        # Clean up frames
        shutil.rmtree(temp_dir, ignore_errors=True)

def main():
    args = parse_args()
    
    # 1. Try running ProPainter first
    propainter_script = check_propainter()
    if propainter_script:
        success = run_propainter(propainter_script, args.video, args.mask, args.output)
        if success:
            sys.exit(0)
            
    # 2. Fallback to OpenCV
    success = run_opencv_fallback(args.video, args.mask, args.output, args.radius, args.method)
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()

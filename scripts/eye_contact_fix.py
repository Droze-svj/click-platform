#!/usr/bin/env python3
# eye_contact_fix.py - Gaze correction with local model execution and OpenCV face-focus crop fallback
import os
import sys
import argparse
import subprocess
import shutil
import tempfile

def parse_args():
    parser = argparse.ArgumentParser(description="Click AI Eye-Contact Fix")
    parser.add_argument("--video", required=True, help="Path to input video file")
    parser.add_argument("--output", required=True, help="Path to output video file")
    return parser.parse_args()

def check_nvidia_maxine():
    # Check if NVIDIA Maxine eye contact SDK binaries are present
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    maxine_bin = os.path.join(project_root, "maxine_eye_contact")
    if os.path.exists(maxine_bin) and os.access(maxine_bin, os.X_OK):
        return maxine_bin
    return None

def run_maxine(maxine_bin, video_path, output_path):
    print("🚀 NVIDIA Maxine SDK detected. Running high-fidelity gaze redirection...")
    cmd = [maxine_bin, "-i", video_path, "-o", output_path]
    print(f"Executing: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print("✅ Gaze redirection completed successfully.")
        return True
    print(f"❌ NVIDIA Maxine failed: {result.stderr}")
    return False

def run_opencv_fallback(video_path, output_path):
    print("⚠️ Gaze correction models not found. Running OpenCV face-stabilized focus fallback...")
    
    try:
        import cv2
        import numpy as np
    except ImportError:
        print("❌ OpenCV is not installed. Running direct FFmpeg copy fallback...")
        return run_ffmpeg_copy(video_path, output_path)

    # Open video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ Error: Cannot open input video {video_path}")
        return False
        
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Load face cascade
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    face_cascade = cv2.CascadeClassifier(cascade_path)
    
    if face_cascade.empty():
        print("⚠️ Face detection XML not loaded. Running direct FFmpeg zoom fallback...")
        cap.release()
        return run_ffmpeg_zoom(video_path, output_path)

    temp_dir = tempfile.mkdtemp()
    frame_pattern = os.path.join(temp_dir, "frame_%06d.png")
    
    last_x, last_y, last_w, last_h = 0, 0, width, height
    face_detected_any = False
    
    frame_idx = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5, minSize=(100, 100))
            
            if len(faces) > 0:
                # Get the largest face
                faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
                x, y, w, h = faces[0]
                face_detected_any = True
                
                # Smooth face boxes to avoid shaking
                if frame_idx == 0:
                    last_x, last_y, last_w, last_h = x, y, w, h
                else:
                    alpha = 0.15 # inertia
                    last_x = int(alpha * x + (1 - alpha) * last_x)
                    last_y = int(alpha * y + (1 - alpha) * last_y)
                    last_w = int(alpha * w + (1 - alpha) * last_w)
                    last_h = int(alpha * h + (1 - alpha) * last_h)
            
            # Apply focused zoom targeting the face area
            if face_detected_any:
                # Crop slightly wider than the face box, keeping it centered
                pad_w = int(last_w * 0.4)
                pad_h = int(last_h * 0.4)
                
                crop_x = max(0, last_x - pad_w)
                crop_y = max(0, last_y - pad_h)
                crop_w = min(width - crop_x, last_w + 2 * pad_w)
                crop_h = min(height - crop_y, last_h + 2 * pad_h)
                
                # We crop and scale back to original size (subtle zoom focus)
                cropped = frame[crop_y:crop_y+crop_h, crop_x:crop_x+crop_w]
                processed_frame = cv2.resize(cropped, (width, height), interpolation=cv2.INTER_LINEAR)
            else:
                # No face found, use original frame
                processed_frame = frame
                
            out_frame_path = frame_pattern % frame_idx
            cv2.imwrite(out_frame_path, processed_frame)
            frame_idx += 1
            
        cap.release()
        
        # Compile frames back using FFmpeg
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
            "-map", "1:a?",
            "-c:v", "copy",
            "-c:a", "aac",
            "-shortest",
            output_path
        ]
        subprocess.run(combine_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"✅ Gaze focus video compiled: {output_path}")
        return True
        
    except Exception as e:
        print(f"❌ Error during face-focus fallback: {e}")
        return run_ffmpeg_zoom(video_path, output_path)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def run_ffmpeg_copy(video_path, output_path):
    print("ℹ️ Copying video without changes (direct fallback)...")
    cmd = ["ffmpeg", "-y", "-i", video_path, "-c", "copy", output_path]
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.returncode == 0

def run_ffmpeg_zoom(video_path, output_path):
    print("ℹ️ Running central 1.1x crop-zoom via FFmpeg...")
    # crop=in_w/1.1:in_h/1.1,scale=in_w:in_h (mimics subtle focus shift)
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", "crop=iw/1.1:ih/1.1,scale=iw:ih",
        "-c:a", "copy",
        output_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.returncode == 0

def main():
    args = parse_args()
    
    # 1. Try running Maxine gaze correction first
    maxine_bin = check_nvidia_maxine()
    if maxine_bin:
        success = run_maxine(maxine_bin, args.video, args.output)
        if success:
            sys.exit(0)
            
    # 2. Fallback to OpenCV crop stabilizer
    success = run_opencv_fallback(args.video, args.output)
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()

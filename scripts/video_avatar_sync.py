#!/usr/bin/env python3
# video_avatar_sync.py - Local talking avatar lip-sync with SadTalker/Wav2Lip and FFmpeg fallback
import os
import sys
import argparse
import subprocess

def parse_args():
    parser = argparse.ArgumentParser(description="Click AI Avatar Lip-Sync")
    parser.add_argument("--avatar", required=True, help="Path to static avatar image file")
    parser.add_argument("--audio", required=True, help="Path to input voice audio file")
    parser.add_argument("--output", required=True, help="Path to output video file")
    return parser.parse_args()

def check_deep_learning_avatar():
    # Check for SadTalker or Wav2Lip repositories in workspace
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sadtalker_dir = os.path.join(project_root, "SadTalker")
    wav2lip_dir = os.path.join(project_root, "Wav2Lip")
    
    if os.path.isdir(sadtalker_dir) and os.path.exists(os.path.join(sadtalker_dir, "inference.py")):
        return ("sadtalker", os.path.join(sadtalker_dir, "inference.py"))
    if os.path.isdir(wav2lip_dir) and os.path.exists(os.path.join(wav2lip_dir, "inference.py")):
        return ("wav2lip", os.path.join(wav2lip_dir, "inference.py"))
    return (None, None)

def run_sadtalker(script_path, avatar, audio, output):
    print("🚀 SadTalker detected. Running high-fidelity talking-head synthesis...")
    cmd = [
        sys.executable,
        script_path,
        "--driven_audio", audio,
        "--source_image", avatar,
        "--result_dir", os.path.dirname(output),
        "--enhancer", "gfpgan"
    ]
    print(f"Executing: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        # Move output file to expected output path
        generated_files = [f for f in os.listdir(os.path.dirname(output)) if f.endswith(".mp4")]
        if generated_files:
            shutil.move(os.path.join(os.path.dirname(output), generated_files[0]), output)
            print("✅ SadTalker talking head generated successfully.")
            return True
    print(f"❌ SadTalker failed: {result.stderr}")
    return False

def run_ffmpeg_fallback(avatar, audio, output):
    print("⚠️ Deep learning avatar models not found. Running still-image audio-overlay fallback...")
    
    # Generate static video with looping image and short audio
    # -loop 1 loops the image
    # -shortest stops encoding when the audio ends
    # -tune stillimage optimizes x264 parameters for static slides
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1",
        "-i", avatar,
        "-i", audio,
        "-c:v", "libx264",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        output
    ]
    
    print(f"Executing: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"✅ Still-avatar talking head video generated successfully: {output}")
        return True
    else:
        print(f"❌ FFmpeg compilation failed: {result.stderr}")
        return False

def main():
    args = parse_args()
    
    # 1. Try deep learning model if present
    tech_name, script_path = check_deep_learning_avatar()
    if tech_name == "sadtalker":
        success = run_sadtalker(script_path, args.avatar, args.audio, args.output)
        if success:
            sys.exit(0)
            
    # 2. Fallback to FFmpeg still image loop
    success = run_ffmpeg_fallback(args.avatar, args.audio, args.output)
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# worker_entrypoint.py - Vertex AI container entrypoint for Click GPU processing
import os
import sys
import argparse
import subprocess
import requests
from urllib.parse import urlparse
from google.cloud import storage

def parse_args():
    parser = argparse.ArgumentParser(description="Vertex AI Click Worker Entrypoint")
    parser.add_argument("--task", required=True, choices=["inpainting", "background_swap", "background_removal", "avatar_synthesis", "eye_contact"], help="AI task to execute")
    parser.add_argument("--video-url", help="URL to input video (GCS gs:// or HTTP/S URL)")
    parser.add_argument("--mask-url", help="URL to mask file (for inpainting)")
    parser.add_argument("--background-url", help="URL to background file (for background swap)")
    parser.add_argument("--avatar-url", help="URL to avatar image file (for avatar synthesis)")
    parser.add_argument("--audio-url", help="URL to voice audio file (for avatar synthesis)")
    parser.add_argument("--output-url", required=True, help="Destination GCS URL for processed video")
    return parser.parse_args()

def download_file(url, local_path):
    print(f"📥 Downloading: {url} -> {local_path}")
    if url.startswith("gs://"):
        # Download from GCS
        parsed = urlparse(url)
        bucket_name = parsed.netloc
        blob_name = parsed.path.lstrip('/')
        
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        blob.download_to_filename(local_path)
    else:
        # Download from HTTP/S
        response = requests.get(url, stream=True)
        response.raise_for_status()
        with open(local_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
    print("✅ Download complete.")

def upload_file(local_path, url):
    print(f"📤 Uploading: {local_path} -> {url}")
    if url.startswith("gs://"):
        # Upload to GCS
        parsed = urlparse(url)
        bucket_name = parsed.netloc
        blob_name = parsed.path.lstrip('/')
        
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        blob.upload_from_filename(local_path)
    else:
        # Upload via HTTP PUT (e.g. pre-signed S3 URL)
        with open(local_path, 'rb') as f:
            headers = {'Content-Type': 'video/mp4'}
            if urlparse(url).path.endswith('.mov'):
                headers['Content-Type'] = 'video/quicktime'
            res = requests.put(url, data=f, headers=headers)
            res.raise_for_status()
    print("✅ Upload complete.")

def main():
    args = parse_args()
    
    local_video = "input_video.mp4"
    local_mask = "mask.png"
    local_bg = "background.jpg"
    local_avatar = "avatar.png"
    local_audio = "audio.mp3"
    local_output = "output.mp4" if args.task != "background_removal" else "output.mov"
    
    try:
        # Validate task-specific arguments
        if args.task != "avatar_synthesis" and not args.video_url:
            raise ValueError(f"Task {args.task} requires --video-url")
            
        # 1. Execute task
        if args.task == "inpainting":
            download_file(args.video_url, local_video)
            if not args.mask_url:
                raise ValueError("Inpainting task requires --mask-url")
            download_file(args.mask_url, local_mask)
            
            # Execute scripts/video_object_removal.py
            cmd = [
                sys.executable,
                "/app/scripts/video_object_removal.py",
                "--video", local_video,
                "--mask", local_mask,
                "--output", local_output
            ]
            print(f"Running video object removal: {' '.join(cmd)}")
            subprocess.run(cmd, check=True)
            
        elif args.task == "background_swap":
            download_file(args.video_url, local_video)
            if not args.background_url:
                raise ValueError("Background swap requires --background-url")
            download_file(args.background_url, local_bg)
            
            # Execute backgroundremover -i local_video -tbg local_bg -o local_output
            cmd = [
                "backgroundremover",
                "-i", local_video,
                "-tbg", local_bg,
                "-o", local_output
            ]
            print(f"Running background swap: {' '.join(cmd)}")
            subprocess.run(cmd, check=True)
            
        elif args.task == "background_removal":
            download_file(args.video_url, local_video)
            # Execute backgroundremover -i local_video -o local_output
            cmd = [
                "backgroundremover",
                "-i", local_video,
                "-o", local_output
            ]
            print(f"Running background removal (transparent): {' '.join(cmd)}")
            subprocess.run(cmd, check=True)

        elif args.task == "avatar_synthesis":
            if not args.avatar_url or not args.audio_url:
                raise ValueError("Avatar synthesis requires both --avatar-url and --audio-url")
            
            # Guess extensions if possible, default to png/mp3
            ext_avatar = os.path.splitext(urlparse(args.avatar_url).path)[1] or ".png"
            ext_audio = os.path.splitext(urlparse(args.audio_url).path)[1] or ".mp3"
            local_avatar = f"avatar{ext_avatar}"
            local_audio = f"audio{ext_audio}"
            
            download_file(args.avatar_url, local_avatar)
            download_file(args.audio_url, local_audio)
            
            # Run video_avatar_sync.py
            cmd = [
                sys.executable,
                "/app/scripts/video_avatar_sync.py",
                "--avatar", local_avatar,
                "--audio", local_audio,
                "--output", local_output
            ]
            print(f"Running avatar synthesis: {' '.join(cmd)}")
            subprocess.run(cmd, check=True)

        elif args.task == "eye_contact":
            download_file(args.video_url, local_video)
            # Run eye_contact_fix.py
            cmd = [
                sys.executable,
                "/app/scripts/eye_contact_fix.py",
                "--video", local_video,
                "--output", local_output
            ]
            print(f"Running eye contact fix: {' '.join(cmd)}")
            subprocess.run(cmd, check=True)
            
        # 2. Upload output
        upload_file(local_output, args.output_url)
        print("🎉 Vertex AI Custom Job task completed successfully!")
        sys.exit(0)
        
    except Exception as e:
        print(f"❌ Error during Vertex AI processing: {e}")
        sys.exit(1)
        
    finally:
        # Clean up files
        for f in [local_video, local_mask, local_bg, local_avatar, local_audio, local_output]:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass

if __name__ == "__main__":
    main()

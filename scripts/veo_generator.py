#!/usr/bin/env python3
"""
VocalIA - Google Veo 3.1 Video Generation Bridge
Vertex AI API integration for text-to-video generation.

Auth: Google Cloud Application Default Credentials (ADC)
API: Vertex AI generateVideos endpoint (LRO pattern)

Usage:
  python3 veo_generator.py --generate --prompt "..." [options]
  python3 veo_generator.py --status <operation_name>
  python3 veo_generator.py --download <gcs_uri> --output <path>
"""

import os
import sys
import json
import argparse
import time
from dotenv import load_dotenv

load_dotenv()

# Attempt to import google-auth; provide clear error if missing
try:
    from google.auth import default as google_auth_default
    from google.auth.transport.requests import Request as GoogleAuthRequest
except ImportError:
    print("FATAL: google-auth package not installed.", file=sys.stderr)
    print("Install via: pip3 install google-auth google-auth-httplib2", file=sys.stderr)
    sys.exit(1)

try:
    import requests
except ImportError:
    print("FATAL: requests package not installed.", file=sys.stderr)
    sys.exit(1)

# Optional: google-cloud-storage for GCS downloads
try:
    from google.cloud import storage as gcs_storage
    HAS_GCS = True
except ImportError:
    HAS_GCS = False


class VeoGenerator:
    """Vertex AI Veo 3.1 text-to-video generation client."""

    # Vertex AI model endpoint for Veo 3.1
    MODEL_ID = "veo-3.1-generate-preview"

    def __init__(self):
        self.project = os.getenv("GOOGLE_CLOUD_PROJECT")
        self.region = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")

        if not self.project:
            raise ValueError("CRITICAL: GOOGLE_CLOUD_PROJECT not set in .env")

        # Get ADC credentials
        self.credentials, _ = google_auth_default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )

        self.base_url = (
            f"https://{self.region}-aiplatform.googleapis.com/v1/"
            f"projects/{self.project}/locations/{self.region}"
        )

    def _get_auth_header(self):
        """Refresh and return Authorization header using ADC."""
        self.credentials.refresh(GoogleAuthRequest())
        return {
            "Authorization": f"Bearer {self.credentials.token}",
            "Content-Type": "application/json"
        }

    def generate_video(self, prompt, aspect_ratio="16:9", resolution="1080p",
                       duration=8, generate_audio=True, negative_prompt=""):
        """
        Submit a text-to-video generation request to Vertex AI.
        Returns: operation name (LRO identifier) or None on failure.

        Vertex AI endpoint:
        POST .../publishers/google/models/veo-3.1:generateVideos
        """
        url = (
            f"{self.base_url}/publishers/google/models/"
            f"{self.MODEL_ID}:generateVideos"
        )

        # Build the request body per Vertex AI Veo API spec
        request_body = {
            "instances": [
                {
                    "prompt": prompt
                }
            ],
            "parameters": {
                "aspectRatio": aspect_ratio,
                "sampleCount": 1,
                "durationSeconds": duration,
                "personGeneration": "allow_all",
                "generateAudio": generate_audio
            }
        }

        # Add negative prompt if provided
        if negative_prompt:
            request_body["instances"][0]["negativePrompt"] = negative_prompt

        # Resolution mapping: Veo API uses specific output config
        if resolution == "4k":
            request_body["parameters"]["outputConfig"] = {"resolution": "4k"}
        elif resolution == "1080p":
            request_body["parameters"]["outputConfig"] = {"resolution": "1080p"}
        elif resolution == "720p":
            request_body["parameters"]["outputConfig"] = {"resolution": "720p"}

        headers = self._get_auth_header()

        print(f"[Veo3.1] Submitting generation request...", file=sys.stderr)
        print(f"[Veo3.1] Prompt: {prompt[:100]}...", file=sys.stderr)
        print(f"[Veo3.1] Config: {aspect_ratio}, {resolution}, {duration}s, audio={generate_audio}", file=sys.stderr)

        try:
            response = requests.post(url, headers=headers, json=request_body, timeout=60)
            print(f"[Veo3.1-Debug] Status: {response.status_code}", file=sys.stderr)

            if response.status_code == 200:
                data = response.json()
                # Vertex AI returns an LRO name
                operation_name = data.get("name", "")
                if operation_name:
                    print(f"OPERATION: {operation_name}")
                    return operation_name
                else:
                    print(f"[Veo3.1-Error] No operation name in response: {json.dumps(data)[:500]}", file=sys.stderr)
                    return None
            else:
                print(f"[Veo3.1-Error] HTTP {response.status_code}: {response.text[:500]}", file=sys.stderr)
                return None

        except requests.exceptions.Timeout:
            print("[Veo3.1-Error] Request timed out after 60s", file=sys.stderr)
            return None
        except Exception as e:
            print(f"[Veo3.1-Error] {str(e)}", file=sys.stderr)
            return None

    def check_status(self, operation_name):
        """
        Poll the status of a long-running operation.
        Output: JSON with { done, videoUri?, error? }
        """
        url = f"https://{self.region}-aiplatform.googleapis.com/v1/{operation_name}"
        headers = self._get_auth_header()

        try:
            response = requests.get(url, headers=headers, timeout=30)

            if response.status_code != 200:
                print(json.dumps({"done": False, "error": f"HTTP {response.status_code}"}))
                return

            data = response.json()
            done = data.get("done", False)

            if done:
                # Check for error
                error = data.get("error")
                if error:
                    print(json.dumps({
                        "done": True,
                        "error": error.get("message", str(error))
                    }))
                    return

                # Extract video URI from response
                response_data = data.get("response", {})
                videos = response_data.get("generatedVideos", [])

                if videos and len(videos) > 0:
                    video_uri = videos[0].get("video", {}).get("uri", "")
                    print(json.dumps({
                        "done": True,
                        "videoUri": video_uri
                    }))
                else:
                    print(json.dumps({
                        "done": True,
                        "error": "No videos in completed response"
                    }))
            else:
                # Still processing
                metadata = data.get("metadata", {})
                progress = metadata.get("percentComplete", 0)
                print(json.dumps({
                    "done": False,
                    "progress": progress
                }))

        except Exception as e:
            print(json.dumps({"done": False, "error": str(e)}))

    def download_video(self, gcs_uri, output_path):
        """
        Download a video from a GCS URI to a local file.
        Handles both gs:// URIs and HTTPS signed URLs.
        """
        if gcs_uri.startswith("gs://"):
            if not HAS_GCS:
                print("[Veo3.1-Error] google-cloud-storage not installed for gs:// download", file=sys.stderr)
                print("Install via: pip3 install google-cloud-storage", file=sys.stderr)
                sys.exit(1)

            # Parse gs://bucket/path
            parts = gcs_uri.replace("gs://", "").split("/", 1)
            bucket_name = parts[0]
            blob_name = parts[1] if len(parts) > 1 else ""

            client = gcs_storage.Client()
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(blob_name)
            blob.download_to_filename(output_path)
            print(f"[Veo3.1] Downloaded to {output_path}", file=sys.stderr)

        elif gcs_uri.startswith("http"):
            # Direct HTTPS download (signed URL)
            headers = self._get_auth_header()
            response = requests.get(gcs_uri, headers=headers, stream=True, timeout=300)

            if response.status_code == 200:
                with open(output_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                print(f"[Veo3.1] Downloaded to {output_path}", file=sys.stderr)
            else:
                print(f"[Veo3.1-Error] Download failed: HTTP {response.status_code}", file=sys.stderr)
                sys.exit(1)
        else:
            print(f"[Veo3.1-Error] Unsupported URI format: {gcs_uri}", file=sys.stderr)
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="VocalIA - Veo 3.1 Video Generation Bridge (Vertex AI)"
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--generate", action="store_true",
                       help="Generate a new video from prompt")
    group.add_argument("--status", type=str, metavar="OPERATION_NAME",
                       help="Check status of a long-running operation")
    group.add_argument("--download", type=str, metavar="GCS_URI",
                       help="Download a generated video from GCS")

    # Generation options
    parser.add_argument("--prompt", type=str, help="Video generation prompt")
    parser.add_argument("--aspect-ratio", type=str, default="16:9",
                        choices=["16:9", "9:16"],
                        help="Video aspect ratio (default: 16:9)")
    parser.add_argument("--resolution", type=str, default="1080p",
                        choices=["720p", "1080p", "4k"],
                        help="Output resolution (default: 1080p)")
    parser.add_argument("--duration", type=int, default=8,
                        choices=[4, 6, 8],
                        help="Video duration in seconds (default: 8)")
    parser.add_argument("--no-audio", action="store_true",
                        help="Disable native audio generation (audio enabled by default)")
    parser.add_argument("--negative-prompt", type=str, default="",
                        help="Elements to exclude from generation")

    # Download options
    parser.add_argument("--output", type=str,
                        help="Output file path for download")

    args = parser.parse_args()

    try:
        veo = VeoGenerator()

        if args.generate:
            if not args.prompt:
                print("ERROR: --prompt is required for generation", file=sys.stderr)
                sys.exit(1)

            generate_audio = not args.no_audio
            operation = veo.generate_video(
                prompt=args.prompt,
                aspect_ratio=args.aspect_ratio,
                resolution=args.resolution,
                duration=args.duration,
                generate_audio=generate_audio,
                negative_prompt=args.negative_prompt
            )

            if not operation:
                print("ERROR: Generation request failed", file=sys.stderr)
                sys.exit(1)

        elif args.status:
            veo.check_status(args.status)

        elif args.download:
            if not args.output:
                print("ERROR: --output is required for download", file=sys.stderr)
                sys.exit(1)
            veo.download_video(args.download, args.output)

    except ValueError as e:
        print(f"CONFIG ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"FATAL: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

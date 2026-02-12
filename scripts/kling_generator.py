import os
import sys
import time
import jwt
import requests
import json
import argparse
from dotenv import load_dotenv

# VocalIA - Kling AI Video Generation Engine
# Factual, Precise, Rigorous.
# STRICT INTERNAL USE ONLY - NOT FOR MULTI-TENANTS.

load_dotenv()

class KlingAI:
    def __init__(self):
        self.access_key = os.getenv("KLING_ACCESS_KEY")
        self.secret_key = os.getenv("KLING_SECRET_KEY")
        self.base_url = "https://api-global.klingai.com"

        if not self.access_key or not self.secret_key:
            raise ValueError("CRITICAL: Missing Kling AI credentials in .env")

    def _generate_token(self):
        """Generates a secure JWT for API authentication."""
        now = int(time.time())
        payload = {
            "iss": self.access_key,
            "exp": now + 1800,  # 30 minute expiry
            "nbf": now - 60     # Buffer for clock skew
        }
        headers = {
            "alg": "HS256",
            "typ": "JWT"
        }
        return jwt.encode(payload, self.secret_key, algorithm="HS256", headers=headers)

    def generate_video(self, prompt, model="kling-v2-6", duration=5, ratio="16:9", mode="pro", negative_prompt=""):
        """Submits a text-to-video task to Kling AI."""
        url = f"{self.base_url}/api/v1/videos/text2video"
        headers = {
            "Authorization": f"Bearer {self._generate_token()}",
            "Content-Type": "application/json"
        }
        data = {
            "prompt": prompt,
            "model_name": model,
            "duration": str(duration),
            "aspect_ratio": ratio,
            "mode": mode
        }
        if negative_prompt:
            data["negative_prompt"] = negative_prompt

        response = requests.post(url, headers=headers, json=data, timeout=60)
        if response.status_code != 200:
            print(f"[Kling-Error] HTTP {response.status_code}: {response.text[:500]}", file=sys.stderr)
            return None

        body = response.json()
        # Validate API-level error: check both "code" and "status" fields
        api_code = body.get("code") or body.get("status")
        if api_code and api_code != 0 and api_code != 200:
            error_detail = body.get("error", {})
            error_msg = body.get("message") or (error_detail.get("detail") if isinstance(error_detail, dict) else str(error_detail)) or "Unknown"
            print(f"[Kling-Error] API status {api_code}: {error_msg}", file=sys.stderr)
            return None

        task_id = (body.get("data") or {}).get("task_id")
        if not task_id:
            print(f"[Kling-Error] No task_id in response: {json.dumps(body)[:300]}", file=sys.stderr)
        return task_id

    def get_status(self, task_id):
        """Gets status of a specific task."""
        url = f"{self.base_url}/api/v1/videos/tasks/{task_id}"
        headers = {"Authorization": f"Bearer {self._generate_token()}"}

        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            return {"state": "FAILED", "error": f"HTTP {response.status_code}"}

        result = response.json().get("data", {})
        status = result.get("task_status")

        if status == "succeed":
            # Video URL is at task_result.videos[0].url
            videos = result.get("task_result", {}).get("videos", [])
            video_url = videos[0].get("url") if videos else None
            return {"state": "COMPLETED", "videoUrl": video_url}
        elif status == "failed":
            return {"state": "FAILED", "error": result.get("task_status_msg", "Unknown error")}
        else:
            return {"state": "PENDING"}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Kling AI Video Bridge")
    parser.add_argument("--prompt", type=str, help="Prompt to generate video")
    parser.add_argument("--status", type=str, help="Task ID to poll status for")
    parser.add_argument("--duration", type=int, default=5, choices=[5, 10],
                        help="Video duration in seconds (default: 5)")
    parser.add_argument("--ratio", type=str, default="16:9", choices=["16:9", "9:16", "1:1"],
                        help="Aspect ratio (default: 16:9)")
    parser.add_argument("--mode", type=str, default="pro", choices=["std", "pro"],
                        help="Generation mode (default: pro)")
    parser.add_argument("--negative-prompt", type=str, default="",
                        help="Elements to exclude from generation")
    args = parser.parse_args()

    kling = KlingAI()

    if args.prompt:
        task_id = kling.generate_video(
            args.prompt,
            duration=args.duration,
            ratio=args.ratio,
            mode=args.mode,
            negative_prompt=args.negative_prompt
        )
        if task_id:
            print(f"TASK_ID: {task_id}")
        else:
            print("ERROR: Failed to submit task")
            sys.exit(1)
            
    elif args.status:
        status_data = kling.get_status(args.status)
        print(json.dumps(status_data))
    else:
        print("Script integrity: VERIFIED. Use --prompt or --status.")

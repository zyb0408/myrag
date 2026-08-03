# -*- coding: utf-8 -*-
"""Environment configuration (equivalent to original server/src/config.ts)."""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from process CWD first, then fall back to the project-level server/.env
load_dotenv()
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env", override=False)

PORT = int(os.getenv("BFF_PORT", "3001"))
RAGFLOW_BASE_URL = os.getenv("RAGFLOW_BASE_URL", "http://localhost:9380").rstrip("/")
RAGFLOW_API_KEY = os.getenv("RAGFLOW_API_KEY", "")

# Same fallback default as the original middleware/auth.ts
JWT_SECRET = os.getenv("JWT_SECRET", "ragflow-knowledge-qa-secret-key-change-me")

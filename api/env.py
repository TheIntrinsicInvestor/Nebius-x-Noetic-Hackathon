"""API keys. The repo lives in a OneDrive-synced folder, so keys are kept outside it at
~/.secrets/headroom.env; without that file, a .env in the repo root is used as the README describes."""
from pathlib import Path

from dotenv import load_dotenv

OUTSIDE_REPO = Path.home() / ".secrets" / "headroom.env"


def load_env() -> None:
    load_dotenv(OUTSIDE_REPO if OUTSIDE_REPO.exists() else None)

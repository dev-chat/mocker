#!/usr/bin/env bash
set -euo pipefail

if [[ -f /home/muzzle.lol/.bash_profile ]]; then
	. /home/muzzle.lol/.bash_profile
fi

export PATH="/usr/local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[$(date -Iseconds)] Starting health-job"
pipenv run python ./job.py
echo "[$(date -Iseconds)] Completed health-job"


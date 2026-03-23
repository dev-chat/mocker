#!/usr/bin/env bash

set -euo pipefail

PATH=/usr/local/bin:/usr/bin:/bin:${PATH:-}

SCRIPT_NAME="health-job"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

log() {
	local level="$1"
	shift
	local fd=1
	[[ "${level}" == "WARN" || "${level}" == "ERROR" ]] && fd=2
	printf '%s [%s] [%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "${SCRIPT_NAME}" "${level}" "$*" >&"${fd}"
}

load_env() {
	local env_file
	local -a candidates=(
		"${JOB_ENV_FILE:-}"
		"${SCRIPT_DIR}/.env"
		"${HOME:-}/.bash_profile"
		"${HOME:-}/.profile"
		"/home/muzzle.lol/.bash_profile"
	)

	for env_file in "${candidates[@]}"; do
		[[ -n "${env_file}" ]] || continue
		if [[ -f "${env_file}" ]]; then
			# shellcheck disable=SC1090
			. "${env_file}"
			log INFO "Loaded environment from ${env_file}"
			return 0
		fi
	done

	log INFO 'No environment profile loaded; relying on cron-provided environment variables'
}

handle_exit() {
	local exit_code="$1"

	if [[ "${exit_code}" -eq 0 ]]; then
		log INFO 'Job completed successfully'
	else
		log ERROR "Job failed with exit code ${exit_code}"
	fi
}

trap 'handle_exit "$?"' EXIT

load_env

require_command() {
	local command_name="$1"

	if ! command -v "${command_name}" >/dev/null 2>&1; then
		log ERROR "Missing required command: ${command_name}" >&2
		exit 1
	fi
}

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
SLACK_CHANNEL="${SLACK_CHANNEL:-#muzzlefeedback}"
SLACK_MESSAGE=':this-is-fine: `Moonbeam is experiencing some technical difficulties at the moment.` :this-is-fine:'
MAX_ATTEMPTS="${MAX_ATTEMPTS:-5}"
SLEEP_SECONDS="${SLEEP_SECONDS:-1}"
CONNECT_TIMEOUT="${CONNECT_TIMEOUT:-5}"
MAX_TIME="${MAX_TIME:-15}"

send_slack_message() {
	if [[ -z "${MUZZLE_BOT_TOKEN:-}" ]]; then
		log ERROR 'MUZZLE_BOT_TOKEN is not set; unable to send Slack alert' >&2
		return 1
	fi

	local response_code
	local response_body

	response_body=$(mktemp)

	response_code=$(curl \
		--silent \
		--show-error \
		--output "${response_body}" \
		--write-out '%{http_code}' \
		--request POST \
		--header "Authorization: Bearer ${MUZZLE_BOT_TOKEN}" \
		--header 'Content-Type: application/x-www-form-urlencoded' \
		--data-urlencode "channel=${SLACK_CHANNEL}" \
		--data-urlencode "text=${SLACK_MESSAGE}" \
		https://slack.com/api/chat.postMessage || true)

	if [[ -z "${response_code:-}" ]]; then
		log ERROR 'Slack API request failed: curl did not complete successfully' >&2
		rm -f "${response_body}"
		return 1
	fi
	if [[ "${response_code}" != "200" ]]; then
		log ERROR "Slack API request failed with HTTP ${response_code}: $(cat "${response_body}")" >&2
		rm -f "${response_body}"
		return 1
	fi

	if ! grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "${response_body}"; then
		log ERROR "Slack API request failed: $(cat "${response_body}")" >&2
		rm -f "${response_body}"
		return 1
	fi

	log INFO "Posted Slack alert to ${SLACK_CHANNEL}"
	rm -f "${response_body}"
}

check_health() {
	local attempt=1
	local response_code
	local response_body

	while (( attempt <= MAX_ATTEMPTS )); do
		response_body=$(mktemp)
		response_code=$(curl \
			--silent \
			--show-error \
			--output "${response_body}" \
			--write-out '%{http_code}' \
			--connect-timeout "${CONNECT_TIMEOUT}" \
			--max-time "${MAX_TIME}" \
			"${HEALTH_URL}" || true)

		log INFO "Health check attempt ${attempt}/${MAX_ATTEMPTS}: HTTP ${response_code:-curl-error}"

		if [[ "${response_code}" =~ ^2[0-9][0-9]$ ]]; then
			rm -f "${response_body}"
			return 0
		fi

		log WARN "Health check failed on attempt ${attempt}: $(tr '\n' ' ' < "${response_body}")"
		rm -f "${response_body}"

		(( attempt++ ))
		sleep "${SLEEP_SECONDS}"
	done

	return 1
}

main() {
	require_command curl
	require_command grep
	require_command mktemp

	log INFO "Starting health check for ${HEALTH_URL}"
	if check_health; then
		log INFO 'Health check passed'
		exit 0
	fi

	log ERROR 'Health check failed after all retry attempts; sending Slack alert'
	send_slack_message
}

main "$@"


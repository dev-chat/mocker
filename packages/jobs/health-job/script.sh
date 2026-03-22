#!/usr/bin/env bash

set -euo pipefail

if [[ -f /home/muzzle.lol/.bash_profile ]]; then
	# Cron runs with a minimal environment, so load the deployed shell profile when present.
	# shellcheck disable=SC1091
	. /home/muzzle.lol/.bash_profile
fi

PATH=/usr/local/bin:/usr/bin:/bin:${PATH:-}

require_command() {
	local command_name="$1"

	if ! command -v "${command_name}" >/dev/null 2>&1; then
		echo "Missing required command: ${command_name}" >&2
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
		echo "MUZZLE_BOT_TOKEN is not set; unable to send Slack alert" >&2
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
		echo "Slack API request failed: curl did not complete successfully" >&2
		rm -f "${response_body}"
		return 1
	fi
	if [[ "${response_code}" != "200" ]]; then
		echo "Slack API request failed with HTTP ${response_code}" >&2
		rm -f "${response_body}"
		return 1
	fi

	if ! grep -q '"ok":true' "${response_body}"; then
		echo "Slack API request failed: $(cat "${response_body}")" >&2
		rm -f "${response_body}"
		return 1
	fi

	rm -f "${response_body}"
}

check_health() {
	local attempt=1
	local response_code

	while (( attempt <= MAX_ATTEMPTS )); do
		response_code=$(curl \
			--silent \
			--show-error \
			--output /dev/null \
			--write-out '%{http_code}' \
			--connect-timeout "${CONNECT_TIMEOUT}" \
			--max-time "${MAX_TIME}" \
			"${HEALTH_URL}" || true)

		echo "Health check attempt ${attempt}/${MAX_ATTEMPTS}: HTTP ${response_code:-curl-error}"

		if [[ "${response_code}" =~ ^2[0-9][0-9]$ ]]; then
			return 0
		fi

		(( attempt++ ))
		sleep "${SLEEP_SECONDS}"
	done

	return 1
}

main() {
	require_command curl
	require_command grep
	require_command mktemp

	if check_health; then
		echo 'Health check passed.'
		exit 0
	fi

	send_slack_message
}

main "$@"


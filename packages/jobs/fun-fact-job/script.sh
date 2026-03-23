#!/usr/bin/env bash

set -euo pipefail

PATH=/usr/local/bin:/usr/bin:/bin:${PATH:-}

SCRIPT_NAME="fun-fact-job"
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
			# Temporarily relax errexit/nounset while sourcing potentially interactive profiles.
			set +e +u
			# shellcheck disable=SC1090
			. "${env_file}"
			local source_status=$?
			# Restore strict mode for the rest of the script.
			set -euo pipefail
			if [[ "${source_status}" -ne 0 ]]; then
				# Many profile scripts may return non-zero even when sourcing succeeded.
				# Treat non-zero as a hard failure only for the job-owned env file.
				if [[ -n "${JOB_ENV_FILE:-}" && "${env_file}" == "${JOB_ENV_FILE}" ]]; then
					log WARN "Failed to load environment from ${env_file} (exit ${source_status}); continuing"
					continue
				else
					log WARN "Loaded environment from ${env_file} but it exited with status ${source_status}; ignoring exit status"
				fi
			fi
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

FACT_TARGET_COUNT="${FACT_TARGET_COUNT:-5}"
MAX_FACT_ATTEMPTS="${MAX_FACT_ATTEMPTS:-50}"
MAX_JOKE_ATTEMPTS="${MAX_JOKE_ATTEMPTS:-20}"
MYSQL_HOST="${TYPEORM_HOST:-localhost}"
MYSQL_USER="${TYPEORM_USERNAME:-}"
MYSQL_PASSWORD="${TYPEORM_PASSWORD:-}"
MYSQL_DATABASE="${FUN_FACT_DATABASE:-fun_fact}"
SLACK_CHANNEL="${SLACK_CHANNEL:-#general}"
SLACK_TEXT_FALLBACK="${SLACK_TEXT_FALLBACK:-SimpleTech SimpleFacts}"

USELESS_FACTS_URL="https://uselessfacts.jsph.pl/random.json?language=en"
API_NINJAS_URL="https://api.api-ninjas.com/v1/facts?limit=1"
QUOTE_URL="https://quotes.rest/qod.json?category=inspire"
JOKE_URL="https://v2.jokeapi.dev/joke/Miscellaneous,Pun,Spooky?blacklistFlags=racist,sexist"

require_command() {
	local command_name="$1"

	if ! command -v "${command_name}" >/dev/null 2>&1; then
		log ERROR "Missing required command: ${command_name}"
		exit 1
	fi
}

require_env() {
	local env_name="$1"

	if [[ -z "${!env_name:-}" ]]; then
		log ERROR "Missing required environment variable: ${env_name}"
		exit 1
	fi
}

sql_escape() {
	printf '%s' "$1" | sed "s/'/''/g"
}

mysql_query() {
	local query="$1"
	MYSQL_PWD="${MYSQL_PASSWORD}" mysql \
		--batch \
		--raw \
		--skip-column-names \
		-h "${MYSQL_HOST}" \
		-u "${MYSQL_USER}" \
		"${MYSQL_DATABASE}" \
		-e "${query}"
}

curl_json() {
	local url="$1"
	shift || true

	curl \
		--silent \
		--show-error \
		--fail \
		--retry 5 \
		--retry-delay 2 \
		--retry-all-errors \
		"$@" \
		"${url}"
}

is_new_fact() {
	local fact="$1"
	local source="$2"
	local count

	count=$(mysql_query "SELECT COUNT(*) FROM fact WHERE fact='$(sql_escape "${fact}")' AND source='$(sql_escape "${source}")';")
	[[ "${count}" == "0" ]]
}

add_fact() {
	local fact="$1"
	local source="$2"

	mysql_query "INSERT INTO fact (fact, source) VALUES ('$(sql_escape "${fact}")', '$(sql_escape "${source}")');" >/dev/null
}

is_new_joke() {
	local joke_id="$1"
	local count

	count=$(mysql_query "SELECT COUNT(*) FROM joke WHERE id='$(sql_escape "${joke_id}")';")
	[[ "${count}" == "0" ]]
}

add_joke_id() {
	local joke_id="$1"
	mysql_query "INSERT INTO joke (id) VALUES ('$(sql_escape "${joke_id}")');" >/dev/null
}

fetch_fact() {
	local response

	if (( RANDOM % 2 == 0 )); then
		response=$(curl_json "${USELESS_FACTS_URL}")
		jq -cn \
			--arg fact "$(jq -r '.text' <<<"${response}")" \
			--arg source "${USELESS_FACTS_URL}" \
			'{fact: $fact, source: $source}'
	else
		response=$(curl_json "${API_NINJAS_URL}" --header "X-Api-Key: ${API_NINJA_KEY}")
		jq -cn \
			--arg fact "$(jq -r '.[0].fact' <<<"${response}")" \
			--arg source "${API_NINJAS_URL}" \
			'{fact: $fact, source: $source}'
	fi
}

collect_facts() {
	local -a facts=()
	local attempts=0
	local fact_json
	local fact
	local source

	while (( ${#facts[@]} < FACT_TARGET_COUNT )); do
		attempts=$(( attempts + 1 ))
		if (( attempts > MAX_FACT_ATTEMPTS )); then
			log ERROR "Unable to collect ${FACT_TARGET_COUNT} unique facts after ${MAX_FACT_ATTEMPTS} attempts"
			return 1
		fi

		fact_json=$(fetch_fact)
		fact=$(jq -r '.fact' <<<"${fact_json}")
		source=$(jq -r '.source' <<<"${fact_json}")

		if is_new_fact "${fact}" "${source}"; then
			add_fact "${fact}" "${source}"
			facts+=("${fact_json}")
			log INFO "Collected fact ${#facts[@]}/${FACT_TARGET_COUNT} from ${source}"
		fi
	done

	printf '%s\n' "${facts[@]}"
}

fetch_quote() {
	local response

	if ! response=$(curl_json "${QUOTE_URL}" 2>/dev/null); then
		jq -cn '{error: "Issue with quote API - non 200 status code"}'
		return 0
	fi

	jq -c '{text: (.contents.quotes[0].quote + " - " + .contents.quotes[0].author), image_url: ("https://theysaidso.com/quote/image/" + .contents.quotes[0].id)}' <<<"${response}"
}

fetch_on_this_day() {
	local month
	local day
	local response

	month=$(date +%m)
	day=$(date +%d)
	response=$(curl_json "https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${month}/${day}")

	jq -c '{text: .selected[0].text, url: .selected[0].pages[0].content_urls.desktop.page, image: (.selected[0].pages[0].thumbnail.source // null), title: .selected[0].pages[0].title}' <<<"${response}"
}

fetch_joke() {
	local attempt=0
	local response
	local joke_id

	while (( attempt < MAX_JOKE_ATTEMPTS )); do
		attempt=$(( attempt + 1 ))
		response=$(curl_json "${JOKE_URL}")
		joke_id=$(jq -r '.id' <<<"${response}")

		if is_new_joke "${joke_id}"; then
			add_joke_id "${joke_id}"
			if [[ "$(jq -r '.type' <<<"${response}")" == 'single' ]]; then
				jq -r '.joke' <<<"${response}"
			else
				jq -r '(.setup + " \n\n " + .delivery)' <<<"${response}"
			fi
			return 0
		fi
	done

	log ERROR "Unable to retrieve a unique joke after ${MAX_JOKE_ATTEMPTS} attempts"
	return 1
}

build_blocks() {
	local quote_json="$1"
	local facts_json="$2"
	local on_this_day_json="$3"
	local joke_text="$4"
	local facts_text

	facts_text=$(jq -r 'map("• " + .fact) | join("\n")' <<<"${facts_json}")

	jq -n \
		--arg joke "${joke_text}" \
		--arg facts_text "${facts_text}" \
		--argjson quote "${quote_json}" \
		--argjson otd "${on_this_day_json}" '
		[
			{
				type: "header",
				text: {
					type: "plain_text",
					text: "SimpleTech\u0027s SimpleFacts :tm:",
					emoji: true
				}
			}
		]
		+ (if $quote.error? == null then [
			{type: "divider"},
			{
				type: "section",
				fields: [
					{
						type: "mrkdwn",
						text: "*Inspirational Quote of the Day* \n"
					}
				]
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: $quote.text
				}
			}
		] else [] end)
		+ [
			{type: "divider"},
			{
				type: "section",
				fields: [
					{
						type: "mrkdwn",
						text: "*Daily Joke:*"
					}
				]
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: $joke
				}
			},
			{type: "divider"},
			{
				type: "section",
				fields: [
					{
						type: "mrkdwn",
						text: "*Daily Facts:*"
					}
				]
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: $facts_text
				}
			},
			{type: "divider"},
			{
				type: "section",
				fields: [
					{
						type: "mrkdwn",
						text: "*On This Day:*"
					}
				]
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: ($otd.text + " \n\n <" + $otd.url + "|Learn More>")
				}
			}
		]
		+ (if $otd.image != null then [
			{
				type: "image",
				image_url: $otd.image,
				alt_text: $otd.title
			}
		] else [] end)
		+ [
			{type: "divider"},
			{
				type: "context",
				elements: [
					{
						type: "mrkdwn",
						text: "Disclaimer: SimpleTech\u0027s SimpleFacts :tm: offer no guarantee to the validity of the facts provided."
					}
				]
			}
		]
		'
}

send_slack_message() {
	local blocks_json="$1"
	local response_file
	local response_code
	local payload

	response_file=$(mktemp)
	payload=$(jq -n \
		--arg channel "${SLACK_CHANNEL}" \
		--arg text "${SLACK_TEXT_FALLBACK}" \
		--argjson blocks "${blocks_json}" \
		'{channel: $channel, text: $text, blocks: $blocks}')

	response_code=$(curl \
		--silent \
		--show-error \
		--output "${response_file}" \
		--write-out '%{http_code}' \
		--request POST \
		--header "Authorization: Bearer ${MUZZLE_BOT_TOKEN}" \
		--header 'Content-Type: application/json; charset=utf-8' \
		--data "${payload}" \
		https://slack.com/api/chat.postMessage || true)

	if [[ -z "${response_code:-}" ]]; then
		log ERROR 'Slack API request failed: curl did not complete successfully'
		rm -f "${response_file}"
		return 1
	fi

	if [[ "${response_code}" != '200' ]] || ! jq -e '.ok == true' "${response_file}" >/dev/null 2>&1; then
		log ERROR "Slack API request failed with HTTP ${response_code}: $(tr '\n' ' ' < "${response_file}")"
		rm -f "${response_file}"
		return 1
	fi

	log INFO "Posted Slack message to ${SLACK_CHANNEL}"
	rm -f "${response_file}"
}

main() {
	local -a facts_json=()
	local facts_array_json
	local joke_text
	local quote_json
	local on_this_day_json
	local blocks_json
	local fact_line

	log INFO 'Starting job run'
	require_command curl
	require_command jq
	require_command mysql
	require_command tr
	require_env TYPEORM_USERNAME
	require_env TYPEORM_PASSWORD
	require_env MUZZLE_BOT_TOKEN
	require_env API_NINJA_KEY

	while IFS= read -r fact_line; do
		facts_json+=("${fact_line}")
	done < <(collect_facts)
	log INFO "Collected ${#facts_json[@]} facts"
	facts_array_json=$(printf '%s\n' "${facts_json[@]}" | jq -s '.')
	joke_text=$(fetch_joke)
	log INFO 'Fetched daily joke'
	quote_json=$(fetch_quote)
	log INFO 'Fetched quote of the day payload'
	on_this_day_json=$(fetch_on_this_day)
	log INFO 'Fetched on-this-day payload'
	blocks_json=$(build_blocks "${quote_json}" "${facts_array_json}" "${on_this_day_json}" "${joke_text}")

	send_slack_message "${blocks_json}"
}

main "$@"


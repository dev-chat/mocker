#!/usr/bin/env bash

set -euo pipefail

PATH=/usr/local/bin:/usr/bin:/bin:${PATH:-}

SCRIPT_NAME="pricing-job"
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
				log WARN "Failed to load environment from ${env_file} (exit ${source_status}); continuing"
				continue
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

MYSQL_HOST="${TYPEORM_HOST:-localhost}"
MYSQL_USER="${TYPEORM_USERNAME:-}"
MYSQL_PASSWORD="${TYPEORM_PASSWORD:-}"
MYSQL_DATABASE="${TYPEORM_DATABASE:-}"

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

calculate_median_rep() {
	local count
	local median_index
	local target_line
	local sorted_rows
	local median_rep

	count=$(mysql_query 'SELECT COUNT(DISTINCT affectedUser) FROM reaction;')
	if (( count == 0 )); then
		log ERROR 'No reputation data found; refusing to calculate prices'
		return 1
	fi

	sorted_rows=$(mysql_query '
		SELECT earned.affectedUser, (earned.total - COALESCE(spent.total, 0)) AS rep
		FROM (
			SELECT affectedUser, SUM(value) AS total
			FROM reaction
			GROUP BY affectedUser
		) AS earned
		LEFT JOIN (
			SELECT user, SUM(price) AS total
			FROM purchase
			GROUP BY user
		) AS spent ON spent.user = earned.affectedUser
		ORDER BY rep DESC;
	')

	median_index=$(( (count + 1) / 2 ))
	target_line=${median_index}
	median_rep=$(awk -F $'\t' -v target="${target_line}" 'NR == target { print $2 }' <<<"${sorted_rows}")

	if [[ -z "${median_rep}" ]]; then
		median_rep=$(awk -F $'\t' 'END { print $2 }' <<<"${sorted_rows}")
	fi

	printf '%s' "${median_rep}"
}

main() {
	local start_time
	local team_id
	local item_row
	local item_id
	local price_pct
	local price
	local median_rep
	local sql_batch
	local -a teams
	local -a items
	local row

	require_command mysql
	require_command awk
	require_env TYPEORM_USERNAME
	require_env TYPEORM_PASSWORD
	require_env TYPEORM_DATABASE

	log INFO 'Beginning pricing job'
	start_time=$(date +%s)
	log INFO 'Connecting to MySQL'
	mysql_query 'SELECT 1;' >/dev/null
	log INFO 'Connected to MySQL'

	log INFO 'Retrieving distinct teams'
	while IFS= read -r row; do
		teams+=("${row}")
	done < <(mysql_query 'SELECT DISTINCT(teamId) FROM slack_user;')
	log INFO "Retrieved ${#teams[@]} teams"
	if (( ${#teams[@]} == 0 )); then
		log WARN 'No teams found; pricing job will exit without inserting prices'
		return 0
	fi

	log INFO 'Retrieving all items'
	while IFS= read -r row; do
		items+=("${row}")
	done < <(mysql_query 'SELECT id, pricePct FROM item;')
	log INFO "Retrieved ${#items[@]} items"
	if (( ${#items[@]} == 0 )); then
		log WARN 'No items found; pricing job will exit without inserting prices'
		return 0
	fi

	median_rep=$(calculate_median_rep)
	log INFO "Calculated median reputation as ${median_rep}"

	sql_batch=""
	for team_id in "${teams[@]}"; do
		[[ -n "${team_id}" ]] || continue

		for item_row in "${items[@]}"; do
			IFS=$'\t' read -r item_id price_pct <<<"${item_row}"
			price=$(awk -v median="${median_rep}" -v pct="${price_pct}" 'BEGIN { printf "%.15f", median * pct }')
			sql_batch+="INSERT INTO price(itemId, teamId, price, itemIdId) VALUES(${item_id}, '$(sql_escape "${team_id}")', ${price}, ${item_id});"$'\n'
		done

		log INFO "Queued price refresh for team ${team_id}"
	done

	if [[ -n "${sql_batch}" ]]; then
		log INFO 'Executing batch price inserts'
		mysql_query "START TRANSACTION;
${sql_batch}COMMIT;" || {
			log ERROR 'Batch insert failed; transaction has been rolled back'
			return 1
		}
		log INFO 'Batch price inserts committed successfully'
	else
		log WARN 'No SQL statements were generated; nothing to insert'
	fi

	log INFO "Completed job in $(( $(date +%s) - start_time )) seconds"
}

main "$@"

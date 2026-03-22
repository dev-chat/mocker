#!/usr/bin/env bash

set -euo pipefail

if [[ -f /home/muzzle.lol/.bash_profile ]]; then
	# Cron runs with a minimal environment, so load the deployed shell profile when present.
	# shellcheck disable=SC1091
	. /home/muzzle.lol/.bash_profile
fi

PATH=/usr/local/bin:/usr/bin:/bin:${PATH:-}

MYSQL_HOST="${TYPEORM_HOST:-localhost}"
MYSQL_USER="${TYPEORM_USERNAME:-}"
MYSQL_PASSWORD="${TYPEORM_PASSWORD:-}"
MYSQL_DATABASE="${TYPEORM_DATABASE:-}"

require_command() {
	local command_name="$1"

	if ! command -v "${command_name}" >/dev/null 2>&1; then
		echo "Missing required command: ${command_name}" >&2
		exit 1
	fi
}

require_env() {
	local env_name="$1"

	if [[ -z "${!env_name:-}" ]]; then
		echo "Missing required environment variable: ${env_name}" >&2
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
		echo 'No reputation data found; refusing to calculate prices' >&2
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
	target_line=$(( median_index + 1 ))
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
	local -a teams
	local -a items
	local row

	require_command mysql
	require_command awk
	require_command sort
	require_env TYPEORM_USERNAME
	require_env TYPEORM_PASSWORD
	require_env TYPEORM_DATABASE

	echo 'Beginning pricing job...'
	start_time=$(date +%s)
	echo 'Connecting to mysql DB...'
	mysql_query 'SELECT 1;' >/dev/null
	echo 'Connected!'

	echo 'Retrieving distinct teams...'
	while IFS= read -r row; do
		teams+=("${row}")
	done < <(mysql_query 'SELECT DISTINCT(teamId) FROM slack_user;')
	echo 'Teams retrieved!'
	echo 'Retrieving all items...'
	while IFS= read -r row; do
		items+=("${row}")
	done < <(mysql_query 'SELECT id, pricePct FROM item;')
	echo 'Items retrieved!'

	median_rep=$(calculate_median_rep)

	for team_id in "${teams[@]}"; do
		[[ -n "${team_id}" ]] || continue

		for item_row in "${items[@]}"; do
			IFS=$'\t' read -r item_id price_pct <<<"${item_row}"
			price=$(awk -v median="${median_rep}" -v pct="${price_pct}" 'BEGIN { printf "%.15f", median * pct }')
			mysql_query "INSERT INTO price(itemId, teamId, price, itemIdId) VALUES(${item_id}, '$(sql_escape "${team_id}")', ${price}, ${item_id});" >/dev/null
		done

		echo "Completed update for ${team_id}"
	done

	echo "Completed job in $(( $(date +%s) - start_time )) seconds!"
}

main "$@"

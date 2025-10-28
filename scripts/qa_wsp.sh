#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://wsp.azaleia.com.pe}"
JSON_HEADER="Content-Type: application/json"

run_curl() {
  local label="$1"
  shift
  echo "==> ${label}"
  local output
  local status
  set +e
  output=$(curl -sS -w "\n%{http_code}" "$@")
  exit_code=$?
  set -e
  if [[ $exit_code -ne 0 ]]; then
    echo "ERROR (curl exit ${exit_code})"
    echo "${output}" | sed '$d'
    echo
    return 0
  fi
  status="${output##*$'\n'}"
  body="${output%$'\n'*}"
  if [[ "${status}" == "200" ]]; then
    echo "OK (${status})"
  else
    echo "ERROR (${status})"
  fi
  if [[ -n "${body}" ]]; then
    echo "${body}"
  fi
  echo
  return 0
}

run_curl "Healthz" "${BASE_URL}/api/healthz"
run_curl "WSP test" -X POST -H "${JSON_HEADER}" -d '{"to":"51918131082","text":"Hola desde Builder"}' "${BASE_URL}/api/wsp/test"
run_curl "CRM health" "${BASE_URL}/api/crm/health"
run_curl "CRM conversations" "${BASE_URL}/api/crm/conversations"

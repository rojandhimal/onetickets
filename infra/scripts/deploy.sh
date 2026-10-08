#!/usr/bin/env bash
# Deploy already-pushed images to one environment's ECS cluster:
#   1. run database migrations as a one-off task and stop if they fail
#   2. roll each service onto a new task definition revision
#   3. wait until every service is stable (ECS rolls back on its own if not)
#
# Usage: deploy.sh <environment> <app>=<image> [<app>=<image> ...]
#   deploy.sh staging api=1234.dkr.ecr.ap-southeast-2.amazonaws.com/onetickets/api:abc123 web=...
#
# Needs AWS credentials for the environment's account, plus aws and jq.
set -euo pipefail

env_name="${1:?environment required}"
shift
cluster="onetickets-${env_name}"

declare -A images=()
for pair in "$@"; do
  images["${pair%%=*}"]="${pair#*=}"
done
[[ -n "${images[api]:-}" ]] || { echo "api=<image> is required (migrations run from the api image)" >&2; exit 1; }

# Registers a copy of the family's latest revision with a new image and prints
# the new revision's ARN.
register_revision() {
  local family="$1" image="$2"
  aws ecs describe-task-definition --task-definition "$family" --query taskDefinition --output json |
    jq --arg image "$image" '
      .containerDefinitions[0].image = $image
      | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities,
            .registeredAt, .registeredBy, .deregisteredAt)' >"$tmp/$family.json"
  aws ecs register-task-definition --cli-input-json "file://$tmp/$family.json" \
    --query taskDefinition.taskDefinitionArn --output text
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "::group::Migrations"
migrate_td="$(register_revision "${cluster}-migrate" "${images[api]}")"

# Run in the same subnets and security group as the API service.
network="$(aws ecs describe-services --cluster "$cluster" --services api \
  --query 'services[0].networkConfiguration' --output json)"

task_arn="$(aws ecs run-task --cluster "$cluster" --task-definition "$migrate_td" \
  --launch-type FARGATE --network-configuration "$network" \
  --started-by "deploy-${GITHUB_RUN_ID:-manual}" \
  --query 'tasks[0].taskArn' --output text)"
echo "Started $task_arn"

# The waiter gives up after 10 minutes; a migration that long needs a human.
aws ecs wait tasks-stopped --cluster "$cluster" --tasks "$task_arn"

result="$(aws ecs describe-tasks --cluster "$cluster" --tasks "$task_arn" \
  --query 'tasks[0].{exit: containers[0].exitCode, reason: stoppedReason}' --output json)"
exit_code="$(jq -r '.exit' <<<"$result")"

task_id="${task_arn##*/}"
aws logs get-log-events --log-group-name "/onetickets/${env_name}/migrate" \
  --log-stream-name "migrate/migrate/${task_id}" --start-from-head \
  --query 'events[].message' --output text 2>/dev/null || echo "(no migration logs found)"
echo "::endgroup::"

if [[ "$exit_code" != "0" ]]; then
  echo "::error::Migrations failed (exit code ${exit_code}): $(jq -r '.reason' <<<"$result"). Services were not updated."
  exit 1
fi

for app in "${!images[@]}"; do
  echo "::group::Deploy $app"
  td="$(register_revision "${cluster}-${app}" "${images[$app]}")"
  aws ecs update-service --cluster "$cluster" --service "$app" --task-definition "$td" \
    --query 'service.serviceName' --output text
  echo "::endgroup::"
done

echo "Waiting for services to become stable..."
aws ecs wait services-stable --cluster "$cluster" --services "${!images[@]}"

# The circuit breaker can roll a service back and still leave it stable, so
# check each one is running the revision we just registered.
failed=0
for app in "${!images[@]}"; do
  running="$(aws ecs describe-services --cluster "$cluster" --services "$app" \
    --query 'services[0].taskDefinition' --output text)"
  image="$(aws ecs describe-task-definition --task-definition "$running" \
    --query 'taskDefinition.containerDefinitions[0].image' --output text)"
  if [[ "$image" != "${images[$app]}" ]]; then
    echo "::error::$app was rolled back and is running $image"
    failed=1
  fi
done
exit "$failed"

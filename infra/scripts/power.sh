#!/usr/bin/env bash
# Wake or put to sleep an environment that has an out-of-hours schedule
# (staging). The schedule does the same every weekday; use this for a demo
# outside those hours, or to switch off early.
#
# Usage: power.sh <environment> up|down
# Needs AWS credentials for the environment's account, plus aws.
set -euo pipefail

env_name="${1:?environment required}"
direction="${2:?up or down}"
cluster="onetickets-${env_name}"
db="onetickets-${env_name}"
services=(api web)

db_status() {
  aws rds describe-db-instances --db-instance-identifier "$db" \
    --query 'DBInstances[0].DBInstanceStatus' --output text
}

case "$direction" in
  up)
    status="$(db_status)"
    if [[ "$status" == "stopped" ]]; then
      echo "Starting database $db"
      aws rds start-db-instance --db-instance-identifier "$db" >/dev/null
    fi
    if [[ "$status" != "available" ]]; then
      echo "Waiting for database $db (was $status)"
      aws rds wait db-instance-available --db-instance-identifier "$db"
    fi
    for svc in "${services[@]}"; do
      aws ecs update-service --cluster "$cluster" --service "$svc" --desired-count 1 \
        --query 'service.serviceName' --output text
    done
    aws ecs wait services-stable --cluster "$cluster" --services "${services[@]}"
    ;;
  down)
    for svc in "${services[@]}"; do
      aws ecs update-service --cluster "$cluster" --service "$svc" --desired-count 0 \
        --query 'service.serviceName' --output text
    done
    if [[ "$(db_status)" == "available" ]]; then
      aws rds stop-db-instance --db-instance-identifier "$db" >/dev/null
      echo "Stopping database $db"
    fi
    ;;
  *)
    echo "direction must be up or down" >&2
    exit 1
    ;;
esac

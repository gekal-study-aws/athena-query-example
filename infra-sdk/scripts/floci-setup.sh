#!/usr/bin/env bash
set -euo pipefail

ENDPOINT_URL="${FLOCI_ENDPOINT_URL:-http://localhost:4566}"
REGION="${FLOCI_REGION:-ap-northeast-1}"
AUDIT_BUCKET="${FLOCI_AUDIT_BUCKET:-audit-log-local}"
RESULT_BUCKET="${FLOCI_RESULT_BUCKET:-athena-results-local}"
DATABASE_NAME="${FLOCI_DATABASE:-audit_log_db}"
TABLE_NAME="${FLOCI_TABLE:-audit_logs}"
WORKGROUP_NAME="${FLOCI_WORKGROUP:-AuditLogWorkGroup}"
DATA_DIR="${FLOCI_DATA_DIR:-data}"

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_DEFAULT_REGION="$REGION"

aws_floci() {
  aws --endpoint-url "$ENDPOINT_URL" --region "$REGION" "$@"
}

echo "==> Waiting for Floci at $ENDPOINT_URL"
for _ in $(seq 1 60); do
  if aws_floci s3 ls >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Creating S3 buckets"
for bucket in "$AUDIT_BUCKET" "$RESULT_BUCKET"; do
  if aws_floci s3api head-bucket --bucket "$bucket" >/dev/null 2>&1; then
    echo "    bucket already exists: $bucket"
  else
    aws_floci s3api create-bucket \
      --bucket "$bucket" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
    echo "    created: $bucket"
  fi
done

echo "==> Creating Glue database: $DATABASE_NAME"
if aws_floci glue get-database --name "$DATABASE_NAME" >/dev/null 2>&1; then
  echo "    database already exists"
else
  aws_floci glue create-database \
    --database-input "{\"Name\": \"$DATABASE_NAME\", \"Description\": \"Database for audit logs (Floci local)\"}" >/dev/null
  echo "    created"
fi

echo "==> Creating Glue table: $TABLE_NAME"
TABLE_INPUT=$(cat <<JSON
{
  "Name": "$TABLE_NAME",
  "Description": "Table for audit logs (Floci local)",
  "TableType": "EXTERNAL_TABLE",
  "Parameters": {
    "has_encrypted_data": "false",
    "classification": "json",
    "typeOfData": "file",
    "projection.enabled": "true",
    "projection.year.type": "integer",
    "projection.year.range": "2024,2030",
    "projection.month.type": "integer",
    "projection.month.range": "1,12",
    "projection.month.digits": "2",
    "projection.day.type": "integer",
    "projection.day.range": "1,31",
    "projection.day.digits": "2",
    "storage.location.template": "s3://$AUDIT_BUCKET/logs/year=\${year}/month=\${month}/day=\${day}"
  },
  "StorageDescriptor": {
    "Columns": [
      {"Name": "timestamp",   "Type": "string"},
      {"Name": "user_id",     "Type": "string"},
      {"Name": "event_name",  "Type": "string"},
      {"Name": "resource_id", "Type": "string"},
      {"Name": "status",      "Type": "string"},
      {"Name": "ip_address",  "Type": "string"}
    ],
    "Location": "s3://$AUDIT_BUCKET/logs/",
    "InputFormat": "org.apache.hadoop.mapred.TextInputFormat",
    "OutputFormat": "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
    "SerdeInfo": {
      "SerializationLibrary": "org.openx.data.jsonserde.JsonSerDe"
    }
  },
  "PartitionKeys": [
    {"Name": "year",  "Type": "string"},
    {"Name": "month", "Type": "string"},
    {"Name": "day",   "Type": "string"}
  ]
}
JSON
)

if aws_floci glue get-table --database-name "$DATABASE_NAME" --name "$TABLE_NAME" >/dev/null 2>&1; then
  aws_floci glue update-table \
    --database-name "$DATABASE_NAME" \
    --table-input "$TABLE_INPUT" >/dev/null
  echo "    updated"
else
  aws_floci glue create-table \
    --database-name "$DATABASE_NAME" \
    --table-input "$TABLE_INPUT" >/dev/null
  echo "    created"
fi

echo "==> Creating Athena workgroup: $WORKGROUP_NAME"
if aws_floci athena get-work-group --work-group "$WORKGROUP_NAME" >/dev/null 2>&1; then
  echo "    workgroup already exists"
else
  WG_OUT=$(aws_floci athena create-work-group \
    --name "$WORKGROUP_NAME" \
    --configuration "ResultConfiguration={OutputLocation=s3://$RESULT_BUCKET/results/}" 2>&1) && {
    echo "    created"
  } || {
    if echo "$WG_OUT" | grep -qE "InvalidAction|is not supported|NotImplemented"; then
      echo "    skipped: Athena workgroup APIs not supported by this Floci version (using default)"
    else
      echo "$WG_OUT" >&2
      exit 1
    fi
  }
fi

echo "==> Uploading sample data from $DATA_DIR"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DATA_DIR="$SCRIPT_DIR/../$DATA_DIR"
if [ ! -d "$LOCAL_DATA_DIR" ]; then
  echo "    skipped: $LOCAL_DATA_DIR not found (run scripts/generate_sample_logs.sh first)"
else
  aws_floci s3 sync "$LOCAL_DATA_DIR" "s3://$AUDIT_BUCKET/logs/"
fi

echo
echo "Done. Summary:"
echo "  Athena endpoint:   $ENDPOINT_URL"
echo "  Region:            $REGION"
echo "  Database:          $DATABASE_NAME"
echo "  Table:             $TABLE_NAME"
echo "  Workgroup:         $WORKGROUP_NAME"
echo "  Audit bucket:      s3://$AUDIT_BUCKET/"
echo "  Result bucket:     s3://$RESULT_BUCKET/results/"

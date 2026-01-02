#!/bin/bash

# 生成するログの行数と日付
NUM_LOGS=${1:-100}
TARGET_DATE=${2:-$(date +"%Y-%m-%d")}
YEAR=$(date -d "$TARGET_DATE" +"%Y" 2>/dev/null || date -f "%Y-%m-%d" -j "$TARGET_DATE" +"%Y")
MONTH=$(date -d "$TARGET_DATE" +"%m" 2>/dev/null || date -f "%Y-%m-%d" -j "$TARGET_DATE" +"%m")
DAY=$(date -d "$TARGET_DATE" +"%d" 2>/dev/null || date -f "%Y-%m-%d" -j "$TARGET_DATE" +"%d")

OUTPUT_DIR="data/year=$YEAR/month=$MONTH/day=$DAY"
mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/sample_audit_logs.json"

echo "Generating $NUM_LOGS sample audit logs for $TARGET_DATE..."

# ファイルを初期化
> "$OUTPUT_FILE"

USERS=("user_1" "user_2" "user_3" "admin" "guest")
EVENTS=("login" "logout" "file_upload" "file_download" "delete_resource")
STATUSES=("success" "failure" "denied")

for i in $(seq 1 $NUM_LOGS); do
    # 指定された日付内でのランダムな時間を生成 (00:00:00 - 23:59:59)
    RANDOM_HOUR=$(printf "%02d" $((RANDOM % 24)))
    RANDOM_MIN=$(printf "%02d" $((RANDOM % 60)))
    RANDOM_SEC=$(printf "%02d" $((RANDOM % 60)))
    TIMESTAMP="${TARGET_DATE}T${RANDOM_HOUR}:${RANDOM_MIN}:${RANDOM_SEC}Z"
    USER_ID=${USERS[$RANDOM % ${#USERS[@]}]}
    EVENT_NAME=${EVENTS[$RANDOM % ${#EVENTS[@]}]}
    RESOURCE_ID="res-$(printf "%03d" $((RANDOM % 100)))"
    STATUS=${STATUSES[$RANDOM % ${#STATUSES[@]}]}
    IP_ADDRESS="192.168.1.$((RANDOM % 255))"

    echo "{\"timestamp\":\"$TIMESTAMP\",\"user_id\":\"$USER_ID\",\"event_name\":\"$EVENT_NAME\",\"resource_id\":\"$RESOURCE_ID\",\"status\":\"$STATUS\",\"ip_address\":\"$IP_ADDRESS\"}" >> $OUTPUT_FILE
    
    # タイムスタンプを少しずつ進めるシミュレーション（オプション）
    # sleep 0.1
done

echo "Sample logs generated: $OUTPUT_FILE"

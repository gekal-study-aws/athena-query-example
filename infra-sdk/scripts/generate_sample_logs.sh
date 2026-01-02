#!/bin/bash

# 生成するログの行数
NUM_LOGS=${1:-100}
OUTPUT_FILE="sample_audit_logs.json"

echo "Generating $NUM_LOGS sample audit logs..."

# ファイルを初期化
> $OUTPUT_FILE

USERS=("user_1" "user_2" "user_3" "admin" "guest")
EVENTS=("login" "logout" "file_upload" "file_download" "delete_resource")
STATUSES=("success" "failure" "denied")

for i in $(seq 1 $NUM_LOGS); do
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
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

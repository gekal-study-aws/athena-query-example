#!/bin/bash

# 引数チェック
if [ -z "$1" ]; then
    echo "Usage: $0 <s3-bucket-name>"
    exit 1
fi

BUCKET_NAME=$1
FILE_NAME="sample_audit_logs.json"

if [ ! -f "$FILE_NAME" ]; then
    echo "Error: $FILE_NAME not found. Run generate_sample_logs.sh first."
    exit 1
fi

echo "Uploading $FILE_NAME to s3://$BUCKET_NAME/logs/"
aws s3 cp "$FILE_NAME" "s3://$BUCKET_NAME/logs/$FILE_NAME"

if [ $? -eq 0 ]; then
    echo "Upload successful."
else
    echo "Upload failed."
    exit 1
fi

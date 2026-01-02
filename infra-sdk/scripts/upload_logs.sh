#!/bin/bash

# 引数チェック
if [ -z "$1" ]; then
    echo "Usage: $0 <s3-bucket-name>"
    exit 1
fi

BUCKET_NAME=$1
DATA_DIR="data"

if [ ! -d "$DATA_DIR" ]; then
    echo "Error: $DATA_DIR directory not found. Run generate_sample_logs.sh first."
    exit 1
fi

echo "Uploading $DATA_DIR to s3://$BUCKET_NAME/logs/"
aws s3 sync "$DATA_DIR" "s3://$BUCKET_NAME/logs/"

if [ $? -eq 0 ]; then
    echo "Upload successful."
else
    echo "Upload failed."
    exit 1
fi

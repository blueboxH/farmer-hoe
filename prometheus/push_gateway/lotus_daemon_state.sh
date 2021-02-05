#!/bin/bash
stage_error=$(lotus sync status | grep "Stage: error" | wc -l)
height_diff=$(lotus sync status | grep "Height diff:" | awk -f height_diff.awk)
echo "lotus_sync_stage_error ${stage_error}" | curl --data-binary @- http://192.168.14.90:9091/metrics/job/push_gateway
echo "lotus_sync_height_diff ${height_diff}" | curl --data-binary @- http://192.168.14.90:9091/metrics/job/push_gateway
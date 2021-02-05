#!/bin/bash
lotus client query-ask $1 | grep -E "^Price per GiB" |grep -oe "[0-9\.]*"
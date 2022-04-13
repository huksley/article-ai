#!/bin/bash
source /var/app/venv/*/bin/activate
cd /var/app/staging

export VIRTUAL_ENV=/var/app/venv/staging-LQM1lest
./download.sh

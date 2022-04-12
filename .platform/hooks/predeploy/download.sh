#!/bin/bash
source /var/app/venv/*/bin/activate
cd /var/app/staging
./download.sh

# This script is executed as root so move them where we can see them from webapp
mv /root/nltk_data /var/app/venv/staging-LQM1lest/nltk_data

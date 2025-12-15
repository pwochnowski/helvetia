#!/bin/bash

# Script to update Gmail App Password for Alertmanager

echo "Enter your Gmail App Password (from https://myaccount.google.com/apppasswords):"
echo "Format: xxxx xxxx xxxx xxxx (spaces will be removed)"
read -s APP_PASSWORD

# Remove spaces
APP_PASSWORD=$(echo "$APP_PASSWORD" | tr -d ' ')

# Update the alertmanager config
sed -i.bak "s/YOUR_GMAIL_APP_PASSWORD/$APP_PASSWORD/g" prometheus/alertmanager.yml

echo "✅ Password updated in alertmanager.yml"
echo "Restarting alertmanager..."

docker-compose restart alertmanager

echo "✅ Alertmanager restarted with email configuration"
echo ""
echo "To test, run: docker-compose logs alertmanager"

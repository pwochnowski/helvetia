#!/bin/bash

# Simple load generator script for testing the API and generating metrics

BASE_URL="http://localhost:8080"
REQUESTS=0
SUCCESSES=0
FAILURES=0

echo "Starting load test against $BASE_URL"
echo "Press Ctrl+C to stop"
echo ""

# Trap Ctrl+C to show summary
trap 'echo -e "\n\n=== Summary ==="; echo "Total requests: $REQUESTS"; echo "Successes: $SUCCESSES"; echo "Failures: $FAILURES"; exit 0' INT

while true; do
    # Query the /users endpoint
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/users")
    REQUESTS=$((REQUESTS + 1))
    
    if [ "$HTTP_CODE" = "200" ]; then
        SUCCESSES=$((SUCCESSES + 1))
        echo "✓ Request #$REQUESTS - GET /users → $HTTP_CODE"
    else
        FAILURES=$((FAILURES + 1))
        echo "✗ Request #$REQUESTS - GET /users → $HTTP_CODE"
    fi
    
    # Also test the hello endpoint occasionally
    if [ $((REQUESTS % 5)) -eq 0 ]; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/hello")
        REQUESTS=$((REQUESTS + 1))
        
        if [ "$HTTP_CODE" = "200" ]; then
            SUCCESSES=$((SUCCESSES + 1))
            echo "✓ Request #$REQUESTS - GET /hello → $HTTP_CODE"
        else
            FAILURES=$((FAILURES + 1))
            echo "✗ Request #$REQUESTS - GET /hello → $HTTP_CODE"
        fi
    fi
    
    # Small delay between requests (1 second)
    sleep 1
done

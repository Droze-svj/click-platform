#!/bin/bash

# Server Startup Test Runner
# Tests all recommended scenarios for server startup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
TEST_PORT=6001
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVER_DIR="$BASE_DIR/server"

echo -e "${GREEN}=== Server Startup Test Suite ===${NC}\n"

# Test counter
PASSED=0
FAILED=0

# macOS-compatible timeout function
timeout_cmd() {
    local duration=$1
    shift
    
    # Check if timeout command exists (Linux)
    if command -v timeout >/dev/null 2>&1; then
        timeout "$duration" "$@"
    # Check if gtimeout exists (macOS with coreutils)
    elif command -v gtimeout >/dev/null 2>&1; then
        gtimeout "$duration" "$@"
    # Use perl as fallback (available on macOS)
    else
        perl -e 'alarm shift; exec @ARGV' "$duration" "$@"
    fi
}

# Function to run a test
run_test() {
    local test_name=$1
    local env_vars=$2
    local expected_pattern=$3
    
    echo -e "${YELLOW}Testing: $test_name${NC}"
    
    # Set environment variables
    export $env_vars
    export PORT=$TEST_PORT
    # Only set NODE_ENV to development if not already set by env_vars
    if [[ -z "$NODE_ENV" ]]; then
        export NODE_ENV=development  # Use development instead of test for better compatibility
    fi
    
    # Clean up log file
    rm -f /tmp/test-output.log
    
    # Run server with timeout in background
    timeout_cmd 20 node "$SERVER_DIR/index.js" > /tmp/test-output.log 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to start or fail (increased wait time for slower startup)
    sleep 12
    
    # Check if process is still running
    if kill -0 $SERVER_PID 2>/dev/null; then
        # Server is running - check output for expected pattern (use -E for extended regex with |)
        if grep -qiE "$expected_pattern" /tmp/test-output.log 2>/dev/null; then
            echo -e "${GREEN}✓ PASSED${NC}"
            ((PASSED++))
        else
            echo -e "${RED}✗ FAILED: Expected pattern '$expected_pattern' not found${NC}"
            echo "Last 30 lines of output:"
            tail -30 /tmp/test-output.log
            ((FAILED++))
        fi
        
        # Kill server gracefully
        kill $SERVER_PID 2>/dev/null || true
        sleep 2
        # Force kill if still running
        kill -9 $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    else
        # Server exited - check if it was expected (might have started and logged before exiting)
        if grep -qiE "$expected_pattern" /tmp/test-output.log 2>/dev/null; then
            echo -e "${GREEN}✓ PASSED${NC}"
            ((PASSED++))
        else
            echo -e "${YELLOW}⚠ Server exited - checking output...${NC}"
            # Check for common error patterns
            if grep -qi "Server running on port" /tmp/test-output.log 2>/dev/null; then
                # Server did start at some point
                if grep -qiE "$expected_pattern" /tmp/test-output.log 2>/dev/null; then
                    echo -e "${GREEN}✓ PASSED (server started then exited)${NC}"
                    ((PASSED++))
                else
                    echo -e "${RED}✗ FAILED: Server started but expected pattern not found${NC}"
                    tail -30 /tmp/test-output.log
                    ((FAILED++))
                fi
            else
                echo -e "${RED}✗ FAILED: Server exited before starting${NC}"
                echo "Error output:"
                tail -50 /tmp/test-output.log
                ((FAILED++))
            fi
        fi
    fi
    
    # Clean up
    kill $SERVER_PID 2>/dev/null || true
    sleep 1
    
    # Increment port for next test to avoid conflicts
    TEST_PORT=$((TEST_PORT + 1))
}

echo "Test 1: Server startup with missing Redis"
run_test "Missing Redis" \
    "REDIS_URL=" \
    "Redis not configured"

echo -e "\nTest 2: Server startup with missing Sentry"
run_test "Missing Sentry" \
    "SENTRY_DSN=" \
    "Sentry DSN not configured"

echo -e "\nTest 3: Server startup with missing Email Service"
run_test "Missing Email Service" \
    "SENDGRID_API_KEY=" \
    "SendGrid API key not found"

echo -e "\nTest 4: Server startup with missing Supabase"
run_test "Missing Supabase" \
    "SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY=" \
    "Supabase not configured|supabase.*not.*configured"

echo -e "\nTest 5: Server startup with ALL optional services missing"
run_test "All Optional Services Missing" \
    "REDIS_URL= SENTRY_DSN= SENDGRID_API_KEY= SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY=" \
    "Server running on port|Server bound to port|🚀 Server running"

echo -e "\nTest 6: Production mode with invalid Redis URL"
run_test "Production Invalid Redis" \
    "NODE_ENV=production REDIS_URL=redis://localhost:6379" \
    "REDIS_URL contains localhost|Workers will NOT|localhost.*production"

echo -e "\n${GREEN}=== Test Results ===${NC}"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed. ✗${NC}"
    exit 1
fi


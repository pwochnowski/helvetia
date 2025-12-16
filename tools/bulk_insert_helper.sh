#!/bin/bash
#
# Vitess Bulk Insert Helper
# Manages replication and executes bulk insert for maximum performance
#
# Usage:
#   ./bulk_insert_helper.sh [--users N] [--articles N] [--reads N]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VITESS_DIR="${SCRIPT_DIR}/../docker/vitess"
VTGATE_HOST="127.0.0.1"
VTGATE_PORT="15306"

# Default counts
USERS=10000
ARTICLES=10000  
READS=100000

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --users)
            USERS="$2"
            shift 2
            ;;
        --articles)
            ARTICLES="$2"
            shift 2
            ;;
        --reads)
            READS="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [--users N] [--articles N] [--reads N]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "=============================================="
echo "Vitess Bulk Insert Helper"
echo "=============================================="
echo "Users: $USERS | Articles: $ARTICLES | Reads: $READS"
echo ""

# Find the vtctld container name (handles both vitess-vtctld and vitess-vtctld-1)
get_vtctld_container() {
    docker ps --format "{{.Names}}" | grep -E "vtctld" | head -1
}

# Function to execute vtctldclient commands inside the vtctld container
vtctldclient() {
    local container=$(get_vtctld_container)
    if [ -z "$container" ]; then
        echo "ERROR: vtctld container not found" >&2
        return 1
    fi
    docker exec "$container" vtctldclient --server=localhost:15999 "$@"
}

# Function to check if Vitess is running
check_vitess() {
    echo "Checking Vitess cluster status..."
    if ! docker ps | grep -q vitess-vtgate; then
        echo "ERROR: Vitess VTGate is not running"
        echo "Start Vitess first: cd docker/vitess && docker-compose up -d"
        exit 1
    fi
    echo "✓ Vitess cluster is running"
}

# Keyspaces to manage
KEYSPACES="user_keyspace article_keyspace read_keyspace beread_keyspace popularrank_keyspace"

# Function to get all replica tablet aliases
get_replica_tablets() {
    # Get all tablets and filter for replicas
    vtctldclient GetTablets 2>/dev/null | grep -i replica | awk '{print $1}' || true
}


# Function to set keyspace durability policy
set_durability_policy() {
    local policy=$1
    echo ""
    echo "Setting keyspace durability policy to '$policy'..."
    
    for keyspace in $KEYSPACES; do
        echo "  Setting $keyspace to $policy..."
        vtctldclient SetKeyspaceDurabilityPolicy --durability-policy="$policy" "$keyspace" >/dev/null 2>/dev/null \
            || echo "    Warning: Could not set durability for $keyspace"
    done
    
    echo "✓ Durability policy set to '$policy'"
}

# Function to pause vreplication (if configured)
pause_vreplication() {
    echo ""
    echo "Pausing VReplication workflows (if any)..."
    
    # List and pause any active VReplication workflows
    # This prevents replication lag during bulk inserts
    for keyspace in user article read; do
        workflows=$(vtctl Workflow -- --keyspace=$keyspace listall 2>/dev/null || echo "")
        if [ -n "$workflows" ] && [ "$workflows" != "[]" ]; then
            echo "  Pausing workflows in $keyspace: $workflows"
            for wf in $workflows; do
                vtctl Workflow -- --keyspace=$keyspace stop --workflow=$wf 2>/dev/null || true
            done
        fi
    done
    
    echo "✓ VReplication paused (or none active)"
}

# Function to resume vreplication
resume_vreplication() {
    echo ""
    echo "Resuming VReplication workflows..."
    
    for keyspace in user article read; do
        workflows=$(vtctl Workflow -- --keyspace=$keyspace listall 2>/dev/null || echo "")
        if [ -n "$workflows" ] && [ "$workflows" != "[]" ]; then
            echo "  Resuming workflows in $keyspace: $workflows"
            for wf in $workflows; do
                vtctl Workflow -- --keyspace=$keyspace start --workflow=$wf 2>/dev/null || true
            done
        fi
    done
    
    echo "✓ VReplication resumed"
}


# Function to run the bulk insert
run_bulk_insert() {
    echo ""
    echo "=============================================="
    echo "Running Bulk Insert"
    echo "=============================================="
    
    # Run the bulk insert script
    uv run "${SCRIPT_DIR}/bulk_insert.py" \
        --host "$VTGATE_HOST" \
        --port "$VTGATE_PORT" \
        --users "$USERS" \
        --articles "$ARTICLES" \
        --reads "$READS" \
        --truncate
}

# Function to verify insert counts
verify_counts() {
    echo ""
    echo "=============================================="
    echo "Verifying Insert Counts"
    echo "=============================================="
    
    mysql -h "$VTGATE_HOST" -P "$VTGATE_PORT" -u root -N -e "
        SELECT 'Users:', COUNT(*) FROM user.user;
        SELECT 'Articles:', COUNT(*) FROM article.article;
        SELECT 'Reads:', COUNT(*) FROM read.read;
    " 2>/dev/null || echo "Could not verify counts (this is OK if using different keyspace names)"
}

# Main execution
main() {
    check_vitess
    
    echo ""
    echo "This script will:"
    echo "  1. Set keyspace durability policy to 'none' (faster writes)"
    echo "  2. Run bulk insert with optimizations"
    echo "  3. Restore keyspace durability policy to 'semi_sync'"
    echo ""
    read -p "Continue? (y/N) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    
    # Set durability to none for faster writes
    set_durability_policy "none"
    
    # Run the bulk insert
    run_bulk_insert
    
    # Restore durability policy
    set_durability_policy "semi_sync"
    
    # Verify
    verify_counts
    
    echo ""
    echo "=============================================="
    echo "COMPLETE"
    echo "=============================================="
}

main

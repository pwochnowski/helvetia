#!/bin/bash
# Manage backup tablets (Cell3) without affecting core services
#
# Usage:
#   ./backup-tablets.sh up      # Start backup tablets
#   ./backup-tablets.sh down    # Stop and remove backup tablets
#   ./backup-tablets.sh stop    # Stop backup tablets (keep containers)
#   ./backup-tablets.sh restart # Restart backup tablets
#   ./backup-tablets.sh status  # Show status of backup tablets
#   ./backup-tablets.sh clean   # Remove backup tablet data directories (for fresh start)

set -e

BACKUP_SERVICES=(
    vtgate_cell3
    vttablet_user_shard1_backup
    vttablet_user_shard2_backup
    vttablet_article_shard1_backup
    vttablet_article_shard2_backup
    vttablet_read_shard1_backup
    vttablet_read_shard2_backup
    vttablet_beread_shard1_backup
    vttablet_beread_shard2_backup
    vttablet_popularrank_shard1_backup
    vttablet_popularrank_shard2_backup
    vttablet_popularrank_shard3_backup
)

usage() {
    echo "Usage: $0 {up|down|stop|restart|status|clean}"
    echo ""
    echo "Commands:"
    echo "  up      - Start backup tablets"
    echo "  down    - Stop and remove backup tablets"
    echo "  stop    - Stop backup tablets (keep containers)"
    echo "  restart - Restart backup tablets"
    echo "  status  - Show status of backup tablets"
    echo "  clean   - Remove backup tablet data directories (for fresh start)"
    exit 1
}

KEYSPACES=(
    user_keyspace
    article_keyspace
    read_keyspace
    beread_keyspace
    popularrank_keyspace
)

case "${1:-}" in
    up)
        echo "Setting up cell3 in topology..."
        # Add cell3 info to topology (ignore error if already exists)
        docker compose exec -T vtctld /vt/bin/vtctldclient --server localhost:15999 \
            AddCellInfo --root vitess/cell3 --server-address consul1:8500 cell3 2>/dev/null || true
        
        # Rebuild keyspace graph for cell3
        for keyspace in "${KEYSPACES[@]}"; do
            echo "  Rebuilding keyspace graph for $keyspace..."
            docker compose exec -T vtctld /vt/bin/vtctldclient --server localhost:15999 \
                RebuildKeyspaceGraph --cells=cell3 "$keyspace" 2>/dev/null || true
        done
        
        # Rebuild VSchema graph for cell3
        echo "  Rebuilding VSchema graph..."
        docker compose exec -T vtctld /vt/bin/vtctldclient --server localhost:15999 \
            RebuildVSchemaGraph --cells=cell3 2>/dev/null || true
        
        echo "Starting backup tablets..."
        docker compose up -d "${BACKUP_SERVICES[@]}"
        ;;
    down)
        echo "Stopping and removing backup tablets..."
        docker compose stop "${BACKUP_SERVICES[@]}"
        docker compose rm -f "${BACKUP_SERVICES[@]}"
        echo "Removing backup tablets from topology..."
        BACKUP_TABLET_ALIASES=(
            cell3-0000000102
            cell3-0000000602
            cell3-0000000202
            cell3-0000000712
            cell3-0000000302
            cell3-0000000802
            cell3-0000000402
            cell3-0000000912
            cell3-0000000502
            cell3-0000001002
            cell3-0000001012
        )
        for alias in "${BACKUP_TABLET_ALIASES[@]}"; do
            docker compose exec -T vtctld /vt/bin/vtctldclient --server localhost:15999 \
                DeleteTablets --allow-primary "$alias" 2>/dev/null || true
        done
        echo "Backup tablets removed from topology."
        
        echo "Removing cell3 from topology..."
        docker compose exec -T vtctld /vt/bin/vtctldclient --server localhost:15999 \
            DeleteCellInfo --force cell3 2>/dev/null || true
        echo "Cell3 removed from topology."
        ;;
    stop)
        echo "Stopping backup tablets..."
        docker compose stop "${BACKUP_SERVICES[@]}"
        ;;
    restart)
        echo "Restarting backup tablets..."
        docker compose restart "${BACKUP_SERVICES[@]}"
        ;;
    status)
        echo "Backup tablets status:"
        docker compose ps "${BACKUP_SERVICES[@]}"
        ;;
    clean)
        echo "Cleaning backup tablet data directories..."
        # Tablet UIDs for backup tablets
        BACKUP_TABLET_UIDS=(
            102   # user_shard1_backup
            602   # user_shard2_backup
            202   # article_shard1_backup
            712   # article_shard2_backup
            302   # read_shard1_backup
            802   # read_shard2_backup
            402   # beread_shard1_backup
            912   # beread_shard2_backup
            502   # popularrank_shard1_backup
            1002  # popularrank_shard2_backup
            1012  # popularrank_shard3_backup
        )
        
        # Remove data directories from running containers
        for i in "${!BACKUP_SERVICES[@]}"; do
            service="${BACKUP_SERVICES[$i]}"
            # Skip vtgate_cell3 (index 0)
            if [[ "$service" == "vtgate_cell3" ]]; then
                continue
            fi
            uid="${BACKUP_TABLET_UIDS[$((i-1))]}"
            printf -v tablet_dir 'vt_%010d' "$uid"
            echo "  Cleaning $service ($tablet_dir)..."
            docker compose exec -T "$service" rm -rf "/vt/vtdataroot/$tablet_dir" 2>/dev/null || true
        done
        
        # Stop and remove containers to ensure clean state
        echo "Removing backup tablet containers..."
        docker compose stop "${BACKUP_SERVICES[@]}" 2>/dev/null || true
        docker compose rm -f "${BACKUP_SERVICES[@]}" 2>/dev/null || true
        
        echo "Backup tablet data cleaned. Run './backup-tablets.sh up' for a fresh start."
        ;;
    *)
        usage
        ;;
esac

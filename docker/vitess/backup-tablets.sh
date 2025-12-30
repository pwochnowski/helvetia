#!/bin/bash
# Manage backup tablets (Cell3) without affecting core services
#
# Usage:
#   ./backup-tablets.sh up      # Start backup tablets
#   ./backup-tablets.sh down    # Stop and remove backup tablets
#   ./backup-tablets.sh stop    # Stop backup tablets (keep containers)
#   ./backup-tablets.sh restart # Restart backup tablets
#   ./backup-tablets.sh status  # Show status of backup tablets

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
    echo "Usage: $0 {up|down|stop|restart|status}"
    echo ""
    echo "Commands:"
    echo "  up      - Start backup tablets"
    echo "  down    - Stop and remove backup tablets"
    echo "  stop    - Stop backup tablets (keep containers)"
    echo "  restart - Restart backup tablets"
    echo "  status  - Show status of backup tablets"
    exit 1
}

case "${1:-}" in
    up)
        echo "Starting backup tablets..."
        docker compose up -d "${BACKUP_SERVICES[@]}"
        ;;
    down)
        echo "Stopping and removing backup tablets..."
        docker compose stop "${BACKUP_SERVICES[@]}"
        docker compose rm -f "${BACKUP_SERVICES[@]}"
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
    *)
        usage
        ;;
esac

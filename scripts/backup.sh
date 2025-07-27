#!/bin/bash

# PAN Parrot Backup and Maintenance Script
# This script handles backup, restore, and maintenance tasks

set -e

BACKUP_DIR="/opt/pan-parrot/backups"
APP_DIR="/opt/pan-parrot/app"
DATA_DIR="/opt/pan-parrot/data"
RETENTION_DAYS=30

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup
backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/panparrot_backup_$timestamp.tar.gz"
    
    log_info "Creating backup: $backup_file"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Stop services for consistent backup
    log_info "Stopping services..."
    cd "$APP_DIR"
    docker-compose stop
    
    # Create backup
    tar -czf "$backup_file" -C /opt/pan-parrot data/ app/docker-compose.yml app/.env 2>/dev/null || true
    
    # Restart services
    log_info "Restarting services..."
    docker-compose start
    
    log_info "Backup created: $backup_file"
    
    # Cleanup old backups
    cleanup_old_backups
}

# Restore from backup
restore() {
    local backup_file="$1"
    
    if [[ -z "$backup_file" ]]; then
        log_error "Please specify backup file to restore"
        list_backups
        exit 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warn "This will restore from backup and overwrite current data!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Restoring from: $backup_file"
    
    # Stop services
    cd "$APP_DIR"
    docker-compose down
    
    # Extract backup
    tar -xzf "$backup_file" -C /opt/pan-parrot
    
    # Start services
    docker-compose up -d
    
    log_info "Restore completed"
}

# List available backups
list_backups() {
    log_info "Available backups:"
    ls -la "$BACKUP_DIR"/*.tar.gz 2>/dev/null || echo "No backups found"
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "panparrot_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
}

# Update application
update() {
    log_info "Updating PAN Parrot..."
    
    # Create backup before update
    backup
    
    cd "$APP_DIR"
    
    # Pull latest code (if using git)
    if [[ -d ".git" ]]; then
        git pull origin main
    fi
    
    # Rebuild and restart
    docker-compose down
    docker-compose build
    docker-compose up -d
    
    log_info "Update completed"
}

# Show logs
logs() {
    cd "$APP_DIR"
    docker-compose logs -f
}

# Show status
status() {
    cd "$APP_DIR"
    docker-compose ps
    echo
    log_info "Service status:"
    systemctl status pan-parrot --no-pager
}

# Health check
health() {
    local endpoint="http://localhost:3000/api/ping"
    
    if curl -f -s "$endpoint" > /dev/null; then
        log_info "✅ PAN Parrot is healthy"
        return 0
    else
        log_error "❌ PAN Parrot health check failed"
        return 1
    fi
}

# Show help
show_help() {
    echo "PAN Parrot Maintenance Script"
    echo
    echo "Usage: $0 [command]"
    echo
    echo "Commands:"
    echo "  backup              Create a backup"
    echo "  restore [file]      Restore from backup"
    echo "  list-backups        List available backups"
    echo "  cleanup             Clean up old backups"
    echo "  update              Update the application"
    echo "  logs                Show application logs"
    echo "  status              Show service status"
    echo "  health              Run health check"
    echo "  help                Show this help"
    echo
}

# Main function
main() {
    case "${1:-help}" in
        backup)
            backup
            ;;
        restore)
            restore "$2"
            ;;
        list-backups)
            list_backups
            ;;
        cleanup)
            cleanup_old_backups
            ;;
        update)
            update
            ;;
        logs)
            logs
            ;;
        status)
            status
            ;;
        health)
            health
            ;;
        help|*)
            show_help
            ;;
    esac
}

main "$@"

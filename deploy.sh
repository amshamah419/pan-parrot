#!/bin/bash
# UNSUPPORTED. PAN Parrot deploys on Netlify. See DEPLOYMENT.md.
# This script is not maintained. Exit so it cannot be run by accident.
echo "This deploy script is unsupported. Read DEPLOYMENT.md." >&2
exit 1

# PAN Parrot Deployment Script
# This script helps deploy PAN Parrot to your internal infrastructure

set -e

echo "🦜 PAN Parrot Deployment Script"
echo "================================"

# Configuration
APP_NAME="pan-parrot"
DEPLOY_DIR="/opt/pan-parrot"
SERVICE_USER="panparrot"
BACKUP_DIR="/opt/pan-parrot/backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Update package list
    apt-get update
    
    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        log_info "Installing Docker..."
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker
        systemctl start docker
    fi
    
    # Install Docker Compose if not present
    if ! command -v docker-compose &> /dev/null; then
        log_info "Installing Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
    
    # Install other utilities
    apt-get install -y wget curl jq nginx-utils
}

# Create system user
create_user() {
    if ! id "$SERVICE_USER" &>/dev/null; then
        log_info "Creating service user: $SERVICE_USER"
        useradd -r -s /bin/false -d $DEPLOY_DIR $SERVICE_USER
        usermod -aG docker $SERVICE_USER
    fi
}

# Setup directories
setup_directories() {
    log_info "Setting up directories..."
    
    mkdir -p $DEPLOY_DIR
    mkdir -p $BACKUP_DIR
    mkdir -p $DEPLOY_DIR/data
    mkdir -p $DEPLOY_DIR/logs
    
    chown -R $SERVICE_USER:$SERVICE_USER $DEPLOY_DIR
    chmod 750 $DEPLOY_DIR
}

# Deploy application
deploy_app() {
    log_info "Deploying PAN Parrot..."
    
    # Copy application files
    cp -r . $DEPLOY_DIR/app/
    chown -R $SERVICE_USER:$SERVICE_USER $DEPLOY_DIR/app/
    
    # Build and start containers
    cd $DEPLOY_DIR/app
    
    log_info "Building Docker images..."
    docker-compose build
    
    log_info "Starting services..."
    docker-compose up -d
    
    # Wait for health check
    log_info "Waiting for application to be ready..."
    sleep 10
    
    if docker-compose ps | grep -q "Up (healthy)"; then
        log_info "✅ PAN Parrot deployed successfully!"
    else
        log_error "❌ Deployment failed. Check logs with: docker-compose logs"
        exit 1
    fi
}

# Create systemd service
create_systemd_service() {
    log_info "Creating systemd service..."
    
    cat > /etc/systemd/system/pan-parrot.service << EOF
[Unit]
Description=PAN Parrot HTTP Debugging Tool
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$DEPLOY_DIR/app
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0
User=$SERVICE_USER
Group=$SERVICE_USER

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable pan-parrot
    systemctl start pan-parrot
}

# Setup firewall (if ufw is installed)
setup_firewall() {
    if command -v ufw &> /dev/null; then
        log_info "Configuring firewall..."
        ufw allow 80/tcp
        ufw allow 443/tcp
        # Only allow from internal networks - adjust as needed
        # ufw allow from 10.0.0.0/8 to any port 3000
        # ufw allow from 172.16.0.0/12 to any port 3000
        # ufw allow from 192.168.0.0/16 to any port 3000
    fi
}

# Main deployment function
main() {
    echo
    log_info "Starting PAN Parrot deployment..."
    echo
    
    check_root
    install_dependencies
    create_user
    setup_directories
    deploy_app
    create_systemd_service
    setup_firewall
    
    echo
    log_info "🎉 PAN Parrot deployment completed!"
    echo
    echo "📋 Next steps:"
    echo "  1. Configure your internal DNS to point to this server"
    echo "  2. Set up SSL certificates (recommended)"
    echo "  3. Configure firewall rules for your network"
    echo "  4. Access PAN Parrot at: http://$(hostname -I | awk '{print $1}')"
    echo
    echo "🔧 Management commands:"
    echo "  - Start:   systemctl start pan-parrot"
    echo "  - Stop:    systemctl stop pan-parrot"
    echo "  - Restart: systemctl restart pan-parrot"
    echo "  - Status:  systemctl status pan-parrot"
    echo "  - Logs:    docker-compose -f $DEPLOY_DIR/app/docker-compose.yml logs"
    echo
}

# Run main function
main "$@"

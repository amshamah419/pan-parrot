# PAN Parrot Deployment Guide

This guide covers deploying PAN Parrot as an internal tool within your corporate network.

## 🏗️ Deployment Options

### Option 1: Docker Compose (Recommended for Simple Setups)

**Best for**: Small teams, single server deployment, quick setup

```bash
# 1. Clone/copy the application
git clone <your-repo> /opt/pan-parrot
cd /opt/pan-parrot

# 2. Configure environment
cp .env.production .env
# Edit .env with your settings

# 3. Deploy using the automated script
chmod +x deploy.sh
sudo ./deploy.sh

# 4. Access at http://your-server-ip:3000
```

**Advantages**:
- Simple setup and maintenance
- Includes Nginx reverse proxy
- Automatic SSL configuration
- Built-in backup system

### Option 2: Kubernetes (Recommended for Enterprise)

**Best for**: Large deployments, high availability, existing K8s infrastructure

```bash
# 1. Build and push Docker image to your registry
docker build -t your-registry/pan-parrot:latest .
docker push your-registry/pan-parrot:latest

# 2. Update image reference in k8s/deployment.yaml
sed -i 's|pan-parrot:latest|your-registry/pan-parrot:latest|' k8s/deployment.yaml

# 3. Deploy to Kubernetes
kubectl apply -f k8s/deployment.yaml

# 4. Configure ingress with your domain
kubectl patch ingress pan-parrot-ingress -n pan-parrot -p '{"spec":{"rules":[{"host":"parrot.your-domain.com"}]}}'
```

**Advantages**:
- High availability with multiple replicas
- Automatic scaling and healing
- Network policies for security
- Enterprise-grade monitoring

### Option 3: Traditional VM Deployment

**Best for**: Existing VM infrastructure, security-sensitive environments

```bash
# 1. Install Node.js 18+ on your VM
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Create application user
sudo useradd -r -s /bin/false panparrot
sudo mkdir -p /opt/pan-parrot
sudo chown panparrot:panparrot /opt/pan-parrot

# 3. Deploy application
sudo -u panparrot cp -r . /opt/pan-parrot/
cd /opt/pan-parrot
sudo -u panparrot npm ci --production
sudo -u panparrot npm run build

# 4. Create systemd service
sudo cp systemd/pan-parrot.service /etc/systemd/system/
sudo systemctl enable pan-parrot
sudo systemctl start pan-parrot
```

## 🔧 Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Network & Security
DOMAIN=parrot.your-domain.com
CORS_ORIGIN=https://parrot.your-domain.com
ALLOWED_NETWORKS=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16

# SSL Configuration
HTTPS_ENABLED=true
SSL_CERT_PATH=/opt/pan-parrot/certs/cert.pem
SSL_KEY_PATH=/opt/pan-parrot/certs/key.pem

# Admin Account
ADMIN_EMAIL=ashamah@paloaltonetworks.com
ADMIN_PASSWORD=your-secure-password

# Security
SESSION_SECRET=your-32-character-secret-key
RATE_LIMIT_MAX_REQUESTS=100
```

### SSL Certificate Setup

For internal CA or self-signed certificates:

```bash
# Generate self-signed certificate (for testing)
mkdir -p /opt/pan-parrot/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /opt/pan-parrot/certs/key.pem \
  -out /opt/pan-parrot/certs/cert.pem \
  -subj "/C=US/ST=CA/L=Santa Clara/O=Palo Alto Networks/CN=parrot.pan.internal"

# Or use your internal CA certificate
cp your-ca-cert.pem /opt/pan-parrot/certs/cert.pem
cp your-ca-key.pem /opt/pan-parrot/certs/key.pem
chmod 600 /opt/pan-parrot/certs/*
```

## 🔒 Security Considerations

### Network Security

1. **Firewall Configuration**:
   ```bash
   # Allow only internal networks
   sudo ufw deny in on eth0
   sudo ufw allow from 10.0.0.0/8 to any port 80,443
   sudo ufw allow from 172.16.0.0/12 to any port 80,443
   sudo ufw allow from 192.168.0.0/16 to any port 80,443
   ```

2. **DNS Configuration**:
   - Add internal DNS record: `parrot.pan.internal → your-server-ip`
   - Use internal certificate authority
   - Consider split-horizon DNS

3. **Reverse Proxy Configuration**:
   - Rate limiting (included in nginx.conf)
   - Request size limits
   - IP whitelisting
   - SSL termination

### Application Security

1. **User Management**:
   - Disable self-registration in production
   - Use strong passwords
   - Regular user audit
   - Role-based access control

2. **Data Protection**:
   - Encrypt data at rest (if using persistent storage)
   - Regular backups
   - Audit logging
   - Request data retention policies

## 📊 Monitoring & Maintenance

### Health Monitoring

```bash
# Check application health
curl http://localhost:3000/api/ping

# Docker health check
docker-compose ps

# Kubernetes health check
kubectl get pods -n pan-parrot
kubectl describe pod <pod-name> -n pan-parrot
```

### Backup & Recovery

Using the included backup script:

```bash
# Create backup
./scripts/backup.sh backup

# List backups
./scripts/backup.sh list-backups

# Restore from backup
./scripts/backup.sh restore /opt/pan-parrot/backups/panparrot_backup_20241201_143022.tar.gz
```

### Log Management

```bash
# View application logs
docker-compose logs -f pan-parrot

# System logs
journalctl -u pan-parrot -f

# Kubernetes logs
kubectl logs -f deployment/pan-parrot -n pan-parrot
```

## 🔄 Updates & Upgrades

### Docker Compose Updates

```bash
# Automated update
./scripts/backup.sh update

# Manual update
cd /opt/pan-parrot
docker-compose down
git pull origin main  # or copy new files
docker-compose build
docker-compose up -d
```

### Kubernetes Updates

```bash
# Update image
kubectl set image deployment/pan-parrot pan-parrot=your-registry/pan-parrot:v1.1.0 -n pan-parrot

# Rolling update with zero downtime
kubectl rollout status deployment/pan-parrot -n pan-parrot
```

## 🚨 Troubleshooting

### Common Issues

1. **Application won't start**:
   ```bash
   # Check logs
   docker-compose logs pan-parrot
   
   # Check permissions
   ls -la /opt/pan-parrot/
   
   # Check port conflicts
   netstat -tulpn | grep :3000
   ```

2. **Cannot access from network**:
   - Check firewall rules
   - Verify internal DNS resolution
   - Check nginx configuration
   - Verify SSL certificates

3. **Performance issues**:
   - Monitor resource usage: `docker stats`
   - Check application logs for errors
   - Verify database connections
   - Monitor request rates

### Emergency Procedures

1. **Complete service restart**:
   ```bash
   systemctl restart pan-parrot
   # or
   docker-compose restart
   ```

2. **Emergency rollback**:
   ```bash
   ./scripts/backup.sh restore <last-good-backup>
   ```

3. **Emergency shutdown**:
   ```bash
   systemctl stop pan-parrot
   docker-compose down
   ```

## 📞 Support

For deployment issues:

1. Check this documentation
2. Review application logs
3. Check system resources
4. Verify network connectivity
5. Contact your infrastructure team

## 🎯 Production Checklist

Before going live:

- [ ] SSL certificates configured
- [ ] Internal DNS configured
- [ ] Firewall rules applied
- [ ] User accounts created
- [ ] Backup system tested
- [ ] Monitoring configured
- [ ] Emergency procedures documented
- [ ] Team training completed
- [ ] Security review completed
- [ ] Performance testing done

---

**Security Note**: PAN Parrot is designed for internal use only. Never expose it to the public internet without proper security measures.

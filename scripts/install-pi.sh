#!/bin/bash

# LSLT WiFi Loyalty Portal - Raspberry Pi Installer
# This script sets up the LSLT portal on a Raspberry Pi 4/5
# It removes Pi-hole if present and configures the system for captive portal operation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LSLT_USER="lslt"
LSLT_HOME="/home/$LSLT_USER"
LSLT_DIR="$LSLT_HOME/lslt-portal"
NODE_VERSION="18"
SERVICE_NAME="lslt-portal"

# Logging
LOG_FILE="/var/log/lslt-install.log"
exec > >(tee -a $LOG_FILE)
exec 2>&1

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                LSLT WiFi Loyalty Portal Installer           ║${NC}"
echo -e "${BLUE}║                     Raspberry Pi Setup                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    echo -e "${YELLOW}Warning: This doesn't appear to be a Raspberry Pi${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}Starting LSLT Portal installation...${NC}"

# Function to print step headers
print_step() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
    echo "----------------------------------------"
}

# Function to handle errors
handle_error() {
    echo -e "${RED}Error: $1${NC}"
    echo "Check the log file: $LOG_FILE"
    exit 1
}

# Update system
print_step "Updating system packages"
apt update || handle_error "Failed to update package lists"
apt upgrade -y || handle_error "Failed to upgrade packages"

# Remove Pi-hole if present
print_step "Checking for and removing Pi-hole"
if command -v pihole &> /dev/null; then
    echo -e "${YELLOW}Pi-hole detected. Removing...${NC}"
    
    # Stop Pi-hole services
    systemctl stop pihole-FTL 2>/dev/null || true
    systemctl disable pihole-FTL 2>/dev/null || true
    
    # Remove Pi-hole using its uninstaller if available
    if [ -f /opt/pihole/uninstall.sh ]; then
        echo "yes" | /opt/pihole/uninstall.sh
    fi
    
    # Manual cleanup
    rm -rf /opt/pihole /etc/pihole /var/log/pihole* 2>/dev/null || true
    rm -f /etc/systemd/system/pihole-FTL.service 2>/dev/null || true
    
    # Remove Pi-hole user and group
    userdel pihole 2>/dev/null || true
    groupdel pihole 2>/dev/null || true
    
    # Clean up DNS settings
    sed -i '/pihole/d' /etc/dhcpcd.conf 2>/dev/null || true
    sed -i '/Pi-hole/d' /etc/dhcpcd.conf 2>/dev/null || true
    
    echo -e "${GREEN}Pi-hole removed successfully${NC}"
else
    echo "Pi-hole not found, continuing..."
fi

# Install required system packages
print_step "Installing system dependencies"
apt install -y \
    curl \
    git \
    build-essential \
    python3-dev \
    python3-pip \
    sqlite3 \
    nginx \
    ufw \
    hostapd \
    dnsmasq \
    iptables-persistent \
    netfilter-persistent \
    avahi-daemon \
    cups \
    printer-driver-escpos \
    || handle_error "Failed to install system packages"

# Install Node.js
print_step "Installing Node.js $NODE_VERSION"
if ! command -v node &> /dev/null || [[ $(node --version | cut -d'v' -f2 | cut -d'.' -f1) -lt $NODE_VERSION ]]; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - || handle_error "Failed to add NodeSource repository"
    apt install -y nodejs || handle_error "Failed to install Node.js"
fi

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Create LSLT user
print_step "Creating LSLT user account"
if ! id "$LSLT_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$LSLT_USER" || handle_error "Failed to create user $LSLT_USER"
    usermod -aG sudo,www-data,lp "$LSLT_USER"
    echo -e "${GREEN}User $LSLT_USER created${NC}"
else
    echo "User $LSLT_USER already exists"
fi

# Clone or update LSLT repository
print_step "Setting up LSLT Portal code"
if [ -d "$LSLT_DIR" ]; then
    echo "LSLT directory exists, updating..."
    cd "$LSLT_DIR"
    sudo -u "$LSLT_USER" git pull origin main || handle_error "Failed to update repository"
else
    echo "Cloning LSLT repository..."
    sudo -u "$LSLT_USER" git clone https://github.com/lslt-systems/wifi-loyalty-portal.git "$LSLT_DIR" || handle_error "Failed to clone repository"
fi

cd "$LSLT_DIR"
chown -R "$LSLT_USER:$LSLT_USER" "$LSLT_DIR"

# Install Node.js dependencies
print_step "Installing Node.js dependencies"
sudo -u "$LSLT_USER" npm install || handle_error "Failed to install backend dependencies"
cd frontend
sudo -u "$LSLT_USER" npm install || handle_error "Failed to install frontend dependencies"
sudo -u "$LSLT_USER" npm run build || handle_error "Failed to build frontend"
cd ..

# Create directories
print_step "Creating application directories"
mkdir -p /var/log/lslt
mkdir -p /etc/lslt
mkdir -p "$LSLT_DIR/data"
mkdir -p "$LSLT_DIR/logs"
mkdir -p "$LSLT_DIR/uploads"

chown -R "$LSLT_USER:$LSLT_USER" /var/log/lslt "$LSLT_DIR"

# Configure environment
print_step "Setting up environment configuration"
cat > /etc/lslt/config.env << EOF
# LSLT Portal Configuration
NODE_ENV=production
PORT=8080

# Database
DB_PATH=/home/$LSLT_USER/lslt-portal/data/lslt_portal.db

# UniFi Controller Settings
UNIFI_HOST=192.168.1.1
UNIFI_PORT=443
UNIFI_USERNAME=admin
UNIFI_PASSWORD=
UNIFI_SITE=default
UNIFI_STRICT_SSL=false

# Security
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=24h

# Email Settings (configure after installation)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@lslt-portal.local

# Logging
LOG_LEVEL=info

# Network Settings
CAPTIVE_PORTAL_IP=192.168.4.1
GUEST_NETWORK_INTERFACE=wlan1
EOF

chown "$LSLT_USER:$LSLT_USER" /etc/lslt/config.env
chmod 600 /etc/lslt/config.env

# Setup systemd service
print_step "Creating systemd service"
cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=LSLT WiFi Loyalty Portal
After=network.target
Wants=network.target

[Service]
Type=simple
User=$LSLT_USER
Group=$LSLT_USER
WorkingDirectory=$LSLT_DIR
ExecStart=/usr/bin/node server.js
EnvironmentFile=/etc/lslt/config.env
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=lslt-portal

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$LSLT_DIR /var/log/lslt /tmp

[Install]
WantedBy=multi-user.target
EOF

# Configure Nginx
print_step "Configuring Nginx"
cat > /etc/nginx/sites-available/lslt-portal << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    
    # Captive portal detection endpoints
    location ~ ^/(generate_204|hotspot-detect\.html|library/test/success\.html|connecttest\.txt|ncsi\.txt)$ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Client-Mac $http_x_client_mac;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files and frontend
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Handle captive portal redirects
        proxy_intercept_errors on;
        error_page 404 = @portal;
    }
    
    location @portal {
        return 302 http://$host/portal;
    }
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
}
EOF

# Remove default nginx site and enable LSLT
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/lslt-portal /etc/nginx/sites-enabled/
nginx -t || handle_error "Nginx configuration test failed"

# Configure firewall
print_step "Configuring firewall"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Allow essential services
ufw allow ssh
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS (for UniFi communication)
ufw allow 53/tcp    # DNS
ufw allow 53/udp    # DNS
ufw allow 67/udp    # DHCP
ufw allow 68/udp    # DHCP

# Allow printing
ufw allow 631/tcp   # CUPS
ufw allow 9100/tcp  # Direct IP printing

ufw --force enable

# Configure IP forwarding for captive portal
print_step "Configuring network settings"
echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.conf
echo 'net.ipv6.conf.all.forwarding=1' >> /etc/sysctl.conf
sysctl -p

# Set up iptables rules for captive portal redirection
cat > /etc/iptables/rules.v4 << EOF
*nat
:PREROUTING ACCEPT [0:0]
:INPUT ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]
:POSTROUTING ACCEPT [0:0]

# Captive portal redirection for HTTP traffic
-A PREROUTING -i wlan1 -p tcp --dport 80 -j DNAT --to-destination 192.168.4.1:80
-A PREROUTING -i wlan1 -p tcp --dport 443 -j DNAT --to-destination 192.168.4.1:80

COMMIT

*filter
:INPUT ACCEPT [0:0]
:FORWARD ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]

# Allow established connections
-A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
-A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow loopback
-A INPUT -i lo -j ACCEPT

# Allow SSH
-A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP and HTTPS
-A INPUT -p tcp --dport 80 -j ACCEPT
-A INPUT -p tcp --dport 443 -j ACCEPT

# Allow DNS
-A INPUT -p tcp --dport 53 -j ACCEPT
-A INPUT -p udp --dport 53 -j ACCEPT

# Allow DHCP
-A INPUT -p udp --dport 67:68 -j ACCEPT

# Allow ping
-A INPUT -p icmp --icmp-type echo-request -j ACCEPT

COMMIT
EOF

# Initialize database
print_step "Initializing database"
cd "$LSLT_DIR"
sudo -u "$LSLT_USER" node -e "
const { sequelize } = require('./models');
const { initializeDefaultRewards } = require('./utils/loyalty');

async function init() {
  try {
    await sequelize.sync({ force: false });
    await initializeDefaultRewards();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

init();
" || handle_error "Failed to initialize database"

# Enable and start services
print_step "Starting services"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl enable nginx
systemctl restart nginx
systemctl start "$SERVICE_NAME"

# Wait for service to start
sleep 5

# Check service status
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}LSLT Portal service started successfully${NC}"
else
    handle_error "LSLT Portal service failed to start"
fi

# Create admin user script
print_step "Creating admin setup script"
cat > "$LSLT_HOME/create-admin.js" << 'EOF'
const readline = require('readline');
const { Staff } = require('./lslt-portal/models');
const { hashPassword } = require('./lslt-portal/middleware/auth');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createAdmin() {
  try {
    console.log('\n=== LSLT Portal Admin Setup ===\n');
    
    const name = await new Promise(resolve => {
      rl.question('Enter admin name: ', resolve);
    });
    
    const email = await new Promise(resolve => {
      rl.question('Enter admin email: ', resolve);
    });
    
    const pin = await new Promise(resolve => {
      rl.question('Enter admin PIN (min 4 digits): ', resolve);
    });
    
    if (pin.length < 4) {
      throw new Error('PIN must be at least 4 digits');
    }
    
    const hashedPin = await hashPassword(pin);
    
    const admin = await Staff.create({
      name,
      email,
      pin: hashedPin,
      role: 'admin',
      isActive: true
    });
    
    console.log(`\nAdmin user created successfully!`);
    console.log(`Name: ${name}`);
    console.log(`Email: ${email}`);
    console.log(`Role: admin`);
    console.log(`\nYou can now access the admin portal at: http://your-pi-ip/admin`);
    
  } catch (error) {
    console.error('Error creating admin:', error.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

createAdmin();
EOF

chown "$LSLT_USER:$LSLT_USER" "$LSLT_HOME/create-admin.js"

# Final status check
print_step "Installation verification"
PORTAL_URL="http://localhost"
if curl -s "$PORTAL_URL" > /dev/null; then
    echo -e "${GREEN}✓ Portal is accessible${NC}"
else
    echo -e "${YELLOW}⚠ Portal may not be fully ready yet${NC}"
fi

# Get IP address
PI_IP=$(hostname -I | awk '{print $1}')

# Installation complete
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 Installation Complete!                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}LSLT WiFi Loyalty Portal has been installed successfully!${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Configure UniFi settings in: /etc/lslt/config.env"
echo "2. Create admin user: sudo -u $LSLT_USER node $LSLT_HOME/create-admin.js"
echo "3. Access the portal: http://$PI_IP"
echo "4. Admin portal: http://$PI_IP/admin"
echo "5. Staff portal: http://$PI_IP/staff"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "- Configure your UniFi credentials in /etc/lslt/config.env"
echo "- Set up email SMTP settings for voucher delivery"
echo "- Configure your guest WiFi network to redirect to this Pi"
echo "- Check firewall rules if experiencing connectivity issues"
echo ""
echo -e "${BLUE}Service Management:${NC}"
echo "- Status: sudo systemctl status $SERVICE_NAME"
echo "- Restart: sudo systemctl restart $SERVICE_NAME"
echo "- Logs: sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo -e "${GREEN}Installation log saved to: $LOG_FILE${NC}"
echo ""
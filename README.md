# LSLT WiFi Loyalty & Captive Portal Suite

A comprehensive WiFi loyalty and captive portal system designed for Raspberry Pi 4/5 with UniFi Dream Machine integration. This system provides guest WiFi access with loyalty rewards, staff management, admin controls, and comprehensive audit logging.

## 🌟 Features

### Core Functionality
- **Captive Portal**: Automatic redirection for guest WiFi users
- **Bilingual Support**: Full English/Spanish interface
- **Loyalty Program**: Tier-based rewards system (Bronze, Silver, Gold, Platinum)
- **Device Management**: User device limits and tracking
- **Staff Portal**: Voucher redemption and WiFi management
- **Admin Dashboard**: Complete system management and reporting
- **Security**: Comprehensive abuse prevention and audit logging

### Technical Features
- **UniFi Integration**: Direct API control of Dream Machine
- **Printer Support**: 80mm receipt, A4, and label printers
- **QR Code Vouchers**: Automated voucher generation and email delivery
- **Real-time Monitoring**: Live statistics and user tracking
- **Audit Trail**: Complete logging of all system actions
- **Campaign Management**: Automated marketing and re-engagement

## 🏗️ Architecture

### Hardware Requirements
- **Raspberry Pi 4 or 5** (recommended: 4GB+ RAM)
- **UniFi Dream Machine** or **UDM SE**
- **Network Printers** (80mm receipt printer, HP A4 printer, optional label printer)
- **Tablets/PCs** for staff access

### Network Topology
```
Internet ←→ UniFi UDM ←→ Ethernet ←→ Raspberry Pi 4/5
                ↓
           Guest WiFi Network
                ↓
         User Devices (Captive Portal)
```

### Software Stack
- **Backend**: Node.js/Express, SQLite/PostgreSQL
- **Frontend**: React.js, Tailwind CSS, Framer Motion
- **Authentication**: JWT with role-based access
- **APIs**: UniFi Controller, SMTP, QR/Barcode generation
- **Deployment**: Systemd service, Nginx reverse proxy

## 🚀 Quick Installation (Raspberry Pi)

### Prerequisites
- Raspberry Pi 4/5 with Raspberry Pi OS
- Network connection to UniFi Dream Machine
- Git and curl installed

### One-Command Installation
```bash
curl -sSL https://raw.githubusercontent.com/lslt-systems/wifi-loyalty-portal/main/scripts/install-pi.sh | sudo bash
```

### Manual Installation Steps

1. **Clone Repository**
```bash
git clone https://github.com/lslt-systems/wifi-loyalty-portal.git
cd wifi-loyalty-portal
```

2. **Run Installer**
```bash
sudo chmod +x scripts/install-pi.sh
sudo ./scripts/install-pi.sh
```

3. **Configure UniFi Settings**
```bash
sudo nano /etc/lslt/config.env
```

4. **Create Admin User**
```bash
sudo -u lslt node /home/lslt/create-admin.js
```

5. **Access Portal**
- Portal: `http://your-pi-ip/portal`
- Admin: `http://your-pi-ip/admin`
- Staff: `http://your-pi-ip/staff`

## 📋 Configuration

### UniFi Controller Setup
Edit `/etc/lslt/config.env`:
```bash
UNIFI_HOST=192.168.1.1
UNIFI_PORT=443
UNIFI_USERNAME=admin
UNIFI_PASSWORD=your_password
UNIFI_SITE=default
```

### Email Configuration
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@yourdomain.com
```

### Network Settings
```bash
CAPTIVE_PORTAL_IP=192.168.4.1
GUEST_NETWORK_INTERFACE=wlan1
```

## 🎯 User Flows

### Guest User Journey
1. **Connect to WiFi** → Automatic captive portal redirect
2. **Language Selection** → Choose English or Spanish
3. **Signup/Login** → Create account or login with email/DOB
4. **Marketing Consent** → Optional opt-in for rewards
5. **WiFi Access** → Immediate internet access with 750MB limit
6. **Loyalty Progress** → View tier status and next rewards

### Staff Workflow
1. **Staff Login** → PIN-based authentication on tablet
2. **Voucher Scanning** → QR/barcode scanner for redemption
3. **Premium WiFi** → Issue paid WiFi vouchers
4. **Staff WiFi** → Daily staff WiFi voucher (1 per day limit)
5. **Audit Trail** → All actions logged automatically

### Admin Functions
1. **Dashboard** → Real-time metrics and user statistics
2. **User Management** → View, block, unblock users and devices
3. **Reward Configuration** → Set up loyalty tiers and rewards
4. **Campaign Management** → Email marketing and promotions
5. **Report Generation** → Export usage and audit reports
6. **System Settings** → Configure printers, networks, branding

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/signup` - Guest user registration
- `POST /api/auth/login` - Guest user login
- `POST /api/auth/staff/login` - Staff authentication

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/vouchers` - Get user vouchers
- `GET /api/users/loyalty` - Get loyalty status

### Staff Operations
- `POST /api/staff/voucher/redeem` - Redeem voucher
- `POST /api/staff/voucher/issue` - Issue premium voucher
- `POST /api/staff/wifi/request` - Request staff WiFi

### Admin Functions
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/users` - User management
- `POST /api/admin/rewards` - Reward configuration
- `GET /api/admin/audit` - Audit log access

## 🔒 Security Features

### Abuse Prevention
- **Rate Limiting**: API endpoint protection
- **Device Blocking**: Automatic blocking after failed attempts
- **IP Blocking**: Temporary blocks for suspicious activity
- **Pattern Detection**: SQL injection, XSS, path traversal protection

### Authentication
- **JWT Tokens**: Secure session management
- **PIN Protection**: Staff access with failed attempt tracking
- **Role-Based Access**: Admin, Manager, Staff permissions
- **Device Limits**: Maximum 2 devices per user account

### Audit Logging
- **Complete Trail**: All actions logged with timestamps
- **Security Alerts**: Suspicious activity notifications
- **Data Retention**: Configurable log retention periods
- **Export Capability**: Audit reports for compliance

## 🖨️ Printer Integration

### Supported Printers
- **80mm Receipt Printers**: ESC/POS compatible
- **A4 Network Printers**: HP and compatible models
- **Label Printers**: Optional voucher label printing

### Printer Configuration
```javascript
// Admin portal printer setup
{
  "name": "Receipt Printer",
  "type": "receipt",
  "ipAddress": "192.168.1.100",
  "port": 9100,
  "settings": {
    "paperWidth": 80,
    "charset": "utf8"
  }
}
```

## 📊 Loyalty System

### Tier Structure
- **Bronze** (0-4 visits): 750MB data, basic access
- **Silver** (5-14 visits): 1.5GB data, 10% discounts
- **Gold** (15-29 visits): 3GB data, 15% discounts, priority support
- **Platinum** (30+ visits): Unlimited data, 20% discounts, VIP support

### Reward Triggers
- **Visit Count**: Rewards at specific visit milestones
- **Tier Upgrades**: Special rewards when advancing tiers
- **Birthday**: Automatic birthday rewards
- **Referrals**: Rewards for bringing new customers

### Family Groups
- **Group Rewards**: Family-based loyalty benefits
- **Shared Progress**: Combined visit counts
- **Group Admin**: Family head can manage members

## 🌐 Network Configuration

### UniFi Setup
1. **Guest Network**: Create isolated guest WiFi
2. **Captive Portal**: Configure hotspot with external portal
3. **Firewall Rules**: Allow traffic to Pi, block direct internet
4. **DHCP**: Point guest DNS to Pi IP address

### Raspberry Pi Network
```bash
# Configure as captive portal gateway
iptables -t nat -A PREROUTING -i wlan1 -p tcp --dport 80 -j DNAT --to-destination 192.168.4.1:80
iptables -t nat -A PREROUTING -i wlan1 -p tcp --dport 443 -j DNAT --to-destination 192.168.4.1:80
```

## 📈 Monitoring & Analytics

### Real-time Metrics
- **Connected Users**: Current WiFi users
- **Data Usage**: Real-time bandwidth monitoring
- **Tier Distribution**: User loyalty tier breakdown
- **Voucher Activity**: Redemption rates and trends

### Reports
- **Daily/Weekly/Monthly**: Usage statistics
- **Loyalty Analytics**: Tier progression and rewards
- **Security Reports**: Blocked devices and attempts
- **Audit Exports**: Compliance and security auditing

## 🔄 Backup & Recovery

### Automated Backups
```bash
# Daily database backup
0 2 * * * /home/lslt/lslt-portal/scripts/backup-db.sh

# Weekly full backup
0 3 * * 0 /home/lslt/lslt-portal/scripts/full-backup.sh
```

### Manual Backup
```bash
# Backup database
sudo -u lslt sqlite3 /home/lslt/lslt-portal/data/lslt_portal.db ".backup /backup/lslt_$(date +%Y%m%d).db"

# Backup configuration
sudo cp -r /etc/lslt /backup/config_$(date +%Y%m%d)/
```

## 🛠️ Troubleshooting

### Common Issues

**Portal Not Loading**
```bash
# Check service status
sudo systemctl status lslt-portal

# Check logs
sudo journalctl -u lslt-portal -f

# Restart service
sudo systemctl restart lslt-portal
```

**UniFi Connection Issues**
```bash
# Test connection
curl -k https://192.168.1.1/api/login

# Check credentials in config
sudo nano /etc/lslt/config.env
```

**Database Issues**
```bash
# Check database integrity
sudo -u lslt sqlite3 /home/lslt/lslt-portal/data/lslt_portal.db "PRAGMA integrity_check;"

# Reset database (caution: loses data)
sudo systemctl stop lslt-portal
sudo -u lslt rm /home/lslt/lslt-portal/data/lslt_portal.db
sudo systemctl start lslt-portal
```

### Performance Optimization

**Raspberry Pi 4 Optimization**
```bash
# Increase GPU memory split
echo "gpu_mem=128" >> /boot/config.txt

# Enable performance governor
echo "performance" > /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor

# Optimize I/O scheduler
echo "deadline" > /sys/block/mmcblk0/queue/scheduler
```

## 📞 Support

### Service Management
```bash
# Status check
sudo systemctl status lslt-portal

# Restart service
sudo systemctl restart lslt-portal

# View logs
sudo journalctl -u lslt-portal -f --lines=100

# Configuration
sudo nano /etc/lslt/config.env
```

### Log Locations
- **Application Logs**: `/home/lslt/lslt-portal/logs/`
- **System Logs**: `/var/log/lslt/`
- **Installation Log**: `/var/log/lslt-install.log`
- **Nginx Logs**: `/var/log/nginx/`

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📚 Documentation

- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Configuration Reference](docs/CONFIGURATION.md)
- [Security Guidelines](docs/SECURITY.md)

## 🔗 Links

- **Repository**: https://github.com/lslt-systems/wifi-loyalty-portal
- **Issues**: https://github.com/lslt-systems/wifi-loyalty-portal/issues
- **Documentation**: https://docs.lslt-portal.com

---

**LSLT WiFi Loyalty Portal** - Transform your guest WiFi into a powerful customer engagement platform.
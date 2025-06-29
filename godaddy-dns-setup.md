# GoDaddy DNS Setup for Resend Email Verification

## Step-by-Step Instructions for tinymanager.ai

### Access GoDaddy DNS Management

1. **Log into GoDaddy**
   - Go to godaddy.com
   - Sign in to your account

2. **Navigate to DNS Management**
   - Click "My Products" 
   - Find "tinymanager.ai" in your domain list
   - Click "DNS" button next to the domain

### Add Required DNS Records

You need to add exactly 4 DNS records. Here's how:

#### Record 1: MX Record
1. Click "Add" button
2. Select "MX" from Type dropdown
3. **Name**: `send`
4. **Value**: `feedback-setup.us-east-1.amazonses.com`
5. **Priority**: `10`
6. **TTL**: Leave as "1 Hour" or change to "Custom" and enter `3600`
7. Click "Save"

#### Record 2: SPF TXT Record  
1. Click "Add" button
2. Select "TXT" from Type dropdown
3. **Name**: `send`
4. **Value**: `v=spf1 include:amazonses.com ~all`
5. **TTL**: Leave as "1 Hour"
6. Click "Save"

#### Record 3: DKIM TXT Record
1. Click "Add" button
2. Select "TXT" from Type dropdown
3. **Name**: `resend._domainkey`
4. **Value**: `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC5W9Z5qKZ8F9qK5V...` 
   (Copy the exact long string from your Resend dashboard)
5. **TTL**: Leave as "1 Hour"
6. Click "Save"

#### Record 4: DMARC TXT Record
1. Click "Add" button
2. Select "TXT" from Type dropdown
3. **Name**: `_dmarc`
4. **Value**: `v=DMARC1; p=none;`
5. **TTL**: Leave as "1 Hour"
6. Click "Save"

### Important Notes for GoDaddy

- **Don't include the domain name** in the Name field - GoDaddy adds it automatically
- **Use exact values** from your Resend dashboard screenshot
- **For the DKIM record**: The value is very long - make sure to copy the entire string
- **Save each record individually** before adding the next one

### After Adding Records

1. **Wait 15-30 minutes** for DNS propagation
2. **Return to your Resend dashboard**
3. **Refresh the page** - status should change from "Pending" to "Verified"
4. **All records must show "Verified"** before emails will work

### Verification

Once all DNS records are verified in Resend:
- Your domain status will show "Verified"
- You can send emails from any @tinymanager.ai address
- Test emails will be delivered directly to recipients

### Troubleshooting

If records don't verify after 30 minutes:
- Double-check each record in GoDaddy matches exactly
- Ensure no typos in Name or Value fields
- Try removing and re-adding any problematic records
- Contact GoDaddy support if DNS changes aren't propagating
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ENV_FILE = path.join(__dirname, '..', '.env.nosync');

console.log('🛡️ Sovereign Platform: Social Keys Setup Tool');
console.log('---------------------------------------------');

function updateEnv(key, value) {
    if (!fs.existsSync(ENV_FILE)) {
        console.error(`❌ Error: ${ENV_FILE} not found.`);
        return;
    }
    let content = fs.readFileSync(ENV_FILE, 'utf8');
    const regex = new RegExp(`^${key}=.*`, 'm');
    if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`);
    } else {
        content += `\n${key}=${value}`;
    }
    fs.writeFileSync(ENV_FILE, content);
}

rl.question('Please paste your real LINKEDIN_CLIENT_ID: ', (linkedinId) => {
    rl.question('Please paste your real LINKEDIN_CLIENT_SECRET: ', (linkedinSecret) => {
        rl.question('Please paste your real FACEBOOK_APP_ID: ', (facebookId) => {
            rl.question('Please paste your real FACEBOOK_APP_SECRET: ', (facebookSecret) => {
                const envUpdates = [
                    { key: 'LINKEDIN_CLIENT_ID', value: linkedinId },
                    { key: 'LINKEDIN_CLIENT_SECRET', value: linkedinSecret },
                    { key: 'FACEBOOK_APP_ID', value: facebookId },
                    { key: 'FACEBOOK_APP_SECRET', value: facebookSecret }
                ];
                
                let success = true;
                for (const update of envUpdates) {
                    if (update.value && update.value.trim() !== '') {
                        updateEnv(update.key, update.value.trim());
                    } else {
                        success = false;
                    }
                }
                
                if (success) {
                    console.log('\n✅ Real keys have been securely written to .env.nosync.');
                } else {
                    console.log('\n⚠️ Some keys were left blank. Keys must be valid to clear the audit.');
                }
                rl.close();
            });
        });
    });
});

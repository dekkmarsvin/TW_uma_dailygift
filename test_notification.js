/**
 * Test Windows Notification System
 * This script tests the Windows notification function
 */

const { execSync } = require('child_process');

function sendWindowsNotification(title, message, type = 'warning') {
    try {
        // Escape single quotes for PowerShell
        const escapedTitle = title.replace(/'/g, "''");
        const escapedMessage = message.replace(/'/g, "''");

        const iconType = type === 'error' ? 'Error' : 'Warning';

        const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${escapedMessage}', '${escapedTitle}', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::${iconType})`;

        execSync(`powershell -Command "${script}"`, {
            timeout: 30000,
            windowsHide: false,
            stdio: 'inherit'
        });

        console.log(`✅ Notification sent: ${title}`);
    } catch (err) {
        console.error('❌ Failed to send notification:', err.message);
    }
}

console.log('='.repeat(60));
console.log('Testing Windows Notification System');
console.log('='.repeat(60));
console.log();

console.log('Test 1: Warning notification');
sendWindowsNotification(
    'UMA 每日禮物 - 測試',
    '這是一個測試警告通知',
    'warning'
);

console.log();
console.log('Waiting 2 seconds...');
setTimeout(() => {
    console.log();
    console.log('Test 2: Error notification');
    sendWindowsNotification(
        'UMA 每日禮物 - 錯誤測試',
        '這是一個測試錯誤通知',
        'error'
    );

    console.log();
    console.log('='.repeat(60));
    console.log('Test complete!');
    console.log('='.repeat(60));
}, 2000);

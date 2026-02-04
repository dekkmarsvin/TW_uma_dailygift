const fs = require('fs');
const path = require('path');

/**
 * DailySummaryLogger - Logs daily automation results in a structured format
 */
class DailySummaryLogger {
    constructor(logPath = path.join(__dirname, '../logs/daily-summary.log')) {
        this.logPath = logPath;
        this.session = {
            date: null,
            checkIn: null,
            points: null,
            lottery: null,
            summary: null
        };

        // Ensure logs directory exists
        const logDir = path.dirname(logPath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    /**
     * Start a new logging session
     * @param {Date} date - Session date
     */
    startSession(date = new Date()) {
        this.session.date = date;
    }

    /**
     * Log check-in result
     * @param {string} status - 'Success', 'Already checked in', or 'Failed'
     * @param {number} daysBefore - Days before check-in
     * @param {number} daysAfter - Days after check-in
     * @param {string} reward - Reward description
     */
    logCheckIn(status, daysBefore = null, daysAfter = null, reward = null) {
        this.session.checkIn = {
            status,
            daysBefore,
            daysAfter,
            reward
        };
    }

    /**
     * Log points information
     * @param {number} currentYear - Current year points
     * @param {number} expiring - Expiring points
     * @param {number} total - Total points
     */
    logPoints(currentYear, expiring, total) {
        this.session.points = {
            currentYear,
            expiring,
            total
        };
    }

    /**
     * Log lottery result
     * @param {string} status - 'Success', 'Skipped', or 'Failed'
     * @param {string} result - Result description
     */
    logLottery(status, result = null) {
        this.session.lottery = {
            status,
            result
        };
    }

    /**
     * Log execution summary
     * @param {string} loginType - 'Cookie', 'Manual', etc.
     * @param {boolean} captchaUsed - Whether CAPTCHA was encountered
     * @param {string} duration - Execution duration
     */
    logSummary(loginType, captchaUsed, duration) {
        this.session.summary = {
            loginType,
            captchaUsed,
            duration
        };
    }

    /**
     * Format and write the session to log file
     */
    finalize() {
        if (!this.session.date) {
            console.warn('DailySummaryLogger: No session started, skipping log write');
            return;
        }

        const dateStr = this.session.date.toISOString().split('T')[0]; // YYYY-MM-DD
        const separator = '='.repeat(52);

        let logEntry = `\n${separator}\n`;
        logEntry += `${dateStr.padEnd(52)}\n`;
        logEntry += `${separator}\n`;

        // Check-in section
        if (this.session.checkIn) {
            const icon = this.session.checkIn.status === 'Success' ? '✅' :
                this.session.checkIn.status === 'Already checked in' ? '📅' : '❌';
            logEntry += `${icon} Check-in: ${this.session.checkIn.status}\n`;

            if (this.session.checkIn.daysBefore !== null && this.session.checkIn.daysAfter !== null) {
                logEntry += `   - Days checked: ${this.session.checkIn.daysBefore} → ${this.session.checkIn.daysAfter}\n`;
            } else if (this.session.checkIn.daysAfter !== null) {
                logEntry += `   - Total days: ${this.session.checkIn.daysAfter}\n`;
            }

            if (this.session.checkIn.reward) {
                logEntry += `   - Reward: ${this.session.checkIn.reward}\n`;
            }
            logEntry += '\n';
        }

        // Points section
        if (this.session.points) {
            logEntry += `💰 Points:\n`;
            logEntry += `   - Current year: ${this.session.points.currentYear}\n`;
            logEntry += `   - Expiring: ${this.session.points.expiring}\n`;
            logEntry += `   - Total: ${this.session.points.total}\n`;
            logEntry += '\n';
        }

        // Lottery section
        if (this.session.lottery) {
            const icon = this.session.lottery.status === 'Success' ? '🎁' :
                this.session.lottery.status === 'Skipped' ? '🎰' : '❌';
            logEntry += `${icon} Lottery: ${this.session.lottery.status}\n`;

            if (this.session.lottery.result) {
                logEntry += `   - ${this.session.lottery.result}\n`;
            }
            logEntry += '\n';
        }

        // Summary section
        if (this.session.summary) {
            logEntry += `📊 Summary:\n`;
            logEntry += `   - Login: ${this.session.summary.loginType}\n`;
            logEntry += `   - CAPTCHA: ${this.session.summary.captchaUsed ? 'Required' : 'Not required'}\n`;
            logEntry += `   - Duration: ${this.session.summary.duration}\n`;
        }

        logEntry += `${separator}\n`;

        // Append to log file
        try {
            fs.appendFileSync(this.logPath, logEntry, 'utf8');
        } catch (err) {
            console.error('DailySummaryLogger: Failed to write log:', err.message);
        }
    }
}

module.exports = DailySummaryLogger;

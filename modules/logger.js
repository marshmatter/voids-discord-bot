const winston = require('winston');
const path = require('path');

// Custom format for console output
const consoleFormat = winston.format.printf(({ level, message, timestamp, channel, user, guild }) => {
    const channelInfo = channel ? `[${channel}]` : '';
    const userInfo = user ? `[${user}]` : '';
    const guildInfo = guild ? `[${guild}]` : '';
    return `${timestamp} ${level}: ${channelInfo}${userInfo}${guildInfo} ${message}`;
});

// Custom format for file output
const fileFormat = winston.format.printf(({ level, message, timestamp, channel, user, guild, error, warning }) => {
    const metadata = {
        timestamp,
        level,
        message,
        ...(channel && { channel }),
        ...(user && { user }),
        ...(guild && { guild }),
        ...(error && { error }),
        ...(warning && { warning })
    };
    return JSON.stringify(metadata);
});

// Create the logger
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat()
    ),
    transports: [
        // Write all logs to console with custom format
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                consoleFormat
            )
        }),
        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({
            filename: path.join('logs', 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(
                fileFormat
            )
        }),
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({
            filename: path.join('logs', 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(
                fileFormat
            )
        })
    ]
});

// Create logs directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}

module.exports = logger; 
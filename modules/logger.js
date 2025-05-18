const winston = require('winston');
const path = require('path');

const consoleFormat = winston.format.printf(({ level, message, timestamp, channel, user, guild }) => {
    const channelInfo = channel ? `[${channel}]` : '';
    const userInfo = user ? `[${user}]` : '';
    const guildInfo = guild ? `[${guild}]` : '';
    return `${timestamp} ${level}: ${channelInfo}${userInfo}${guildInfo} ${message}`;
});

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

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                consoleFormat
            )
        }),
        new winston.transports.File({
            filename: path.join('logs', 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(
                fileFormat
            )
        }),
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

const fs = require('fs');
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}

module.exports = logger; 
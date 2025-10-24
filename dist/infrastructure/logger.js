"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logDebug = exports.logWarn = exports.logError = exports.logInfo = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json());
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'HH:mm:ss' }), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0 && meta.constructor === Object) {
        msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
}));
const transports = [
    new winston_1.default.transports.Console({
        format: consoleFormat,
        level: logLevel,
    }),
];
if (isProduction) {
    const logsDir = process.env.LOGS_DIR || path_1.default.join(process.cwd(), 'logs');
    transports.push(new winston_daily_rotate_file_1.default({
        dirname: logsDir,
        filename: 'application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: logFormat,
        level: 'info',
    }));
    transports.push(new winston_daily_rotate_file_1.default({
        dirname: logsDir,
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        format: logFormat,
        level: 'error',
    }));
}
const logger = winston_1.default.createLogger({
    level: logLevel,
    format: logFormat,
    transports,
    exceptionHandlers: [
        new winston_1.default.transports.Console({ format: consoleFormat }),
    ],
    rejectionHandlers: [
        new winston_1.default.transports.Console({ format: consoleFormat }),
    ],
});
exports.default = logger;
const logInfo = (message, meta) => {
    logger.info(message, meta);
};
exports.logInfo = logInfo;
const logError = (message, error) => {
    if (error instanceof Error) {
        logger.error(message, { error: error.message, stack: error.stack });
    }
    else {
        logger.error(message, error);
    }
};
exports.logError = logError;
const logWarn = (message, meta) => {
    logger.warn(message, meta);
};
exports.logWarn = logWarn;
const logDebug = (message, meta) => {
    logger.debug(message, meta);
};
exports.logDebug = logDebug;

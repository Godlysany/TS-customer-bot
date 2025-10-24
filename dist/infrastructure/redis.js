"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisLock = void 0;
exports.withLock = withLock;
exports.ensureMessageIdempotency = ensureMessageIdempotency;
exports.isRedisAvailable = isRedisAvailable;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
const isRedisEnabled = !!REDIS_URL;
let redisClient = null;
if (isRedisEnabled) {
    try {
        redisClient = new ioredis_1.default(REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                if (times > 3) {
                    (0, logger_1.logError)('Redis connection failed after 3 retries');
                    return null;
                }
                return Math.min(times * 100, 2000);
            },
            reconnectOnError: (err) => {
                const targetErrors = ['READONLY', 'ECONNRESET'];
                return targetErrors.some(e => err.message.includes(e));
            },
        });
        redisClient.on('connect', () => {
            (0, logger_1.logInfo)('Redis connected successfully');
        });
        redisClient.on('error', (err) => {
            (0, logger_1.logError)('Redis connection error', err);
        });
    }
    catch (error) {
        (0, logger_1.logError)('Failed to initialize Redis', error);
    }
}
class RedisLock {
    lockKey;
    lockValue;
    ttl;
    constructor(lockKey, ttl = 30000) {
        this.lockKey = `lock:${lockKey}`;
        this.lockValue = `${Date.now()}-${Math.random()}`;
        this.ttl = ttl;
    }
    async acquire() {
        if (!redisClient) {
            (0, logger_1.logWarn)(`Redis not available, proceeding without lock for ${this.lockKey}`);
            return true;
        }
        try {
            const result = await redisClient.set(this.lockKey, this.lockValue, 'PX', this.ttl, 'NX');
            if (result === 'OK') {
                (0, logger_1.logDebug)(`Lock acquired: ${this.lockKey}`);
                return true;
            }
            (0, logger_1.logDebug)(`Failed to acquire lock: ${this.lockKey}`);
            return false;
        }
        catch (error) {
            (0, logger_1.logError)(`Error acquiring lock: ${this.lockKey}`, error);
            return true;
        }
    }
    async release() {
        if (!redisClient) {
            return;
        }
        try {
            const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
            await redisClient.eval(script, 1, this.lockKey, this.lockValue);
            (0, logger_1.logDebug)(`Lock released: ${this.lockKey}`);
        }
        catch (error) {
            (0, logger_1.logError)(`Error releasing lock: ${this.lockKey}`, error);
        }
    }
    async extend(additionalMs = 30000) {
        if (!redisClient) {
            return true;
        }
        try {
            const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("pexpire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;
            const result = await redisClient.eval(script, 1, this.lockKey, this.lockValue, additionalMs.toString());
            return result === 1;
        }
        catch (error) {
            (0, logger_1.logError)(`Error extending lock: ${this.lockKey}`, error);
            return false;
        }
    }
}
exports.RedisLock = RedisLock;
async function withLock(lockKey, fn, ttl = 30000) {
    const lock = new RedisLock(lockKey, ttl);
    const acquired = await lock.acquire();
    if (!acquired) {
        throw new Error(`Failed to acquire lock: ${lockKey}`);
    }
    try {
        return await fn();
    }
    finally {
        await lock.release();
    }
}
async function ensureMessageIdempotency(messageId, ttl = 60000) {
    if (!redisClient) {
        return true;
    }
    const key = `msg:${messageId}`;
    try {
        const result = await redisClient.set(key, '1', 'PX', ttl, 'NX');
        return result === 'OK';
    }
    catch (error) {
        (0, logger_1.logError)(`Error checking message idempotency: ${messageId}`, error);
        return true;
    }
}
function isRedisAvailable() {
    return isRedisEnabled && redisClient !== null;
}
exports.default = redisClient;

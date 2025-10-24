import Redis from 'ioredis';
import logger from './logger';

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
const isRedisEnabled = !!REDIS_URL;

let redisClient: Redis | null = null;

if (isRedisEnabled) {
  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.logError('Redis connection failed after 3 retries');
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
      logger.logInfo('Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      logger.logError('Redis connection error', err);
    });
  } catch (error: any) {
    logger.logError('Failed to initialize Redis', error);
  }
}

export class RedisLock {
  private lockKey: string;
  private lockValue: string;
  private ttl: number;

  constructor(lockKey: string, ttl: number = 30000) {
    this.lockKey = `lock:${lockKey}`;
    this.lockValue = `${Date.now()}-${Math.random()}`;
    this.ttl = ttl;
  }

  async acquire(): Promise<boolean> {
    if (!redisClient) {
      logger.logWarn(`Redis not available, proceeding without lock for ${this.lockKey}`);
      return true;
    }

    try {
      const result = await redisClient.set(
        this.lockKey,
        this.lockValue,
        'PX',
        this.ttl,
        'NX'
      );

      if (result === 'OK') {
        logger.logDebug(`Lock acquired: ${this.lockKey}`);
        return true;
      }

      logger.logDebug(`Failed to acquire lock: ${this.lockKey}`);
      return false;
    } catch (error: any) {
      logger.logError(`Error acquiring lock: ${this.lockKey}`, error);
      return true;
    }
  }

  async release(): Promise<void> {
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
      logger.logDebug(`Lock released: ${this.lockKey}`);
    } catch (error: any) {
      logger.logError(`Error releasing lock: ${this.lockKey}`, error);
    }
  }

  async extend(additionalMs: number = 30000): Promise<boolean> {
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

      const result = await redisClient.eval(
        script,
        1,
        this.lockKey,
        this.lockValue,
        additionalMs.toString()
      );

      return result === 1;
    } catch (error: any) {
      logger.logError(`Error extending lock: ${this.lockKey}`, error);
      return false;
    }
  }
}

export async function withLock<T>(
  lockKey: string,
  fn: () => Promise<T>,
  ttl: number = 30000
): Promise<T> {
  const lock = new RedisLock(lockKey, ttl);
  const acquired = await lock.acquire();

  if (!acquired) {
    throw new Error(`Failed to acquire lock: ${lockKey}`);
  }

  try {
    return await fn();
  } finally {
    await lock.release();
  }
}

export async function ensureMessageIdempotency(
  messageId: string,
  ttl: number = 60000
): Promise<boolean> {
  if (!redisClient) {
    return true;
  }

  const key = `msg:${messageId}`;
  
  try {
    const result = await redisClient.set(key, '1', 'PX', ttl, 'NX');
    return result === 'OK';
  } catch (error: any) {
    logger.logError(`Error checking message idempotency: ${messageId}`, error);
    return true;
  }
}

export function isRedisAvailable(): boolean {
  return isRedisEnabled && redisClient !== null;
}

export default redisClient;

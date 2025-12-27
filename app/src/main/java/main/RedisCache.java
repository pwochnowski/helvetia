package helvetia.main;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import redis.clients.jedis.JedisPool;
import redis.clients.jedis.JedisPoolConfig;
import redis.clients.jedis.Jedis;

import java.time.Duration;

/**
 * Redis cache utility for caching API responses.
 * Provides get/set operations with TTL support.
 */
public class RedisCache {
    private static final Logger log = LogManager.getLogger(RedisCache.class);
    
    private final JedisPool jedisPool;
    private final int defaultTtlSeconds;
    
    // Cache key prefixes
    public static final String ARTICLE_PREFIX = "article:";
    public static final String ARTICLE_LIST_PREFIX = "article_list:";
    
    /**
     * Create a Redis cache instance.
     * @param host Redis host (default: localhost)
     * @param port Redis port (default: 6379)
     * @param defaultTtlSeconds Default TTL for cached items in seconds
     */
    public RedisCache(String host, int port, int defaultTtlSeconds) {
        this.defaultTtlSeconds = defaultTtlSeconds;
        
        JedisPoolConfig poolConfig = new JedisPoolConfig();
        poolConfig.setMaxTotal(50);
        poolConfig.setMaxIdle(10);
        poolConfig.setMinIdle(2);
        poolConfig.setTestOnBorrow(true);
        poolConfig.setTestOnReturn(true);
        poolConfig.setMaxWait(Duration.ofMillis(2000));
        
        this.jedisPool = new JedisPool(poolConfig, host, port);
        log.info("Redis cache initialized: {}:{}", host, port);
    }
    
    /**
     * Create a Redis cache with default settings from environment variables.
     */
    public static RedisCache fromEnv() {
        String host = System.getenv().getOrDefault("REDIS_HOST", "localhost");
        int port = Integer.parseInt(System.getenv().getOrDefault("REDIS_PORT", "6379"));
        int ttl = Integer.parseInt(System.getenv().getOrDefault("REDIS_CACHE_TTL", "300")); // 5 min default
        return new RedisCache(host, port, ttl);
    }
    
    /**
     * Get a cached value by key.
     * @param key Cache key
     * @return Cached byte array, or null if not found
     */
    public byte[] get(String key) {
        try (Jedis jedis = jedisPool.getResource()) {
            byte[] value = jedis.get(key.getBytes());
            if (value != null) {
                log.debug("Cache hit: {}", key);
            } else {
                log.debug("Cache miss: {}", key);
            }
            return value;
        } catch (Exception e) {
            log.warn("Redis get failed for key {}: {}", key, e.getMessage());
            return null;
        }
    }
    
    /**
     * Set a cached value with default TTL.
     * @param key Cache key
     * @param value Value to cache
     */
    public void set(String key, byte[] value) {
        set(key, value, defaultTtlSeconds);
    }
    
    /**
     * Set a cached value with custom TTL.
     * @param key Cache key
     * @param value Value to cache
     * @param ttlSeconds TTL in seconds
     */
    public void set(String key, byte[] value, int ttlSeconds) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.setex(key.getBytes(), ttlSeconds, value);
            log.debug("Cached: {} (TTL: {}s)", key, ttlSeconds);
        } catch (Exception e) {
            log.warn("Redis set failed for key {}: {}", key, e.getMessage());
        }
    }
    
    /**
     * Delete a cached value.
     * @param key Cache key
     */
    public void delete(String key) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.del(key);
            log.debug("Cache deleted: {}", key);
        } catch (Exception e) {
            log.warn("Redis delete failed for key {}: {}", key, e.getMessage());
        }
    }
    
    /**
     * Delete all keys matching a pattern.
     * @param pattern Key pattern (e.g., "article:*")
     */
    public void deletePattern(String pattern) {
        try (Jedis jedis = jedisPool.getResource()) {
            var keys = jedis.keys(pattern);
            if (!keys.isEmpty()) {
                jedis.del(keys.toArray(new String[0]));
                log.debug("Cache pattern deleted: {} ({} keys)", pattern, keys.size());
            }
        } catch (Exception e) {
            log.warn("Redis delete pattern failed for {}: {}", pattern, e.getMessage());
        }
    }
    
    /**
     * Generate a cache key for article list queries.
     * @param filter RSQL filter
     * @param limit Limit
     * @param offset Offset
     * @param sortBy Sort column
     * @param sortDir Sort direction
     * @return Cache key
     */
    public static String articleListKey(String filter, int limit, int offset, String sortBy, String sortDir) {
        return ARTICLE_LIST_PREFIX + 
               "f:" + (filter == null ? "" : filter) + 
               ":l:" + limit + 
               ":o:" + offset + 
               ":s:" + (sortBy == null ? "" : sortBy) + 
               ":" + (sortDir == null ? "" : sortDir);
    }
    
    /**
     * Generate a cache key for a single article.
     * @param id Article ID
     * @return Cache key
     */
    public static String articleKey(long id) {
        return ARTICLE_PREFIX + id;
    }
    
    /**
     * Check if Redis is available.
     * @return true if Redis is reachable
     */
    public boolean isAvailable() {
        try (Jedis jedis = jedisPool.getResource()) {
            return "PONG".equals(jedis.ping());
        } catch (Exception e) {
            return false;
        }
    }
    
    /**
     * Close the Redis connection pool.
     */
    public void close() {
        if (jedisPool != null && !jedisPool.isClosed()) {
            jedisPool.close();
            log.info("Redis cache closed");
        }
    }
}

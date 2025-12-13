import redis
import json
import hashlib
from typing import Dict, Any, List,Optional
import logging
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class RedisCache:
    def __init__(self):
        try:
            self.client = redis.Redis(
                host = settings.upstash_redis_url,
                port = 6379,
                password = settings.upstash_redis_token,
                ssl = True,
                decode_responses = True,
                socket_timeout = 5,
                socket_connect_timeout = 5,
                retry_on_timeout = True,
                max_connections = 10                
            )
            self.client.ping()
            print("✅ Redis connected successfully!")
            logger.info("redis connected")
        except Exception as e:
            print(f"❌ Redis connection failed: {e}")
            logger.error(f"Failed to connect to redis: {e}")
            self.client = None

    def is_available(self) -> bool:
        if not self.client:
            return False
        try:
            self.client.ping()
            return True
        except Exception as e:
            logger.error(f"Failed to ping redis: {e}")
            return False
    def generate_key_hash(self, *args) -> str:

        combined = "|".join(str(arg) for arg in args).lower()

        hash_result = hashlib.sha256(combined.encode()).hexdigest()

        return hash_result[:16]

    def get_query_response(self, user_id:str , question:str,document_ids:List[str]) -> Optional[Dict]:
        """
        Try to get cached answer for this question
        Returns: Dict with answer if cached, None if cache miss
        """
        if not self.is_available():
            return None

        try:
            sorted_docs = sorted(document_ids)
            doc_hash = self.generate_key_hash(sorted_docs)
            question_hash = self.generate_key_hash(question)
            key = f"query:{user_id}:{doc_hash}:{question_hash}:response"

            cached_json = self.client.get(key)

            if cached_json:
                logger.info(f"✅ Cache HIT: {key[:50]}...")
                return json.loads(cached_json)
            else:
                logger.info(f"❌ Cache MISS: {key[:50]}...")
                return None

        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None

    def set_query_response(self, user_id:str, question:str, document_ids:List[str], response:Dict, ttl:int=3600) -> bool:
        """
        Store answer in cache for 1 hour (3600 seconds)
        Returns: True if cached successfully
        """
        if not self.is_available():
            return False

        try:
            sorted_docs = sorted(document_ids)
            doc_hash = self.generate_key_hash(sorted_docs)
            question_hash = self.generate_key_hash(question)
            key = f"query:{user_id}:{doc_hash}:{question_hash}:response"

            response_json = json.dumps(response)
            self.client.setex(key, ttl, response_json)

            logger.info(f"💾 Cached response: {key[:50]}... (TTL: {ttl}s)")
            return True

        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False

    def get_search_chunks(self, question:str, document_ids:List[str]) -> Optional[List[Dict]]:
        """
        Get cached vector search chunks (Layer 2)
        Returns: List of chunks if cached, None if miss
        """
        if not self.is_available():
            return None

        try:
            sorted_docs = sorted(document_ids)
            doc_hash = self.generate_key_hash(sorted_docs)
            question_hash = self.generate_key_hash(question)
            key = f"query:{doc_hash}:{question_hash}:chunks"

            cached_json = self.client.get(key)

            if cached_json:
                logger.info(f"✅ Cache HIT (chunks): {key[:50]}...")
                return json.loads(cached_json)
            else:
                logger.info(f"❌ Cache MISS (chunks): {key[:50]}...")
                return None

        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None

    def set_search_chunks(self, question:str, document_ids:List[str], chunks:List[Dict], ttl:int=600) -> bool:
        """
        Cache vector search chunks for 10 minutes (600 seconds)
        Returns: True if cached successfully
        """
        if not self.is_available():
            return False

        try:
            sorted_docs = sorted(document_ids)
            doc_hash = self.generate_key_hash(sorted_docs)
            question_hash = self.generate_key_hash(question)
            key = f"query:{doc_hash}:{question_hash}:chunks"

            chunks_json = json.dumps(chunks)
            self.client.setex(key, ttl, chunks_json)

            logger.info(f"💾 Cached chunks: {key[:50]}... (TTL: {ttl}s)")
            return True

        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False

    def get_user_documents(self, user_id:str) -> Optional[List[Dict]]:
        """
        Get cached user document list (Layer 3)
        Returns: List of documents if cached, None if miss
        """
        if not self.is_available():
            return None

        try:
            key = f"user:{user_id}:documents"
            cached_json = self.client.get(key)

            if cached_json:
                logger.info(f"✅ Cache HIT (documents): {key}")
                return json.loads(cached_json)
            else:
                logger.info(f"❌ Cache MISS (documents): {key}")
                return None

        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None

    def set_user_documents(self, user_id:str, documents:List[Dict], ttl:int=86400) -> bool:
        """
        Cache user document list for 1 day (86400 seconds)
        Returns: True if cached successfully
        """
        if not self.is_available():
            return False

        try:
            key = f"user:{user_id}:documents"
            docs_json = json.dumps(documents)
            self.client.setex(key, ttl, docs_json)

            logger.info(f"💾 Cached documents: {key} (TTL: {ttl}s)")
            return True

        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False

    def invalidate_user_documents(self, user_id:str) -> bool:
        """
        Delete cached document list (call after upload/delete)
        Returns: True if cache was deleted
        """
        if not self.is_available():
            return False

        try:
            key = f"user:{user_id}:documents"
            deleted = self.client.delete(key)

            if deleted:
                logger.info(f"🗑️ Invalidated: {key}")

            return bool(deleted)

        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            return False

    def invalidate_query_cache(self, user_id:str, document_ids:Optional[List[str]]=None) -> int:
        """
        Delete all cached queries for user (nuclear option)
        Returns: Number of keys deleted
        """
        if not self.is_available():
            return 0

        try:
            if document_ids:
                sorted_docs = sorted(document_ids)
                doc_hash = self.generate_key_hash(sorted_docs)
                pattern = f"query:{user_id}:{doc_hash}:*"
            else:
                pattern = f"query:{user_id}:*"

            keys = self.client.keys(pattern)

            if keys:
                deleted = self.client.delete(*keys)
                logger.info(f"🗑️ Invalidated {deleted} caches: {pattern}")
                return deleted

            return 0

        except Exception as e:
            logger.error(f"Redis invalidation error: {e}")
            return 0

    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get Redis statistics for monitoring
        """
        if not self.is_available():
            return {"status": "unavailable"}

        try:
            info = self.client.info()
            return {
                "status": "connected",
                "used_memory": info.get("used_memory_human"),
                "total_keys": self.client.dbsize(),
                "uptime_days": info.get("uptime_in_days"),
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}


# Create global instance
cache_service = RedisCache()


        
#!/usr/bin/env python3
"""
Bulk Insert Script for Helvetia Database
Generates and inserts users, articles, and reads into Vitess/MySQL

Usage:
    python bulk_insert.py [--host HOST] [--port PORT] [--users N] [--articles N] [--reads N]
    
For maximum performance with large datasets:
    1. Stop replication before running: mysql -h <replica> -e "STOP REPLICA;"
    2. Run this script
    3. Resume replication after: mysql -h <replica> -e "START REPLICA;"
"""

import argparse
import json
import random
import string
from datetime import datetime, timedelta
from typing import Generator, Dict, Any, List, Tuple

import mysql.connector
from mysql.connector import Error

# Configuration
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 15306  # VTGate port
DEFAULT_USER = "root"
DEFAULT_PASSWORD = ""

# Vitess keyspace names
USER_KEYSPACE = "user_keyspace"
ARTICLE_KEYSPACE = "article_keyspace"
READ_KEYSPACE = "read_keyspace"

# Data generation settings
USERS_NUM = 10000
ARTICLES_NUM = 10000
READS_NUM = 100000

# Batch sizes for bulk insert (tune based on your memory/network)
# With durability=none, we can use larger batches
USER_BATCH_SIZE = 2000
ARTICLE_BATCH_SIZE = 1000
READ_BATCH_SIZE = 2000

# HDFS file settings
# Articles with videos (first N articles get videos)
ARTICLES_WITH_VIDEO = 50
# Number of images per article (1-3 random)
MAX_IMAGES_PER_ARTICLE = 3

# Probability distributions (from original script)
REGIONS = ["Beijing", "HongKong"]  # Match schema: no space in HongKong
REGION_WEIGHTS = [0.6, 0.4]  # Beijing: 60%, HongKong: 40%

CATEGORIES = ["science", "technology"]
CATEGORY_WEIGHTS = [0.45, 0.55]

LANGUAGES = ["en", "zh"]
LANGUAGE_WEIGHTS_USER = [0.2, 0.8]  # Users: en 20%, zh 80%
LANGUAGE_WEIGHTS_ARTICLE = [0.5, 0.5]  # Articles: 50/50

GENDERS = ["male", "female", "other"]
GENDER_WEIGHTS = [0.5, 0.33, 0.17]

# Read probabilities based on region+language combination
READ_PROBABILITIES = {
    ("Beijing", "en"): {"read": 0.6, "agree": 0.2, "comment": 0.2, "share": 0.1},
    ("Beijing", "zh"): {"read": 1.0, "agree": 0.3, "comment": 0.3, "share": 0.2},
    ("HongKong", "en"): {"read": 1.0, "agree": 0.3, "comment": 0.3, "share": 0.2},
    ("HongKong", "zh"): {"read": 0.8, "agree": 0.2, "comment": 0.2, "share": 0.1},
}

# Track generated data for referential integrity in reads
uid_to_region: Dict[str, str] = {}
aid_to_language: Dict[str, str] = {}


def random_string(length: int) -> str:
    """Generate a random alphanumeric string."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


def random_tags(count: int = 3) -> List[str]:
    """Generate random tags as JSON array."""
    return [f"tag{random.randint(1, 50)}" for _ in range(count)]


def random_authors(count: int = None) -> List[str]:
    """Generate random authors as JSON array."""
    if count is None:
        count = random.randint(1, 3)
    return [f"author{random.randint(1, 2000)}" for _ in range(count)]


def gen_user(i: int, base_time: datetime) -> Dict[str, Any]:
    """Generate a single user record matching the schema."""
    region = random.choices(REGIONS, REGION_WEIGHTS)[0]
    uid = f"u{i}"
    
    # Store for read generation
    uid_to_region[uid] = region
    
    return {
        "id": i + 1,  # Explicit ID for Vitess region vindex
        "uid": uid,
        "timestamp": base_time + timedelta(seconds=i),
        "name": f"user{i}",
        "gender": random.choices(GENDERS, GENDER_WEIGHTS)[0],
        "email": f"user{i}@example.com",
        "phone": f"+1{random.randint(1000000000, 9999999999)}",
        "dept": f"dept{random.randint(0, 19)}",
        "grade": f"grade{random.randint(1, 4)}",
        "language": random.choices(LANGUAGES, LANGUAGE_WEIGHTS_USER)[0],
        "region": region,
        "role": f"role{random.randint(0, 2)}",
        "preferTags": json.dumps(random_tags()),
        "obtainedCredits": random.randint(0, 99),
    }


def get_article_category(i: int) -> str:
    """Get deterministic category for article index.
    Uses same hash as HDFS loader: science 45%, technology 55%
    """
    hash_val = (i * 31 + 17) % 100
    return "science" if hash_val < 45 else "technology"


def get_text_category(i: int) -> str:
    """Get text file category matching article category.
    science -> tech (BBC tech category)
    technology -> business/entertainment/sport
    """
    hash_val = (i * 31 + 17) % 100
    if hash_val < 45:
        # science articles use tech texts
        return "tech"
    else:
        # technology articles use business/entertainment/sport
        sub_hash = (i * 37 + 13) % 3
        return ["business", "entertainment", "sport"][sub_hash]


def gen_article(i: int, base_time: datetime, articles_count: int = ARTICLES_NUM) -> Dict[str, Any]:
    """Generate a single article record matching the schema."""
    # Use deterministic category based on index (matching HDFS loader)
    category = get_article_category(i)
    language = random.choices(LANGUAGES, LANGUAGE_WEIGHTS_ARTICLE)[0]
    aid = f"a{i}"
    
    # Store for read generation
    aid_to_language[aid] = language
    
    # Get matching text category for sensible content
    text_cat = get_text_category(i)
    
    # Generate placeholder text (in production, you'd load real content)
    abstract = f"Abstract for article {i}: A comprehensive overview of {category} topics."
    text = f"Full text content for article {i} in category {category} (text from {text_cat}). " * 50
    
    # Spread articles over 1 year (365 days)
    days_spread = 365
    day_offset = int((i / articles_count) * days_spread)
    article_time = base_time + timedelta(days=day_offset, hours=random.randint(0, 23), minutes=random.randint(0, 59))
    
    # HDFS paths for media files (matching load-articles.sh structure)
    # Text file path
    text_path = f"/articles/article{i}/text.txt"
    
    # Image path (one image per article)
    image_path = f"/articles/article{i}/image.jpg"
    
    # Video path (only first ARTICLES_WITH_VIDEO articles have videos)
    video_path = f"/articles/article{i}/video.mp4" if i < ARTICLES_WITH_VIDEO else None
    
    return {
        "id": i + 1,  # Explicit ID for Vitess category vindex
        "aid": aid,
        "category": category,
        "timestamp": article_time,
        "title": f"Article Title {i}: {random_string(20)}",
        "abstract": abstract,
        "articleTags": json.dumps(random_tags(random.randint(1, 5))),
        "authors": json.dumps(random_authors()),
        "language": language,
        "text": text,
        "textPath": text_path,
        "imagePath": image_path,
        "videoPath": video_path,
    }


def gen_read(i: int, base_time: datetime, users_count: int, articles_count: int, read_id: int, reads_count: int = READS_NUM) -> Dict[str, Any] | None:
    """Generate a single read record matching the schema."""
    uid = f"u{random.randint(0, users_count - 1)}"
    aid = f"a{random.randint(0, articles_count - 1)}"
    
    region = uid_to_region.get(uid, "Beijing")
    lang = aid_to_language.get(aid, "en")
    
    probs = READ_PROBABILITIES.get((region, lang), READ_PROBABILITIES[("Beijing", "en")])
    
    # Check if user would read this article
    if random.random() > probs["read"]:
        return None  # Skip this read
    
    # Spread reads over 1 year (365 days)
    days_spread = 365
    day_offset = int((i / reads_count) * days_spread)
    read_time = base_time + timedelta(days=day_offset, hours=random.randint(0, 23), minutes=random.randint(0, 59), seconds=random.randint(0, 59))
    
    return {
        "id": read_id,  # Explicit ID for Vitess region vindex
        "uid": uid,
        "aid": aid,
        "timestamp": read_time,
        "region": region,
        "readTimeLength": random.randint(1, 300),  # 1-300 seconds
        "agreeOrNot": 1 if random.random() < probs["agree"] else 0,
        "commentOrNot": 1 if random.random() < probs["comment"] else 0,
        "commentDetail": f"Comment on article {aid} by user {uid}" if random.random() < probs["comment"] else None,
        "shareOrNot": 1 if random.random() < probs["share"] else 0,
    }


def batch_generator(generator_func, count: int, batch_size: int, **kwargs) -> Generator[List[Dict], None, None]:
    """Yield batches of generated records."""
    batch = []
    generated = 0
    i = 0
    read_id = 1  # For tracking read IDs
    
    while generated < count:
        # Pass read_id for gen_read function
        if 'users_count' in kwargs:  # This is a read generator
            record = generator_func(i, read_id=read_id, **kwargs)
        else:
            record = generator_func(i, **kwargs)
        i += 1
        
        if record is not None:
            batch.append(record)
            generated += 1
            read_id += 1
            
            if len(batch) >= batch_size:
                yield batch
                batch = []
    
    if batch:
        yield batch


def bulk_insert_users(cursor, users: List[Dict]) -> int:
    """Insert a batch of users."""
    if not users:
        return 0
    
    sql = """
        INSERT INTO `user` 
        (`id`, `uid`, `timestamp`, `name`, `gender`, `email`, `phone`, `dept`, `grade`, 
         `language`, `region`, `role`, `preferTags`, `obtainedCredits`)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    
    values = [
        (u["id"], u["uid"], u["timestamp"], u["name"], u["gender"], u["email"], u["phone"],
         u["dept"], u["grade"], u["language"], u["region"], u["role"],
         u["preferTags"], u["obtainedCredits"])
        for u in users
    ]
    
    cursor.executemany(sql, values)
    return len(users)


def bulk_insert_articles(cursor, articles: List[Dict]) -> int:
    """Insert a batch of articles."""
    if not articles:
        return 0
    
    sql = """
        INSERT INTO `article`
        (`id`, `aid`, `timestamp`, `title`, `category`, `abstract`, `articleTags`,
         `authors`, `language`, `text`, `textPath`, `imagePath`, `videoPath`)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    
    values = [
        (a["id"], a["aid"], a["timestamp"], a["title"], a["category"], a["abstract"],
         a["articleTags"], a["authors"], a["language"], a["text"],
         a["textPath"], a["imagePath"], a["videoPath"])
        for a in articles
    ]
    
    cursor.executemany(sql, values)
    return len(articles)


def bulk_insert_reads(cursor, reads: List[Dict]) -> int:
    """Insert a batch of reads using multi-row INSERT for speed."""
    if not reads:
        return 0
    
    # Build multi-row INSERT statement (much faster than executemany)
    # Use INSERT IGNORE to skip duplicates (uid, aid unique constraint)
    base_sql = """INSERT IGNORE INTO `read`
        (`id`, `uid`, `aid`, `timestamp`, `region`, `readTimeLength`, 
         `agreeOrNot`, `commentOrNot`, `commentDetail`, `shareOrNot`) VALUES """
    
    def escape_val(v):
        if v is None:
            return "NULL"
        if isinstance(v, str):
            return "'" + v.replace("'", "''") + "'"
        if isinstance(v, datetime):
            return "'" + v.strftime('%Y-%m-%d %H:%M:%S') + "'"
        return str(v)
    
    value_rows = []
    for r in reads:
        row = "({}, {}, {}, {}, {}, {}, {}, {}, {}, {})".format(
            escape_val(r["id"]),
            escape_val(r["uid"]),
            escape_val(r["aid"]),
            escape_val(r["timestamp"]),
            escape_val(r["region"]),
            escape_val(r["readTimeLength"]),
            escape_val(r["agreeOrNot"]),
            escape_val(r["commentOrNot"]),
            escape_val(r["commentDetail"]),
            escape_val(r["shareOrNot"])
        )
        value_rows.append(row)
    
    sql = base_sql + ",\n".join(value_rows)
    cursor.execute(sql)
    return len(reads)


def optimize_connection(cursor):
    """Apply connection-level optimizations for bulk insert."""
    # Note: We keep autocommit=1 for Vitess to avoid transaction timeout issues
    # Vitess lookup vindexes require verification which can timeout in large transactions
    optimizations = [
        "SET unique_checks = 0",
        "SET foreign_key_checks = 0",
    ]
    
    for sql in optimizations:
        try:
            cursor.execute(sql)
        except Error as e:
            print(f"Warning: Could not apply optimization '{sql}': {e}")


def restore_connection(cursor):
    """Restore connection settings after bulk insert."""
    restorations = [
        "SET unique_checks = 1",
        "SET foreign_key_checks = 1",
    ]
    
    for sql in restorations:
        try:
            cursor.execute(sql)
        except Error as e:
            print(f"Warning: Could not restore setting '{sql}': {e}")


def print_progress(current: int, total: int, prefix: str = ""):
    """Print a progress bar on a single line."""
    percent = current / total * 100
    bar_length = 40
    filled = int(bar_length * current / total)
    bar = "█" * filled + "░" * (bar_length - filled)
    # Pad prefix to fixed width and clear rest of line with spaces
    print(f"\r{prefix:<10} [{bar}] {percent:>5.1f}% ({current:>7,}/{total:,})   ", end="", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Bulk insert data into Helvetia database")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Database host")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Database port")
    parser.add_argument("--user", default=DEFAULT_USER, help="Database user")
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Database password")
    parser.add_argument("--users", type=int, default=USERS_NUM, help="Number of users to generate")
    parser.add_argument("--articles", type=int, default=ARTICLES_NUM, help="Number of articles to generate")
    parser.add_argument("--reads", type=int, default=READS_NUM, help="Number of reads to generate")
    parser.add_argument("--truncate", action="store_true", help="Truncate tables before insert")
    parser.add_argument("--dry-run", action="store_true", help="Generate data but don't insert")
    
    args = parser.parse_args()
    
    base_time = datetime(2017, 9, 25, 0, 0, 0)  # Consistent with original script
    
    print("=" * 60)
    print("Helvetia Bulk Insert Tool")
    print("=" * 60)
    print(f"Target: {args.host}:{args.port}")
    print(f"Keyspaces: {USER_KEYSPACE}, {ARTICLE_KEYSPACE}, {READ_KEYSPACE}")
    print(f"Users: {args.users:,} | Articles: {args.articles:,} | Reads: {args.reads:,}")
    print("=" * 60)
    
    if args.dry_run:
        print("\n[DRY RUN] Generating data without database connection...")
        
        # Generate users
        print("\nGenerating users...")
        for i, batch in enumerate(batch_generator(gen_user, args.users, USER_BATCH_SIZE, base_time=base_time)):
            print_progress((i + 1) * USER_BATCH_SIZE, args.users, "Users")
        print()
        
        # Generate articles  
        print("\nGenerating articles...")
        for i, batch in enumerate(batch_generator(gen_article, args.articles, ARTICLE_BATCH_SIZE, base_time=base_time, articles_count=args.articles)):
            print_progress((i + 1) * ARTICLE_BATCH_SIZE, args.articles, "Articles")
        print()
        
        # Generate reads
        print("\nGenerating reads...")
        for i, batch in enumerate(batch_generator(gen_read, args.reads, READ_BATCH_SIZE, 
                                                   base_time=base_time, users_count=args.users, articles_count=args.articles, reads_count=args.reads)):
            print_progress((i + 1) * READ_BATCH_SIZE, args.reads, "Reads")
        print()
        
        print("\n[DRY RUN] Complete!")
        return
    
    def get_connection(keyspace: str):
        """Create a connection to a specific keyspace."""
        return mysql.connector.connect(
            host=args.host,
            port=args.port,
            user=args.user,
            password=args.password,
            database=keyspace,
            allow_local_infile=True,
        )
    
    def truncate_table(conn, cursor, table: str):
        """Delete all rows from a table in batches."""
        import time
        deleted_total = 0
        while True:
            try:
                cursor.execute(f"DELETE FROM `{table}` LIMIT 1000")
                conn.commit()
                deleted = cursor.rowcount
                deleted_total += deleted
                if deleted == 0:
                    break
                print(f"\r  Clearing {table}... {deleted_total:,} rows deleted", end="", flush=True)
            except Error as e:
                if "in use" in str(e) or "transaction" in str(e).lower():
                    # Transaction conflict, wait and retry
                    time.sleep(0.5)
                    continue
                raise
        if deleted_total > 0:
            print(f"\r  ✓ Cleared {table} table ({deleted_total:,} rows)      ")
        else:
            print(f"  ✓ {table} table already empty")
    
    connections = []  # Track connections for cleanup
    
    try:
        user_count = 0
        article_count = 0
        read_count = 0
        
        # Process READ table first (must clear before users/articles due to references)
        print("\n[1/3] Processing read table...")
        read_conn = get_connection(READ_KEYSPACE)
        connections.append(read_conn)
        read_cursor = read_conn.cursor()
        optimize_connection(read_cursor)
        
        if args.truncate:
            truncate_table(read_conn, read_cursor, "read")
        
        # Insert reads (need users and articles generated first, so do this last)
        # For now, just prepare the connection
        
        # Process USER table
        print("\n[2/3] Processing user table...")
        user_conn = get_connection(USER_KEYSPACE)
        connections.append(user_conn)
        user_cursor = user_conn.cursor()
        optimize_connection(user_cursor)
        
        if args.truncate:
            truncate_table(user_conn, user_cursor, "user")
        
        print("  Inserting users...")
        for batch in batch_generator(gen_user, args.users, USER_BATCH_SIZE, base_time=base_time):
            user_count += bulk_insert_users(user_cursor, batch)
            user_conn.commit()
            print_progress(user_count, args.users, "Users")
        print(f"\n  ✓ Inserted {user_count:,} users")
        
        restore_connection(user_cursor)
        user_cursor.close()
        user_conn.close()
        connections.remove(user_conn)
        
        # Process ARTICLE table
        print("\n[3/3] Processing article table...")
        article_conn = get_connection(ARTICLE_KEYSPACE)
        connections.append(article_conn)
        article_cursor = article_conn.cursor()
        optimize_connection(article_cursor)
        
        if args.truncate:
            truncate_table(article_conn, article_cursor, "article")
        
        print("  Inserting articles...")
        for batch in batch_generator(gen_article, args.articles, ARTICLE_BATCH_SIZE, base_time=base_time, articles_count=args.articles):
            article_count += bulk_insert_articles(article_cursor, batch)
            article_conn.commit()
            print_progress(article_count, args.articles, "Articles")
        print(f"\n  ✓ Inserted {article_count:,} articles")
        
        restore_connection(article_cursor)
        article_cursor.close()
        article_conn.close()
        connections.remove(article_conn)
        
        # Now insert reads (users and articles are populated)
        print("  Inserting reads...")
        for batch in batch_generator(gen_read, args.reads, READ_BATCH_SIZE,
                                     base_time=base_time, users_count=args.users, articles_count=args.articles, reads_count=args.reads):
            read_count += bulk_insert_reads(read_cursor, batch)
            read_conn.commit()
            print_progress(read_count, args.reads, "Reads")
        print(f"\n  ✓ Inserted {read_count:,} reads")
        
        restore_connection(read_cursor)
        read_cursor.close()
        read_conn.close()
        connections.remove(read_conn)
        
        print("\n" + "=" * 60)
        print("BULK INSERT COMPLETE")
        print("=" * 60)
        print(f"Total records: {user_count + article_count + read_count:,}")
        
    except Error as e:
        print(f"\nDatabase error: {e}")
        raise
    finally:
        for conn in connections:
            try:
                if conn.is_connected():
                    conn.close()
            except:
                pass
        print("\nConnections closed.")


if __name__ == "__main__":
    main()

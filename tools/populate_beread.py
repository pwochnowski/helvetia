#!/usr/bin/env python3
"""
Populate BeRead Table
Aggregates read statistics per article by joining article and read tables.

Usage:
    python populate_beread.py [--host HOST] [--port PORT] [--batch-size N]
"""

import argparse
import json
from typing import Dict, List, Any

import mysql.connector
from mysql.connector import Error

# Configuration
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 15306  # VTGate port
DEFAULT_USER = "root"
DEFAULT_PASSWORD = ""

# Keyspaces
ARTICLE_KEYSPACE = "article_keyspace"
READ_KEYSPACE = "read_keyspace"
BEREAD_KEYSPACE = "beread_keyspace"

DEFAULT_BATCH_SIZE = 500


def get_connection(host: str, port: int):
    """Create a connection to VTGate."""
    return mysql.connector.connect(
        host=host,
        port=port,
        user=DEFAULT_USER,
        password=DEFAULT_PASSWORD,
        autocommit=True
    )


def fetch_all_articles(conn) -> List[Dict[str, Any]]:
    """Fetch all articles with their aid and category."""
    cursor = conn.cursor(dictionary=True)
    cursor.execute(f"SELECT aid, category FROM {ARTICLE_KEYSPACE}.article")
    articles = cursor.fetchall()
    cursor.close()
    print(f"Found {len(articles)} articles")
    return articles


def fetch_read_stats_for_article(conn, aid: str) -> Dict[str, Any]:
    """Fetch aggregated read statistics for a single article."""
    cursor = conn.cursor(dictionary=True)
    
    # Get all reads for this article
    cursor.execute(f"""
        SELECT uid, agreeOrNot, commentOrNot, shareOrNot 
        FROM {READ_KEYSPACE}.read 
        WHERE aid = %s
    """, (aid,))
    
    reads = cursor.fetchall()
    cursor.close()
    
    # Aggregate statistics
    read_uids = []
    comment_uids = []
    agree_uids = []
    share_uids = []
    
    for r in reads:
        uid = r['uid']
        read_uids.append(uid)
        if r['commentOrNot']:
            comment_uids.append(uid)
        if r['agreeOrNot']:
            agree_uids.append(uid)
        if r['shareOrNot']:
            share_uids.append(uid)
    
    return {
        'readNum': len(read_uids),
        'readUidList': read_uids,
        'commentNum': len(comment_uids),
        'commentUidList': comment_uids,
        'agreeNum': len(agree_uids),
        'agreeUidList': agree_uids,
        'shareNum': len(share_uids),
        'shareUidList': share_uids
    }


def insert_beread_batch(conn, batch: List[Dict[str, Any]]):
    """Insert a batch of beread records."""
    if not batch:
        return
    
    cursor = conn.cursor()
    
    insert_sql = f"""
        INSERT INTO {BEREAD_KEYSPACE}.beread 
        (id, aid, category, readNum, readUidList, commentNum, commentUidList, 
         agreeNum, agreeUidList, shareNum, shareUidList)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            readNum = VALUES(readNum),
            readUidList = VALUES(readUidList),
            commentNum = VALUES(commentNum),
            commentUidList = VALUES(commentUidList),
            agreeNum = VALUES(agreeNum),
            agreeUidList = VALUES(agreeUidList),
            shareNum = VALUES(shareNum),
            shareUidList = VALUES(shareUidList),
            timestamp = CURRENT_TIMESTAMP
    """
    
    values = [
        (
            record['id'],
            record['aid'],
            record['category'],
            record['readNum'],
            json.dumps(record['readUidList']) if record['readUidList'] else '[]',
            record['commentNum'],
            json.dumps(record['commentUidList']) if record['commentUidList'] else '[]',
            record['agreeNum'],
            json.dumps(record['agreeUidList']) if record['agreeUidList'] else '[]',
            record['shareNum'],
            json.dumps(record['shareUidList']) if record['shareUidList'] else '[]'
        )
        for record in batch
    ]
    
    cursor.executemany(insert_sql, values)
    cursor.close()


def populate_beread(host: str, port: int, batch_size: int):
    """Main function to populate the beread table."""
    print(f"Connecting to VTGate at {host}:{port}...")
    conn = get_connection(host, port)
    
    try:
        # Fetch all articles
        articles = fetch_all_articles(conn)
        
        if not articles:
            print("No articles found. Nothing to populate.")
            return
        
        # Process articles in batches
        batch = []
        processed = 0
        
        for idx, article in enumerate(articles, start=1):
            aid = article['aid']
            category = article['category']
            
            # Get read statistics for this article
            stats = fetch_read_stats_for_article(conn, aid)
            
            # Create beread record
            beread_record = {
                'id': idx,
                'aid': aid,
                'category': category,
                **stats
            }
            batch.append(beread_record)
            
            # Insert batch when full
            if len(batch) >= batch_size:
                insert_beread_batch(conn, batch)
                processed += len(batch)
                print(f"Processed {processed}/{len(articles)} articles...")
                batch = []
        
        # Insert remaining records
        if batch:
            insert_beread_batch(conn, batch)
            processed += len(batch)
        
        print(f"Successfully populated beread table with {processed} records.")
        
    except Error as e:
        print(f"Database error: {e}")
        raise
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Populate BeRead table from article and read tables")
    parser.add_argument("--host", default=DEFAULT_HOST, help=f"Database host (default: {DEFAULT_HOST})")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Database port (default: {DEFAULT_PORT})")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE, 
                        help=f"Batch size for inserts (default: {DEFAULT_BATCH_SIZE})")
    
    args = parser.parse_args()
    
    populate_beread(args.host, args.port, args.batch_size)


if __name__ == "__main__":
    main()

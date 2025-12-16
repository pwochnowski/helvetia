#!/usr/bin/env python3
"""
Populate PopularRank Table
Aggregates article popularity by temporal buckets (daily, weekly, monthly).
Keeps the top 5 most-read articles for each time bucket.

Usage:
    python populate_popularrank.py [--host HOST] [--port PORT] [--top-n N]
"""

import argparse
import json
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple

import mysql.connector
from mysql.connector import Error

# Configuration
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 15306  # VTGate port
DEFAULT_USER = "root"
DEFAULT_PASSWORD = ""

# Keyspaces
ARTICLE_KEYSPACE = "article_keyspace"
BEREAD_KEYSPACE = "beread_keyspace"
POPULARRANK_KEYSPACE = "popularrank_keyspace"

DEFAULT_TOP_N = 5


def get_connection(host: str, port: int):
    """Create a connection to VTGate."""
    return mysql.connector.connect(
        host=host,
        port=port,
        user=DEFAULT_USER,
        password=DEFAULT_PASSWORD,
        autocommit=True
    )


def fetch_articles_with_reads(conn) -> List[Dict[str, Any]]:
    """
    Fetch all articles joined with their read statistics.
    Returns articles with their aid, timestamp, and readNum.
    """
    cursor = conn.cursor(dictionary=True)
    
    # Fetch articles with their timestamps
    cursor.execute(f"""
        SELECT aid, timestamp 
        FROM {ARTICLE_KEYSPACE}.article
    """)
    articles = {row['aid']: row for row in cursor.fetchall()}
    
    # Fetch read counts from beread
    cursor.execute(f"""
        SELECT aid, readNum 
        FROM {BEREAD_KEYSPACE}.beread
    """)
    beread_stats = {row['aid']: row['readNum'] for row in cursor.fetchall()}
    
    cursor.close()
    
    # Join the data
    result = []
    for aid, article in articles.items():
        result.append({
            'aid': aid,
            'timestamp': article['timestamp'],
            'readNum': beread_stats.get(aid, 0)
        })
    
    print(f"Found {len(result)} articles with read statistics")
    return result


def get_date_range(articles: List[Dict[str, Any]]) -> Tuple[datetime, datetime]:
    """Get the min and max timestamps from articles."""
    timestamps = [a['timestamp'] for a in articles if a['timestamp']]
    if not timestamps:
        # Default to current date if no timestamps
        now = datetime.now()
        return now, now
    return min(timestamps), max(timestamps)


def get_week_start(date: datetime) -> datetime:
    """Get the Monday of the week containing the given date."""
    return date - timedelta(days=date.weekday())


def get_month_start(date: datetime) -> datetime:
    """Get the first day of the month containing the given date."""
    return date.replace(day=1)


def generate_daily_buckets(start_date: datetime, end_date: datetime) -> List[datetime]:
    """Generate all daily bucket dates from start to end."""
    buckets = []
    current = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    while current <= end:
        buckets.append(current)
        current += timedelta(days=1)
    
    return buckets


def generate_weekly_buckets(start_date: datetime, end_date: datetime) -> List[datetime]:
    """Generate all weekly bucket dates (Mondays) from start to end."""
    buckets = []
    current = get_week_start(start_date).replace(hour=0, minute=0, second=0, microsecond=0)
    end = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    while current <= end:
        buckets.append(current)
        current += timedelta(weeks=1)
    
    return buckets


def generate_monthly_buckets(start_date: datetime, end_date: datetime) -> List[datetime]:
    """Generate all monthly bucket dates (1st of month) from start to end."""
    buckets = []
    current = get_month_start(start_date).replace(hour=0, minute=0, second=0, microsecond=0)
    end = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    while current <= end:
        buckets.append(current)
        # Move to next month
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)
    
    return buckets


def article_exists_on_date(article_timestamp: datetime, bucket_date: datetime) -> bool:
    """Check if an article exists on a given date (article was created on or before that date)."""
    if article_timestamp is None:
        return True  # Assume always exists if no timestamp
    article_date = article_timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
    return article_date <= bucket_date


def article_exists_in_week(article_timestamp: datetime, week_start: datetime) -> bool:
    """Check if an article exists during a given week."""
    if article_timestamp is None:
        return True
    article_date = article_timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=6)
    return article_date <= week_end


def article_exists_in_month(article_timestamp: datetime, month_start: datetime) -> bool:
    """Check if an article exists during a given month."""
    if article_timestamp is None:
        return True
    article_date = article_timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
    # Get end of month
    if month_start.month == 12:
        month_end = month_start.replace(year=month_start.year + 1, month=1) - timedelta(days=1)
    else:
        month_end = month_start.replace(month=month_start.month + 1) - timedelta(days=1)
    return article_date <= month_end


def compute_rankings(
    articles: List[Dict[str, Any]], 
    top_n: int
) -> Dict[str, List[Tuple[datetime, List[str]]]]:
    """
    Compute popularity rankings for each temporal granularity.
    
    Returns a dict with keys 'daily', 'weekly', 'monthly', each containing
    a list of (date, [top_n_aids]) tuples.
    """
    if not articles:
        return {'daily': [], 'weekly': [], 'monthly': []}
    
    start_date, end_date = get_date_range(articles)
    print(f"Date range: {start_date.date()} to {end_date.date()}")
    
    rankings = {'daily': [], 'weekly': [], 'monthly': []}
    
    # Daily rankings
    print("Computing daily rankings...")
    daily_buckets = generate_daily_buckets(start_date, end_date)
    for bucket_date in daily_buckets:
        # Filter articles that exist on this date
        eligible = [a for a in articles if article_exists_on_date(a['timestamp'], bucket_date)]
        # Sort by readNum descending, take top N
        top_articles = sorted(eligible, key=lambda x: x['readNum'], reverse=True)[:top_n]
        aid_list = [a['aid'] for a in top_articles]
        rankings['daily'].append((bucket_date, aid_list))
    print(f"  Generated {len(rankings['daily'])} daily buckets")
    
    # Weekly rankings
    print("Computing weekly rankings...")
    weekly_buckets = generate_weekly_buckets(start_date, end_date)
    for week_start in weekly_buckets:
        eligible = [a for a in articles if article_exists_in_week(a['timestamp'], week_start)]
        top_articles = sorted(eligible, key=lambda x: x['readNum'], reverse=True)[:top_n]
        aid_list = [a['aid'] for a in top_articles]
        rankings['weekly'].append((week_start, aid_list))
    print(f"  Generated {len(rankings['weekly'])} weekly buckets")
    
    # Monthly rankings
    print("Computing monthly rankings...")
    monthly_buckets = generate_monthly_buckets(start_date, end_date)
    for month_start in monthly_buckets:
        eligible = [a for a in articles if article_exists_in_month(a['timestamp'], month_start)]
        top_articles = sorted(eligible, key=lambda x: x['readNum'], reverse=True)[:top_n]
        aid_list = [a['aid'] for a in top_articles]
        rankings['monthly'].append((month_start, aid_list))
    print(f"  Generated {len(rankings['monthly'])} monthly buckets")
    
    return rankings


def insert_popularrank(conn, rankings: Dict[str, List[Tuple[datetime, List[str]]]]):
    """Insert popularity rankings into the popular_rank table."""
    cursor = conn.cursor()
    
    # Clear existing data
    print("Clearing existing popular_rank data...")
    cursor.execute(f"DELETE FROM {POPULARRANK_KEYSPACE}.popular_rank")
    
    insert_sql = f"""
        INSERT INTO {POPULARRANK_KEYSPACE}.popular_rank 
        (id, temporalGranularity, articleAidList, rankDate)
        VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            articleAidList = VALUES(articleAidList),
            timestamp = CURRENT_TIMESTAMP
    """
    
    total_inserted = 0
    record_id = 1  # Start with ID 1
    
    for granularity in ['daily', 'weekly', 'monthly']:
        values = []
        for rank_date, aid_list in rankings[granularity]:
            values.append((
                record_id,
                granularity,
                json.dumps(aid_list),
                rank_date.date()
            ))
            record_id += 1
        
        if values:
            cursor.executemany(insert_sql, values)
            total_inserted += len(values)
            print(f"  Inserted {len(values)} {granularity} rankings")
    
    cursor.close()
    print(f"Total inserted: {total_inserted} popularity rankings")


def populate_popularrank(host: str, port: int, top_n: int):
    """Main function to populate the popular_rank table."""
    print(f"Connecting to VTGate at {host}:{port}...")
    conn = get_connection(host, port)
    
    try:
        # Fetch articles with read statistics
        articles = fetch_articles_with_reads(conn)
        
        if not articles:
            print("No articles found. Nothing to populate.")
            return
        
        # Compute rankings for each granularity
        rankings = compute_rankings(articles, top_n)
        
        # Insert into database
        print("\nInserting rankings into popular_rank table...")
        insert_popularrank(conn, rankings)
        
        print("\nSuccessfully populated popular_rank table!")
        
    except Error as e:
        print(f"Database error: {e}")
        raise
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Populate PopularRank table from article and beread tables"
    )
    parser.add_argument(
        "--host", 
        default=DEFAULT_HOST, 
        help=f"Database host (default: {DEFAULT_HOST})"
    )
    parser.add_argument(
        "--port", 
        type=int, 
        default=DEFAULT_PORT, 
        help=f"Database port (default: {DEFAULT_PORT})"
    )
    parser.add_argument(
        "--top-n", 
        type=int, 
        default=DEFAULT_TOP_N,
        help=f"Number of top articles to keep per bucket (default: {DEFAULT_TOP_N})"
    )
    
    args = parser.parse_args()
    
    populate_popularrank(args.host, args.port, args.top_n)


if __name__ == "__main__":
    main()

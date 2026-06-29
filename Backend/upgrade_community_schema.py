"""
SnapFix AI — Community Posts Schema Upgrade
Adds all missing columns to community_posts if they don't exist.
"""
import sys
import os
sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv
load_dotenv()

import mysql.connector

def get_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "snapfixai"),
        port=int(os.getenv("MYSQL_PORT", 3306))
    )

def add_column_if_missing(cursor, db, table, col, definition):
    cursor.execute("""
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s AND COLUMN_NAME=%s
    """, (db, table, col))
    if cursor.fetchone()[0] == 0:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {definition}")
        print(f"  [ADDED] {col}")
    else:
        print(f"  [OK]    {col} already exists")

def main():
    db = os.getenv("MYSQL_DATABASE", "snapfixai")
    conn = get_connection()
    cursor = conn.cursor()

    print("=" * 60)
    print("  SnapFix AI — community_posts schema upgrade")
    print("=" * 60)

    columns = [
        ("friendly_title",          "VARCHAR(300) NULL"),
        ("report_status",           "VARCHAR(50) DEFAULT 'Reported'"),
        ("report_category",         "VARCHAR(100) NULL"),
        ("report_location",         "TEXT NULL"),
        ("department_name",         "VARCHAR(100) NULL"),
        ("officer_name",            "VARCHAR(100) NULL"),
        ("road_damage_percentage",  "VARCHAR(20) NULL"),
        ("resolution_time",         "VARCHAR(50) NULL"),
        ("bookmarks_count",         "INT DEFAULT 0"),
        ("featured_post",           "TINYINT(1) DEFAULT 0"),
        # fix varchar widths if too narrow
    ]

    try:
        for col, defn in columns:
            add_column_if_missing(cursor, db, "community_posts", col, defn)

        # Also widen title/image columns if needed
        cursor.execute("ALTER TABLE community_posts MODIFY COLUMN title VARCHAR(300) NULL")
        cursor.execute("ALTER TABLE community_posts MODIFY COLUMN image_before VARCHAR(500) NULL")
        cursor.execute("ALTER TABLE community_posts MODIFY COLUMN image_after VARCHAR(500) NULL")
        print("  [OK]    Column widths updated")

        conn.commit()
        print("\n[DONE] Schema upgrade complete!")
    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()

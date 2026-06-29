"""
SnapFix AI — Community Feed Database Migration
Creates community_posts, community_post_likes, community_post_comments, community_post_contributors
"""
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "snapfixai"),
        port=os.getenv("MYSQL_PORT", 3306)
    )


def add_column_if_not_exists(cursor, db_name, table, column, definition):
    cursor.execute("""
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = %s
          AND TABLE_NAME = %s
          AND COLUMN_NAME = %s
    """, (db_name, table, column))
    exists = cursor.fetchone()[0]
    if not exists:
        print(f"  Adding column '{column}' to '{table}'...")
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
    else:
        print(f"  Column '{column}' already exists in '{table}'.")


def main():
    db_name = os.getenv("MYSQL_DATABASE", "snapfixai")
    print(f"\n{'='*60}")
    print(f"  SnapFix AI — Community Feed Migration")
    print(f"  Database: {db_name}")
    print(f"{'='*60}\n")

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # ----------------------------------------------------------------
        # 1. community_posts
        # ----------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS community_posts (
                id                    INT AUTO_INCREMENT PRIMARY KEY,
                report_id             INT NOT NULL,
                post_type             ENUM('report', 'resolved') NOT NULL DEFAULT 'report',
                author_type           ENUM('citizen', 'pmc') NOT NULL DEFAULT 'citizen',
                department_id         INT NULL,

                -- Display fields
                title                 VARCHAR(300),
                friendly_title        VARCHAR(300),
                content               TEXT,
                report_post_caption   TEXT,
                resolution_post_caption TEXT,

                -- Images
                image_before          VARCHAR(500),
                image_after           VARCHAR(500),

                -- Meta fields (denormalised for feed performance)
                report_status         VARCHAR(50) DEFAULT 'Reported',
                report_category       VARCHAR(100),
                report_location       TEXT,
                department_name       VARCHAR(100),
                officer_name          VARCHAR(100),
                road_damage_percentage VARCHAR(20),
                resolution_time       VARCHAR(50),

                -- Engagement counters
                contributors_count    INT DEFAULT 1,
                likes_count           INT DEFAULT 0,
                comments_count        INT DEFAULT 0,
                views_count           INT DEFAULT 0,
                shares_count          INT DEFAULT 0,
                bookmarks_count       INT DEFAULT 0,

                -- Future-ready flags
                featured_post         TINYINT(1) DEFAULT 0,

                created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                INDEX idx_report_id   (report_id),
                INDEX idx_post_type   (post_type),
                INDEX idx_report_status (report_status),
                INDEX idx_created_at  (created_at DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        print("[OK] Table 'community_posts' checked/created.")

        # ----------------------------------------------------------------
        # 2. community_post_likes
        # ----------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS community_post_likes (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                post_id    INT NOT NULL,
                user_id    INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_post_user (post_id, user_id),
                INDEX idx_post_id (post_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        print("[OK] Table 'community_post_likes' checked/created.")

        # ----------------------------------------------------------------
        # 3. community_post_comments
        # ----------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS community_post_comments (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                post_id    INT NOT NULL,
                user_id    INT NOT NULL,
                comment    TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_post_id (post_id),
                INDEX idx_created_at (created_at DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        print("[OK] Table 'community_post_comments' checked/created.")

        # ----------------------------------------------------------------
        # 4. community_post_contributors
        # ----------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS community_post_contributors (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                post_id    INT NOT NULL,
                report_id  INT NOT NULL,
                user_id    INT NOT NULL,
                role       ENUM('Original Reporter', 'Supporter') NOT NULL DEFAULT 'Original Reporter',
                area       VARCHAR(255),
                confidence FLOAT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_post_id   (post_id),
                INDEX idx_user_id   (user_id),
                INDEX idx_report_id (report_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        print("[OK] Table 'community_post_contributors' checked/created.")

        conn.commit()
        print(f"\n{'='*60}")
        print("  Community Feed Migration Completed Successfully!")
        print(f"{'='*60}\n")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Migration failed: {e}")
        raise e
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()

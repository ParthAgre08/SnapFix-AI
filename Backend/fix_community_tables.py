import sys
sys.stdout.reconfigure(encoding='utf-8')
from dotenv import load_dotenv
load_dotenv()
from services.database_service import get_connection

conn = get_connection()
c = conn.cursor()
db = 'snapfixai'

fixes = [
    ('community_post_contributors', 'role',       "ENUM('Original Reporter','Supporter') NOT NULL DEFAULT 'Original Reporter'"),
    ('community_post_contributors', 'area',        "VARCHAR(255) NULL"),
    ('community_post_contributors', 'confidence',  "FLOAT DEFAULT 0"),
    ('community_post_likes',        'user_id',     "INT NOT NULL DEFAULT 0"),
    ('community_post_comments',     'comment',     "TEXT NOT NULL"),
]

for table, col, defn in fixes:
    c.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s AND COLUMN_NAME=%s", (db, table, col))
    if c.fetchone()[0] == 0:
        try:
            c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {defn}")
            print(f"[ADDED] {table}.{col}")
        except Exception as e:
            print(f"[ERR]   {table}.{col}: {e}")
    else:
        print(f"[OK]    {table}.{col} exists")

conn.commit()
c.close()
conn.close()
print("All done!")

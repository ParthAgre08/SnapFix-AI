import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE"),
        port=os.getenv("MYSQL_PORT")
    )

def add_column_if_not_exists(cursor, db_name, table, column, definition):
    cursor.execute(f"""
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = %s
          AND TABLE_NAME = %s
          AND COLUMN_NAME = %s
    """, (db_name, table, column))
    exists = cursor.fetchone()[0]
    if not exists:
        print(f"Adding column '{column}' to table '{table}'...")
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
    else:
        print(f"Column '{column}' already exists in table '{table}'.")

def main():
    db_name = os.getenv("MYSQL_DATABASE", "snapfixai")
    print(f"Connecting to database '{db_name}'...")
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Add required columns to reports table
        columns_to_add = [
            ("annotated_image", "VARCHAR(255) NULL"),
            ("detection_count", "INT NULL"),
            ("bounding_boxes", "JSON NULL"),
            ("severity", "VARCHAR(50) NULL"),
            ("priority", "VARCHAR(50) NULL"),
            ("recommended_action", "TEXT NULL"),
            ("ai_response_json", "JSON NULL"),
            ("user_description", "TEXT NULL"),
            ("ai_social_caption", "TEXT NULL"),
            ("road_damage_percentage", "VARCHAR(50) NULL")
        ]
        
        for col_name, col_def in columns_to_add:
            add_column_if_not_exists(cursor, db_name, "reports", col_name, col_def)
            
        conn.commit()
        print("Database schema successfully updated!")
    except Exception as e:
        conn.rollback()
        print(f"Error updating database schema: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()

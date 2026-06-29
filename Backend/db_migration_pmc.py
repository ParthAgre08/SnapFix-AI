import mysql.connector
import os
import sys
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

# Load env from current directory
load_dotenv()

def get_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", "snapfixai@12345"),
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
        print(f"Adding column '{column}' to table '{table}'...")
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
    else:
        print(f"Column '{column}' already exists in table '{table}'.")

def main():
    db_name = os.getenv("MYSQL_DATABASE", "snapfixai")
    print(f"Starting PMC Database Migration for database '{db_name}'...")
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Create Departments Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS departments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                icon VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Table 'departments' checked/created.")

        # 2. Create Officers Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS officers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                department VARCHAR(100),
                designation VARCHAR(100),
                employee_code VARCHAR(50) UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Table 'officers' checked/created.")

        # 3. Create Report Assignments Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS report_assignments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                report_id INT NOT NULL,
                officer_id INT NOT NULL,
                department_id INT NOT NULL,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                accepted_at TIMESTAMP NULL,
                completed_at TIMESTAMP NULL,
                status VARCHAR(50) DEFAULT 'Assigned',
                officer_notes TEXT,
                resolution_image VARCHAR(255),
                resolution_summary TEXT
            )
        """)
        print("Table 'report_assignments' checked/created.")

        # 4. Create Report Workflow Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS report_workflow (
                id INT AUTO_INCREMENT PRIMARY KEY,
                report_id INT NOT NULL,
                previous_status VARCHAR(50),
                new_status VARCHAR(50),
                action VARCHAR(100),
                performed_by VARCHAR(100),
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Table 'report_workflow' checked/created.")

        # 5. Create Report Resolution Images Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS report_resolution_images (
                id INT AUTO_INCREMENT PRIMARY KEY,
                report_id INT NOT NULL,
                image_path VARCHAR(255) NOT NULL,
                uploaded_by INT NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Table 'report_resolution_images' checked/created.")

        # 5b. Create Notifications Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                report_id INT NULL,
                title VARCHAR(150) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) NOT NULL,
                is_read TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Table 'notifications' checked/created.")

        # 6. Alter status column in reports table to support 'Reported'
        print("Modifying reports status column...")
        cursor.execute("""
            ALTER TABLE reports MODIFY COLUMN status 
            ENUM('Pending', 'Reported', 'Duplicate', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected') 
            DEFAULT 'Reported'
        """)
        
        # 7. Add columns to reports table
        reports_cols = [
            ("assigned_department_id", "INT NULL"),
            ("assigned_officer_id", "INT NULL"),
            ("resolved_at", "TIMESTAMP NULL"),
            ("estimated_completion", "TIMESTAMP NULL"),
            ("resolution_summary", "TEXT NULL")
        ]
        for col, col_def in reports_cols:
            add_column_if_not_exists(cursor, db_name, "reports", col, col_def)

        # 8. Migrate any existing 'Pending' status reports to 'Reported'
        cursor.execute("UPDATE reports SET status = 'Reported' WHERE status = 'Pending'")
        print("Migrated existing 'Pending' status reports to 'Reported'.")

        # 9. Seed departments
        departments_data = [
            ("Road Department", "Handles potholes, cracks, resurfacing, paving, and sidewalk repairs.", "AlertTriangle"),
            ("Sanitation", "Manages garbage overflows, bin cleaning, street sweeping, and waste management.", "Trash2"),
            ("Electrical", "Fixes streetlights, flickering lights, exposed wiring, and junction boxes.", "Lightbulb"),
            ("Water Department", "Addresses water main leakages, pipe bursts, and drainage overflows.", "Droplet")
        ]
        for name, desc, icon in departments_data:
            cursor.execute("SELECT id FROM departments WHERE name = %s", (name,))
            if not cursor.fetchone():
                cursor.execute("INSERT INTO departments (name, description, icon) VALUES (%s, %s, %s)", (name, desc, icon))
                print(f"Seeded department: {name}")

        # 10. Seed officers
        officers_data = [
            ("Ramesh Kumar", "ramesh.kumar@pmc.gov.in", "Road Department", "Assistant Engineer", "PMC-ROAD-001"),
            ("Suresh Patil", "suresh.patil@pmc.gov.in", "Sanitation", "Sanitation Inspector", "PMC-SAN-002"),
            ("Anita Shinde", "anita.shinde@pmc.gov.in", "Electrical", "Junior Electrical Engineer", "PMC-ELEC-003"),
            ("Vinay Joshi", "vinay.joshi@pmc.gov.in", "Water Department", "Water Works Supervisor", "PMC-WATER-004")
        ]
        
        hashed_pwd = generate_password_hash("password123")
        for name, email, dept, desig, emp_code in officers_data:
            cursor.execute("SELECT id FROM officers WHERE email = %s", (email,))
            if not cursor.fetchone():
                cursor.execute("""
                    INSERT INTO officers (name, email, department, designation, employee_code, password_hash)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (name, email, dept, desig, emp_code, hashed_pwd))
                print(f"Seeded officer: {name} ({email})")

        conn.commit()
        print("PMC Database Migration Completed Successfully!")
    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        raise e
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()

"""
SnapFix AI — Community Feed Backfill Script (v2 - fixed)
Creates community_posts for all existing reports that don't have one yet.
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
        port=int(os.getenv("MYSQL_PORT", 3306)),
        autocommit=False
    )

def get_dept_name(category):
    cat = (category or "").lower()
    if any(c in cat for c in ['pothole', 'road', 'crack', 'pavement']):
        return 'Road Department'
    elif any(c in cat for c in ['garbage', 'sanit', 'graffiti', 'litter', 'waste', 'dustbin']):
        return 'Sanitation'
    elif any(c in cat for c in ['electric', 'streetlight', 'street light', 'lamp', 'wire', 'bulb']):
        return 'Electrical'
    elif any(c in cat for c in ['water', 'drainage', 'drain', 'flood', 'pipe', 'sewer']):
        return 'Water Department'
    return 'Road Department'

def main():
    print("=" * 60)
    print("  SnapFix AI — Community Feed Backfill v2")
    print("=" * 60)

    # Use a single READ connection to fetch data
    read_conn = get_connection()
    read_cur = read_conn.cursor(dictionary=True)

    read_cur.execute("""
        SELECT r.*,
               u.full_name as reporter_name,
               o.name as officer_name_val,
               o.department as officer_dept,
               d.id as dept_id_val,
               d.name as dept_name_val
        FROM reports r
        LEFT JOIN users u ON u.id = r.user_id
        LEFT JOIN officers o ON o.id = r.assigned_officer_id
        LEFT JOIN departments d ON d.id = r.assigned_department_id
        WHERE r.id NOT IN (
            SELECT DISTINCT report_id FROM community_posts WHERE post_type = 'report'
        )
        ORDER BY r.created_at ASC
    """)
    reports = read_cur.fetchall()
    read_cur.close()
    read_conn.close()

    print(f"Found {len(reports)} report(s) without community posts.\n")

    created_report_posts = 0
    created_resolution_posts = 0
    skipped = 0

    for report in reports:
        # Open a fresh connection per report to avoid transaction state issues
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        try:
            report_id  = report['id']
            user_id    = report['user_id'] or 1
            category   = report['category'] or 'Issue'
            location   = report['address'] or 'Pune'
            image_before = report.get('image_path') or ''
            ai_desc    = report.get('ai_description') or report.get('description') or ''
            road_dmg   = report.get('road_damage_percentage')
            status     = report['status']
            is_dup     = report.get('duplicate_report_id') is not None

            # Department
            dept_name  = report.get('dept_name_val') or get_dept_name(category)
            dept_id    = report.get('dept_id_val')
            if not dept_id:
                cursor.execute("SELECT id FROM departments WHERE name = %s", (dept_name,))
                dr = cursor.fetchone()
                dept_id = dr['id'] if dr else None

            short_loc = location.split(',')[0].strip() if ',' in location else location
            friendly_title = f"{category} — {short_loc}"
            content = ai_desc or f"A {category.lower()} has been reported near {location}."

            report_caption = (
                f"{category} Alert\n\n"
                f"A {category.lower()} has been reported near {location}. "
                f"SnapFix AI automatically detected and forwarded this complaint to the "
                f"Pune Municipal Corporation {dept_name}.\n\n"
                f"This issue is currently under review.\n\n"
                f"#SnapFixAI #Pune #{category.replace(' ', '')}"
            )

            if not is_dup:
                # CREATE REPORT POST
                cursor.execute("""
                    INSERT INTO community_posts (
                        report_id, post_type, author_type, department_id,
                        title, friendly_title, content, image_before,
                        report_post_caption, report_status, report_category,
                        report_location, department_name, road_damage_percentage,
                        contributors_count, created_at, updated_at
                    ) VALUES (
                        %s, 'report', 'citizen', %s,
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        1, %s, %s
                    )
                """, (
                    report_id, dept_id,
                    friendly_title, friendly_title, content, image_before,
                    report_caption, status, category,
                    location, dept_name, road_dmg,
                    report['created_at'], report['created_at']
                ))
                post_id = cursor.lastrowid

                # Insert original reporter as contributor
                cursor.execute("""
                    INSERT INTO community_post_contributors
                        (post_id, report_id, user_id, role, area, confidence, created_at)
                    VALUES (%s, %s, %s, 'Original Reporter', %s, %s, %s)
                """, (
                    post_id, report_id, user_id, short_loc,
                    float(report.get('ai_confidence') or 0),
                    report['created_at']
                ))

                conn.commit()
                print(f"  [OK] Report post #{post_id} for report #{report_id} — '{friendly_title}' [{status}]")
                created_report_posts += 1

                # CREATE RESOLUTION POST if already resolved
                if status == 'Resolved' and report.get('resolved_at'):
                    officer_name = report.get('officer_name_val') or 'PMC Officer'

                    cursor.execute("""
                        SELECT resolution_image FROM report_assignments
                        WHERE report_id = %s AND status = 'Resolved' LIMIT 1
                    """, (report_id,))
                    ra = cursor.fetchone()
                    resolution_image = ra['resolution_image'] if ra else None

                    res_time_str = None
                    if report['resolved_at'] and report['created_at']:
                        diff_sec = (report['resolved_at'] - report['created_at']).total_seconds()
                        if diff_sec < 3600:
                            res_time_str = f"{round(diff_sec / 60)} Mins"
                        elif diff_sec < 86400:
                            res_time_str = f"{round(diff_sec / 3600, 1)} Hrs"
                        else:
                            res_time_str = f"{round(diff_sec / 86400, 1)} Days"

                    res_caption = (
                        f"{category} Resolved Successfully\n\n"
                        f"The {category.lower()} near {location} has been successfully resolved by "
                        f"Officer {officer_name} of the PMC {dept_name}.\n\n"
                        f"This issue was reported by a diligent citizen and prioritized for prompt action. "
                        f"Thank you for helping improve Pune.\n\n"
                        f"#PMC #SnapFixAI #SmartCity #Pune"
                    )
                    res_friendly = f"{category} Restored — {short_loc}"

                    cursor.execute("""
                        INSERT INTO community_posts (
                            report_id, post_type, author_type, department_id,
                            title, friendly_title, content,
                            image_before, image_after,
                            resolution_post_caption, report_status, report_category,
                            report_location, department_name, officer_name,
                            road_damage_percentage, resolution_time,
                            contributors_count, created_at, updated_at
                        ) VALUES (
                            %s, 'resolved', 'pmc', %s,
                            %s, %s, %s,
                            %s, %s,
                            %s, 'Resolved', %s,
                            %s, %s, %s,
                            %s, %s,
                            1, %s, %s
                        )
                    """, (
                        report_id, dept_id,
                        res_friendly, res_friendly, res_caption,
                        image_before, resolution_image,
                        res_caption, category,
                        location, dept_name, officer_name,
                        road_dmg, res_time_str,
                        report['resolved_at'], report['resolved_at']
                    ))
                    conn.commit()
                    print(f"        [OK] Resolution post also created for report #{report_id} (resolved in {res_time_str})")
                    created_resolution_posts += 1

            else:
                # DUPLICATE: add supporter to original post
                orig_id = report['duplicate_report_id']
                cursor.execute("""
                    SELECT id FROM community_posts
                    WHERE report_id = %s AND post_type = 'report' LIMIT 1
                """, (orig_id,))
                orig = cursor.fetchone()
                if orig:
                    cursor.execute("""
                        INSERT IGNORE INTO community_post_contributors
                            (post_id, report_id, user_id, role, area, confidence, created_at)
                        VALUES (%s, %s, %s, 'Supporter', %s, %s, %s)
                    """, (
                        orig['id'], report_id, user_id, short_loc,
                        float(report.get('ai_confidence') or 0),
                        report['created_at']
                    ))
                    cursor.execute("""
                        UPDATE community_posts
                        SET contributors_count = contributors_count + 1
                        WHERE id = %s
                    """, (orig['id'],))
                    conn.commit()
                    print(f"  [OK] Duplicate #{report_id} added as Supporter to original post {orig['id']}")
                else:
                    print(f"  [WARN] Duplicate #{report_id}: original post for report #{orig_id} not found.")
                    skipped += 1

        except Exception as e:
            conn.rollback()
            print(f"  [FAIL] Report #{report['id']}: {e}")
            skipped += 1
        finally:
            cursor.close()
            conn.close()

    print()
    print("=" * 60)
    print(f"  Backfill Complete!")
    print(f"  Report posts created    : {created_report_posts}")
    print(f"  Resolution posts created: {created_resolution_posts}")
    print(f"  Skipped / failed        : {skipped}")
    print("=" * 60)

if __name__ == "__main__":
    main()

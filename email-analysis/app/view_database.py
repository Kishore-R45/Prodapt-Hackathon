import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )


def view_database():

    conn = get_connection()
    cursor = conn.cursor()

    # =====================================================
    # EMAILS + ANALYSIS + TASKS + DEADLINES
    # =====================================================

    cursor.execute("""
        SELECT
            e.id AS email_id,
            e.subject,
            a.priority,
            a.importance_score,
            t.description AS task,
            t.status,
            d.deadline_text,
            d.deadline_at
        FROM emails e

        LEFT JOIN email_analysis a
            ON e.id = a.email_id

        LEFT JOIN tasks t
            ON e.id = t.email_id

        LEFT JOIN deadlines d
            ON t.id = d.task_id

        ORDER BY e.id, t.id, d.id;
    """)

    rows = cursor.fetchall()

    print("\n")
    print("=" * 130)
    print("STORED EMAIL ANALYSIS")
    print("=" * 130)

    for row in rows:

        print(f"""
Email ID        : {row[0]}
Subject         : {row[1]}
Priority        : {row[2]}
Importance      : {row[3]}
Task            : {row[4]}
Task Status     : {row[5]}
Deadline        : {row[6]}
Deadline Date   : {row[7]}
""")

        print("-" * 130)

    cursor.close()
    conn.close()


if __name__ == "__main__":
    view_database()
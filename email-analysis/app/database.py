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
        password=os.getenv("DB_PASSWORD"),
    )


def create_tables():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS emails (
            id SERIAL PRIMARY KEY,
            message_id VARCHAR(255) UNIQUE NOT NULL,
            sender TEXT,
            recipient TEXT,
            subject TEXT,
            body TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS email_analysis (
            id SERIAL PRIMARY KEY,
            email_id INTEGER UNIQUE NOT NULL
                REFERENCES emails(id) ON DELETE CASCADE,
            priority VARCHAR(20) NOT NULL,
            importance_score DECIMAL(4,3),
            importance_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            email_id INTEGER NOT NULL
                REFERENCES emails(id) ON DELETE CASCADE,
            description TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'PENDING'
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS deadlines (
            id SERIAL PRIMARY KEY,
            email_id INTEGER NOT NULL
                REFERENCES emails(id) ON DELETE CASCADE,
            task_id INTEGER
                REFERENCES tasks(id) ON DELETE SET NULL,
            deadline_text TEXT NOT NULL,
            deadline_at TIMESTAMP NULL
        );
    """)

    conn.commit()

    cursor.close()
    conn.close()

    print("Database tables ready.")


def get_email_data():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            e.id,
            e.message_id,
            e.sender,
            e.recipient,
            e.subject,
            e.body,
            e.created_at,
            a.priority,
            a.importance_score,
            a.importance_reason
        FROM emails e
        LEFT JOIN email_analysis a
            ON e.id = a.email_id
        ORDER BY e.id;
    """)

    emails = cursor.fetchall()

    result = []

    for email in emails:

        email_id = email[0]

        cursor.execute("""
            SELECT
                id,
                description,
                status
            FROM tasks
            WHERE email_id = %s
            ORDER BY id;
        """, (email_id,))

        tasks = cursor.fetchall()

        cursor.execute("""
            SELECT
                d.id,
                d.deadline_text,
                d.deadline_at,
                d.task_id
            FROM deadlines d
            WHERE d.email_id = %s
            ORDER BY d.id;
        """, (email_id,))

        deadlines = cursor.fetchall()

        result.append({
            "email_id": email[0],
            "message_id": email[1],
            "sender": email[2],
            "recipient": email[3],
            "subject": email[4],
            "body": email[5],

            "created_at": (
                email[6].isoformat()
                if email[6]
                else None
            ),

            "analysis": {
                "priority": email[7],
                "importance_score": (
                    float(email[8])
                    if email[8] is not None
                    else None
                ),
                "importance_reason": email[9]
            },

            "tasks": [
                {
                    "task_id": task[0],
                    "description": task[1],
                    "status": task[2]
                }
                for task in tasks
            ],

            "deadlines": [
                {
                    "deadline_id": deadline[0],
                    "text": deadline[1],
                    "datetime": (
                        deadline[2].isoformat()
                        if deadline[2]
                        else None
                    ),
                    "task_id": deadline[3]
                }
                for deadline in deadlines
            ]
        })

    cursor.close()
    conn.close()

    return result
if __name__ == "__main__":

    import json

    data = get_email_data()

    print(
        json.dumps(
            data,
            indent=4
        )
    )
import os
import re
from pathlib import Path

from database import get_connection, create_tables
from analyzer import analyze_email


EMAIL_FOLDER = Path(__file__).parent.parent / "emails"


def extract_header(text, header):

    pattern = rf"^{header}:\s*(.*)$"

    match = re.search(
        pattern,
        text,
        re.MULTILINE | re.IGNORECASE
    )

    if match:
        return match.group(1).strip()

    return None


def store_email(filename, email_text, analysis):

    sender = extract_header(
        email_text,
        "From"
    )

    recipient = extract_header(
        email_text,
        "To"
    )

    subject = extract_header(
        email_text,
        "Subject"
    )

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # --------------------------------
        # 1. Store email
        # --------------------------------

        cursor.execute(
            """
            INSERT INTO emails
            (
                message_id,
                sender,
                recipient,
                subject,
                body
            )
            VALUES (%s, %s, %s, %s, %s)

            ON CONFLICT (message_id)
            DO UPDATE SET
                sender = EXCLUDED.sender,
                recipient = EXCLUDED.recipient,
                subject = EXCLUDED.subject,
                body = EXCLUDED.body

            RETURNING id;
            """,
            (
                filename,
                sender,
                recipient,
                subject,
                email_text
            )
        )

        email_id = cursor.fetchone()[0]

        # --------------------------------
        # 2. Remove old analysis
        # --------------------------------

        cursor.execute(
            """
            DELETE FROM email_analysis
            WHERE email_id = %s
            """,
            (email_id,)
        )

        cursor.execute(
            """
            DELETE FROM deadlines
            WHERE email_id = %s
            """,
            (email_id,)
        )

        cursor.execute(
            """
            DELETE FROM tasks
            WHERE email_id = %s
            """,
            (email_id,)
        )

        # --------------------------------
        # 3. Store importance
        # --------------------------------

        cursor.execute(
            """
            INSERT INTO email_analysis
            (
                email_id,
                priority,
                importance_score,
                importance_reason
            )
            VALUES (%s, %s, %s, %s)
            """,
            (
                email_id,
                analysis["priority"],
                analysis["importance_score"],
                analysis["importance_reason"]
            )
        )

        # --------------------------------
        # 4. Store tasks
        # --------------------------------

        task_ids = {}

        for task in analysis["tasks"]:

            cursor.execute(
                """
                INSERT INTO tasks
                (
                    email_id,
                    description,
                    status
                )
                VALUES (%s, %s, %s)

                RETURNING id;
                """,
                (
                    email_id,
                    task["description"],
                    task["status"]
                )
            )

            task_id = cursor.fetchone()[0]

            task_ids[
                task["description"].lower()
            ] = task_id

        # --------------------------------
        # 5. Store deadlines
        # --------------------------------

        for deadline in analysis["deadlines"]:

            task_id = None

            task_description = (
                deadline.get("task_description")
            )

            if task_description:

                task_id = task_ids.get(
                    task_description.lower()
                )

            cursor.execute(
                """
                INSERT INTO deadlines
                (
                    email_id,
                    task_id,
                    deadline_text,
                    deadline_at
                )
                VALUES (%s, %s, %s, %s)
                """,
                (
                    email_id,
                    task_id,
                    deadline["text"],
                    deadline.get("datetime")
                )
            )

        conn.commit()

        print(
            f"Stored {filename} successfully."
        )

    except Exception:

        conn.rollback()
        raise

    finally:

        cursor.close()
        conn.close()


def main():

    print("\nStarting Email Analysis...\n")

    create_tables()

    email_files = sorted(
        EMAIL_FOLDER.glob("email*.txt")
    )

    if not email_files:

        print(
            "No email files found in:",
            EMAIL_FOLDER
        )

        return

    for email_file in email_files:

        print("=" * 60)

        print(
            f"Processing: {email_file.name}"
        )

        email_text = email_file.read_text(
            encoding="utf-8"
        )

        print("\nAnalyzing with Llama...\n")

        analysis = analyze_email(
            email_text
        )

        print("AI RESULT:")
        print("=" * 40)

        print(
            f"Priority: "
            f"{analysis['priority']}"
        )

        print(
            f"Importance Score: "
            f"{analysis['importance_score']}"
        )

        print(
            f"Reason: "
            f"{analysis['importance_reason']}"
        )

        print("\nTasks:")

        for task in analysis["tasks"]:

            print(
                f"  - {task['description']}"
            )

        print("\nDeadlines:")

        for deadline in analysis["deadlines"]:

            print(
                f"  - {deadline['text']}"
            )

        store_email(
            email_file.name,
            email_text,
            analysis
        )

    print("\n")
    print("=" * 60)
    print("ALL EMAILS PROCESSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
import os
import tkinter as tk
from tkinter import ttk

import psycopg2
from dotenv import load_dotenv
from tkcalendar import Calendar

load_dotenv()


def get_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )


def get_deadlines():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            d.id,
            e.subject,
            t.description,
            d.deadline_text,
            d.deadline_at
        FROM deadlines d

        JOIN emails e
            ON d.email_id = e.id

        LEFT JOIN tasks t
            ON d.task_id = t.id

        WHERE d.deadline_at IS NOT NULL

        ORDER BY d.deadline_at;
    """)

    deadlines = cursor.fetchall()

    cursor.close()
    conn.close()

    return deadlines


def show_calendar():

    deadlines = get_deadlines()

    root = tk.Tk()
    root.title("Email Deadline Calendar")
    root.geometry("750x600")

    # ---------------------------------------------------------
    # Calendar
    # ---------------------------------------------------------

    calendar = Calendar(
        root,
        selectmode="day",
        year=2026,
        month=8,
        day=8,
        date_pattern="yyyy-mm-dd"
    )

    calendar.pack(
        padx=20,
        pady=20
    )

    # ---------------------------------------------------------
    # Mark deadline dates
    # ---------------------------------------------------------

    calendar.tag_config(
        "deadline",
        background="red",
        foreground="white"
    )

    deadline_data = {}

    for deadline in deadlines:

        deadline_id = deadline[0]
        subject = deadline[1]
        task = deadline[2]
        deadline_text = deadline[3]
        deadline_at = deadline[4]

        if deadline_at is None:
            continue

        date_string = deadline_at.strftime("%Y-%m-%d")

        calendar.calevent_create(
            deadline_at,
            f"DEADLINE: {task}",
            "deadline"
        )

        deadline_data[date_string] = {
            "id": deadline_id,
            "subject": subject,
            "task": task,
            "deadline": deadline_text,
            "datetime": deadline_at
        }

    # ---------------------------------------------------------
    # Deadline details
    # ---------------------------------------------------------

    details_frame = ttk.LabelFrame(
        root,
        text="Deadline Details"
    )

    details_frame.pack(
        fill="both",
        expand=True,
        padx=20,
        pady=(0, 20)
    )

    details_label = ttk.Label(
        details_frame,
        text="Select a marked date to view the deadline.",
        justify="left"
    )

    details_label.pack(
        padx=20,
        pady=20,
        anchor="w"
    )

    # ---------------------------------------------------------
    # Date selection
    # ---------------------------------------------------------

    def show_selected_date(event=None):

        selected_date = calendar.get_date()

        data = deadline_data.get(selected_date)

        if data is None:

            details_label.config(
                text=f"No deadline on {selected_date}."
            )

            return

        details_label.config(
            text=(
                f"Date: {selected_date}\n\n"
                f"Email: {data['subject']}\n\n"
                f"Task: {data['task']}\n\n"
                f"Deadline: {data['deadline']}\n\n"
                f"Time: {data['datetime']}"
            )
        )

    calendar.bind(
        "<<CalendarSelected>>",
        show_selected_date
    )

    root.mainloop()


if __name__ == "__main__":
    show_calendar()
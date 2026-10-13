import logging
import os
import smtplib
from email.message import EmailMessage

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("app.email")

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
EMAIL_FROM = os.getenv("EMAIL_FROM", "Pepper AI <onboarding@resend.dev>")
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
APP_ENV = os.getenv("APP_ENV", "development")


def _send_via_resend(to_email: str, subject: str, html: str) -> None:
    response = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
        json={"from": EMAIL_FROM, "to": [to_email], "subject": subject, "html": html},
        timeout=10,
    )
    response.raise_for_status()


def _send_via_smtp(to_email: str, subject: str, html: str) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = EMAIL_FROM
    message["To"] = to_email
    message.set_content("Your Pepper AI verification code is in the HTML part of this email.")
    message.add_alternative(html, subtype="html")

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
        server.starttls()
        if SMTP_USERNAME and SMTP_PASSWORD:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(message)


def send_verification_code_email(to_email: str, code: str) -> None:
    subject = "Your Pepper AI verification code"
    html = f"""
    <div style="font-family: sans-serif;">
      <p>Enter this code to verify your email address:</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px;">{code}</p>
      <p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>
    """

    if RESEND_API_KEY:
        _send_via_resend(to_email, subject, html)
        return
    if SMTP_HOST:
        _send_via_smtp(to_email, subject, html)
        return
    if APP_ENV != "production":
        logger.warning("No email provider configured. Verification code for %s is: %s", to_email, code)
        return
    raise RuntimeError("No email provider configured: set RESEND_API_KEY or SMTP_HOST")

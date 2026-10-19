"""Optional external email deliverability check.

Runs only when EMAIL_VERIFIER_API_KEY is set (Abstract API by default).
Without a key this is a no-op so local dev and CI are unaffected.
"""

import os
from typing import Literal

import httpx

EMAIL_VERIFIER_API_KEY = os.getenv("EMAIL_VERIFIER_API_KEY")
EMAIL_VERIFIER_TIMEOUT_SECONDS = 10

Message = Literal[
    "success",           # deliverable
    "invalid_address",   # syntax/domain problem
    "undeliverable",     # valid syntax, mailbox doesn't exist
    "unknown",           # provider couldn't decide
    "blocked",           # role account / disposable / low quality
    "catchall",          # catch-all domain, deliverability not guaranteed
]


def check_email_deliverability(email: str) -> Message:
    """Return a deliverability verdict for an email address.

    Raises httpx.HTTPError on network failure and RuntimeError when the
    provider returns an unexpected response — callers decide whether that
    should block signup.
    """
    if not EMAIL_VERIFIER_API_KEY:
        return "success"

    url = "https://emailvalidation.abstractapi.com/v1/"
    params = {"api_key": EMAIL_VERIFIER_API_KEY, "email": email}

    with httpx.Client(timeout=EMAIL_VERIFIER_TIMEOUT_SECONDS) as client:
        response = client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    deliverability = data.get("deliverability", "UNKNOWN").upper()
    if deliverability == "DELIVERABLE":
        return "success"
    if deliverability == "UNDELIVERABLE":
        return "undeliverable"

    quality = str(data.get("quality_score", "0.0"))
    try:
        if float(quality) < 0.7:
            return "blocked"
    except ValueError:
        pass
    return "unknown"


VERDICT_MESSAGES: dict[Message, str] = {
    "success": "",
    "invalid_address": "That email address doesn't look valid.",
    "undeliverable": "That email address doesn't appear to exist.",
    "unknown": "We couldn't verify that email address right now. Please try again.",
    "blocked": "That email address isn't allowed (temporary or shared mailbox).",
    "catchall": "That email address isn't allowed (temporary or shared mailbox).",
}

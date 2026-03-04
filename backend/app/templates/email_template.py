# app/templates/email_template.py

from typing import Dict, Tuple

from app.models.user import User

# Import all locales
from app.templates.locales.en import LOCALE as EN
from app.templates.locales.hi import LOCALE as HI
from app.templates.locales.kn import LOCALE as KN
from app.templates.locales.ta import LOCALE as TA
from app.templates.locales.te import LOCALE as TE
from app.templates.locales.ml import LOCALE as ML


# =========================================================
# Locale Registry
# =========================================================

LOCALES = {
    "en": EN,
    "hi": HI,
    "kn": KN,
    "ta": TA,
    "te": TE,
    "ml": ML,
}

DEFAULT_LANGUAGE = "en"


# =========================================================
# Resolve Language
# =========================================================

def _resolve_language(user: User | None, context: Dict | None) -> str:
    """
    Language priority:

    1. user.preferred_language
    2. context["language"]
    3. default (en)
    """

    if user and getattr(user, "preferred_language", None):
        lang = user.preferred_language.value \
            if hasattr(user.preferred_language, "value") \
            else user.preferred_language

        if lang in LOCALES:
            return lang

    if context:
        lang = context.get("language")
        if lang in LOCALES:
            return lang

    return DEFAULT_LANGUAGE


# =========================================================
# Safe Format Helper
# =========================================================

def _safe_format(template: str, context: Dict | None) -> str:
    """
    Prevent KeyError if placeholder missing.
    """

    context = context or {}

    try:
        return template.format(**context)
    except KeyError:
        return template


# =========================================================
# Render Template
# =========================================================

def render_notification(
    *,
    event_type: str,
    user: User | None = None,
    context: Dict | None = None,
) -> Dict[str, str]:
    """
    Returns dictionary containing:

    {
        email_subject,
        email_body,
        email_text,
        push_title,
        push_body,
        sms_body,
        in_app_message
    }
    """

    language = _resolve_language(user, context)

    locale = LOCALES.get(language, LOCALES[DEFAULT_LANGUAGE])

    template = locale.get(event_type)

    if not template:
        raise ValueError(f"No template found for event: {event_type}")

    signature = locale["signature"]
    auto_footer = locale["auto_footer"]

    # Format dynamic placeholders safely
    email_body = _safe_format(template["email_body"], context)
    email_text = _safe_format(template["email_text"], context)
    sms_body = _safe_format(template["sms_body"], context)
    push_body = _safe_format(template["push_body"], context)
    in_app_message = _safe_format(template["in_app_message"], context)

    # Wrap email body with signature + footer
    final_email_body = f"""
        {email_body}
        <br><br>
        {signature}
        <br><br>
        <hr>
        <p style="font-size:12px;color:#888;">
            {auto_footer}
        </p>
    """

    return {
        "email_subject": template["email_subject"],
        "email_body": final_email_body,
        "email_text": email_text,
        "push_title": template["push_title"],
        "push_body": push_body,
        "sms_body": sms_body,
        "in_app_message": in_app_message,
        "template_version": template.get("version", 1),
        "language": language,
    }
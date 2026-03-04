# app/templates/locales/en.py

TEMPLATE_VERSION = "v1"

LOCALE = {

    "meta": {
        "language": "English",
        "code": "en",
        "version": TEMPLATE_VERSION,
    },

    "signature": "Regards,<br><strong>Sentinel Tour Team</strong>",

    "auto_footer": (
        "This is an automated notification from Sentinel Tour. "
        "Please do not reply to this email."
    ),

    # =========================================================
    # USER REGISTERED
    # =========================================================

    "USER_REGISTERED": {
        "email_subject": "Welcome to Sentinel Tour",

        "email_body": """
            <p>Your Sentinel Tour account has been successfully created.</p>

            <p>
                You now have access to real-time safety monitoring,
                emergency assistance tools, and proactive risk alerts
                designed to enhance your travel security.
            </p>

            <p>
                We recommend reviewing your profile information and
                emergency contact details to ensure accurate assistance
                during critical situations.
            </p>

            <p>
                Thank you for trusting Sentinel Tour.
                We are committed to your safety.
            </p>
        """,

        "email_text": (
            "Your Sentinel Tour account has been successfully created.\n\n"
            "You now have access to emergency assistance and real-time safety monitoring.\n\n"
            "Please review your profile information for accurate support."
        ),

        "push_title": "Welcome to Sentinel Tour",
        "push_body": "Your account is active and ready.",

        "sms_body": "Sentinel Tour: Your account has been successfully created.",

        "in_app_message": "Welcome! Your account is now active.",
    },

    # =========================================================
    # DELETION REQUESTED
    # =========================================================

    "DELETION_REQUESTED": {
        "email_subject": "Account Deletion Scheduled",

        "email_body": """
            <p>We have received a request to delete your account.</p>

            <p>
                Your account will be permanently deleted after
                <strong>{grace_days} days</strong>.
            </p>

            <p>
                If this request was not initiated by you,
                please cancel it immediately.
            </p>
        """,

        "email_text": (
            "Account deletion has been scheduled.\n\n"
            "It will be permanently deleted after {grace_days} days."
        ),

        "push_title": "Account Deletion Scheduled",
        "push_body": "Your account will be deleted after the grace period.",

        "sms_body": "Sentinel Tour: Account deletion scheduled.",

        "in_app_message": "Your account deletion request is in progress.",
    },

    # =========================================================
    # DELETION CANCELLED
    # =========================================================

    "DELETION_CANCELLED": {
        "email_subject": "Account Deletion Cancelled",

        "email_body": """
            <p>Your account deletion request has been cancelled.</p>

            <p>
                Your account remains active and fully operational.
            </p>
        """,

        "email_text": "Your account deletion request has been cancelled.",

        "push_title": "Deletion Cancelled",
        "push_body": "Your account remains active.",

        "sms_body": "Sentinel Tour: Deletion request cancelled.",

        "in_app_message": "Account deletion has been cancelled.",
    },

    # =========================================================
    # DELETION COMPLETED
    # =========================================================

    "DELETION_COMPLETED": {
        "email_subject": "Account Permanently Deleted",

        "email_body": """
            <p>Your account has been permanently deleted.</p>

            <p>
                All associated personal data has been securely removed
                according to our retention policies.
            </p>
        """,

        "email_text": "Your account has been permanently deleted.",

        "push_title": "Account Deleted",
        "push_body": "Your account has been permanently removed.",

        "sms_body": "Sentinel Tour: Account permanently deleted.",

        "in_app_message": "Your account has been deleted.",
    },

    # =========================================================
    # INCIDENT CREATED (OPEN)
    # =========================================================

    "INCIDENT_CREATED": {

        "email_subject": "Emergency Report Received",

        "email_body": """
            <p>Your emergency report has been successfully received.</p>

            <p>
                Our authorities have been notified and will respond shortly.
            </p>

            <p>
                Please remain calm and stay in a safe location.
            </p>
        """,

        "email_text": (
            "Your emergency report has been received.\n\n"
            "Authorities have been notified and will respond shortly."
        ),

        "push_title": "Emergency Report Sent",
        "push_body": "Help request received. Authorities notified.",

        "sms_body": "Sentinel Tour: Emergency report received.",

        "in_app_message": "Your emergency request has been registered.",

    },


    # =========================================================
    # INCIDENT IN PROGRESS (ACKNOWLEDGED)
    # =========================================================

    "INCIDENT_IN_PROGRESS": {

        "email_subject": "Authorities Responding",

        "email_body": """
            <p>Your reported incident is now being handled by authorities.</p>

            <p>
                Assistance is on the way.
                Please remain calm and stay in a secure location.
            </p>
        """,

        "email_text": (
            "Authorities are actively responding to your incident.\n\n"
            "Please remain calm and stay in a safe location."
        ),

        "push_title": "Help Is On The Way",
        "push_body": "Authorities are handling your report.",

        "sms_body": "Sentinel Tour: Authorities responding.",

        "in_app_message": "Authorities are actively responding to your report.",

    },


    # =========================================================
    # INCIDENT ESCALATED
    # =========================================================

    "INCIDENT_ESCALATED": {

        "email_subject": "Incident Escalated for Priority Handling",

        "email_body": """
            <p>Your incident has been escalated for priority handling.</p>

            <p>
                Additional resources have been assigned to ensure
                a faster and more effective response.
            </p>
        """,

        "email_text": (
            "Your incident has been escalated for priority handling.\n\n"
            "Additional resources are being assigned."
        ),

        "push_title": "Incident Escalated",
        "push_body": "Your case has been escalated for urgent handling.",

        "sms_body": "Sentinel Tour: Incident escalated for priority response.",

        "in_app_message": "Your incident has been escalated for priority handling.",

    },


    # =========================================================
    # INCIDENT RESOLVED
    # =========================================================

    "INCIDENT_RESOLVED": {

        "email_subject": "Incident Successfully Resolved",

        "email_body": """
            <p>The reported incident has been successfully resolved.</p>

            <p>
                Authorities have completed the necessary actions
                and closed the operational response.
            </p>
        """,

        "email_text": (
            "Your reported incident has been resolved.\n\n"
            "Authorities have completed the response."
        ),

        "push_title": "Incident Resolved",
        "push_body": "Your reported incident has been resolved.",

        "sms_body": "Sentinel Tour: Incident resolved.",

        "in_app_message": "Your incident report has been resolved.",

    },


    # =========================================================
    # INCIDENT CLOSED (FINALIZED)
    # =========================================================

    "INCIDENT_CLOSED": {

        "email_subject": "Incident Case Closed",

        "email_body": """
            <p>Your incident case has been officially closed.</p>

            <p>
                The case is now archived in our system.
                You may review details in your dashboard if needed.
            </p>
        """,

        "email_text": (
            "Your incident case has been officially closed.\n\n"
            "The case is now archived."
        ),

        "push_title": "Incident Closed",
        "push_body": "Your incident case has been finalized.",

        "sms_body": "Sentinel Tour: Incident case closed.",

        "in_app_message": "Your incident case has been closed.",

    },


    # =========================================================
    # INCIDENT CANCELLED
    # =========================================================

    "INCIDENT_CANCELLED": {

        "email_subject": "Incident Cancelled",

        "email_body": """
            <p>Your incident report has been cancelled.</p>

            <p>
                If this was cancelled unintentionally and assistance
                is still required, please create a new emergency report.
            </p>
        """,

        "email_text": (
            "Your incident report has been cancelled.\n\n"
            "If assistance is still required, please submit a new report."
        ),

        "push_title": "Incident Cancelled",
        "push_body": "Your incident report has been cancelled.",

        "sms_body": "Sentinel Tour: Incident report cancelled.",

        "in_app_message": "Your incident report has been cancelled.",

    },

    # =========================================================
    # LOW BATTERY
    # =========================================================

    "LOW_BATTERY": {
        "email_subject": "Low Battery Warning",

        "email_body": """
            <p>Your safety device battery level is low.</p>

            <p>
                Current battery level:
                <strong>{battery_percentage}%</strong>
            </p>

            <p>
                Please recharge the device immediately
                to ensure continuous protection.
            </p>
        """,

        "email_text": (
            "Low battery alert.\n\n"
            "Current battery level: {battery_percentage}%.\n"
            "Please recharge your device."
        ),

        "push_title": "Low Battery",
        "push_body": "Your device battery is running low.",

        "sms_body": "Sentinel Tour: Device battery low.",

        "in_app_message": "Device battery level is low.",
    },
}
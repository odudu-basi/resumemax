"""
Structured JSON logging with Sentry integration
"""
import logging
import sys
from typing import Optional
from pythonjsonlogger import jsonlogger
import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration

from config import get_settings

settings = get_settings()


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter with additional fields"""

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)

        # Add standard fields
        log_record['timestamp'] = record.created
        log_record['level'] = record.levelname
        log_record['logger'] = record.name
        log_record['environment'] = settings.environment

        # Add exception info if present
        if record.exc_info:
            log_record['exception'] = self.formatException(record.exc_info)


def setup_logging():
    """Configure logging for the application"""

    # Create handler
    handler = logging.StreamHandler(sys.stdout)

    # Use JSON formatter for production, simple format for development
    if settings.environment == "production":
        formatter = CustomJsonFormatter(
            '%(timestamp)s %(level)s %(name)s %(message)s'
        )
    else:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

    handler.setFormatter(formatter)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(settings.log_level)
    root_logger.addHandler(handler)

    # Setup Sentry if DSN is provided
    if settings.sentry_dsn:
        sentry_logging = LoggingIntegration(
            level=logging.INFO,
            event_level=logging.ERROR
        )

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.sentry_environment or settings.environment,
            traces_sample_rate=settings.sentry_traces_sample_rate,
            integrations=[sentry_logging],
            attach_stacktrace=True,
            send_default_pii=False
        )

        root_logger.info("Sentry initialized successfully")


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance

    Args:
        name: Logger name (usually __name__)

    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


# Initialize logging on module import
setup_logging()

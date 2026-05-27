import logging
import sys

try:
    import structlog
except ModuleNotFoundError:  # pragma: no cover - exercised only in lean local envs
    structlog = None


def configure_logging(service_name: str) -> None:
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=logging.INFO)
    if structlog is None:
        logging.getLogger(service_name).info("logging_configured", extra={"service": service_name})
        return
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
    structlog.contextvars.bind_contextvars(service=service_name)


def get_logger(name: str):
    if structlog is None:
        return logging.getLogger(name)
    return structlog.get_logger(name)

import logging
import os
from logging.config import dictConfig

import coloredlogs

logging_config = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "%(asctime)s %(levelname)s %(module)s %(process)d %(thread)d %(message)s"
        },
        "simple": {"format": "%(asctime)s %(levelname)s %(message)s"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose"
            if os.environ.get("ENV") == "development"
            else "simple",
            "level": "INFO" if os.environ.get("ENV") == "development" else "INFO",
        },
    },
    "loggers": {
        "": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": True,
        },
    },
}

dictConfig(logging_config)
coloredlogs.install()
logger = logging.getLogger(__name__)
logger.info("Logger initialized")

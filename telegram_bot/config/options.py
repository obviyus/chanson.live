import os

from cerberus import Validator

from config.logger import logger

schema = {
    "TELEGRAM": {
        "type": "dict",
        "schema": {
            "ADMINS": {
                "type": "list",
                "required": True,
                "default": [200482621],
            },
            "TOKEN": {
                "type": "string",
                "required": True,
            },
            "LOGGING_CHANNEL_ID": {
                "type": "integer",
                "required": False,
                "nullable": True,
            },
        },
    },
    "API": {
        "type": "dict",
        "schema": {
            "SPOTIFY_CLIENT_ID": {
                "type": "string",
                "required": True,
            },
            "SPOTIFY_CLIENT_SECRET": {
                "type": "string",
                "required": True,
            },
        },
    },
}

config = {
    "TELEGRAM": {
        "ADMINS": os.environ.get("ADMINS", "").split(" "),
        "TOKEN": os.environ.get("TELEGRAM_TOKEN"),
        "LOGGING_CHANNEL_ID": int(os.environ.get("LOGGING_CHANNEL_ID"))
        if os.environ.get("LOGGING_CHANNEL_ID")
        else None,
    },
    "API": {
        "SPOTIFY_CLIENT_ID": os.environ.get("SPOTIFY_CLIENT_ID"),
        "SPOTIFY_CLIENT_SECRET": os.environ.get("SPOTIFY_CLIENT_SECRET"),
    },
}

v = Validator(schema)
v.allow_unknown = True

if v.validate(config):
    logger.info("Valid configuration found.")
    logger.info(config)
else:
    logger.error("Invalid configuration found.")
    logger.error(v.errors)
    exit(1)

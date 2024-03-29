FROM python:3.11-slim as python-base

ENV PYTHONUNBUFFERED=1 \
  PYTHONDONTWRITEBYTECODE=1 \
  PIP_NO_CACHE_DIR=off \
  PIP_DISABLE_PIP_VERSION_CHECK=on \
  PIP_DEFAULT_TIMEOUT=100 \
  POETRY_VIRTUALENVS_IN_PROJECT=true \
  POETRY_NO_INTERACTION=1

FROM python-base as builder-base

RUN pip install poetry

WORKDIR /code
COPY ./controller/poetry.lock ./controller/pyproject.toml ./

RUN poetry install --no-dev

RUN apt-get update \
  && apt-get install --no-install-recommends -y dumb-init ffmpeg \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

COPY ./controller/ .

ENTRYPOINT ["dumb-init", "--", "poetry", "run"]
CMD ["python", "main.py"]

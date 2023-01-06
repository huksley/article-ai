FROM python:3.9-slim-buster
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV DEBIAN_FRONTEND 'noninteractive'
ENV CI true
ENV FLASK_RUN_HOST 0.0.0.0
ENV FLASK_DEBUG 0

RUN apt-get update && \
    apt-get install -y curl && \
    pip install pipenv

RUN mkdir -p /app
COPY Pipfile* /app
WORKDIR /app
RUN pipenv install
COPY download.sh /app
RUN pipenv run download

COPY . /app

EXPOSE 8000
CMD ["pipenv", "run", "app"]

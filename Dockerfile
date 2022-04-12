FROM python:3.8-slim-buster
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV DEBIAN_FRONTEND 'noninteractive'
ENV CI true
ENV FLASK_RUN_HOST 0.0.0.0
ENV FLASK_ENV production 

COPY . /app
WORKDIR /app

RUN apt-get update && apt-get install -y curl && \
    pip install pipenv && \
    pipenv install && \
    pipenv run python -m textblob.download_corpora && \
    pipenv run python -m spacy download en_core_web_sm

EXPOSE 8000
CMD ["pipenv", "run", "app"]

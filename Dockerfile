FROM python:3.11
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV DEBIAN_FRONTEND 'noninteractive'
ENV CI true
ENV FLASK_RUN_HOST 0.0.0.0
ENV FLASK_DEBUG 0

RUN apt-get update && \
    apt-get install -y curl build-essential gcc g++ make automake autoconf libtool gfortran pkg-config libopenblas-dev && \
    pip install pipenv
RUN mkdir -p /app
RUN mkdir -p /var/log/app
COPY Pipfile* /app
WORKDIR /app
RUN pipenv sync
COPY download.sh /app
RUN pipenv run download

COPY static /app/static
COPY templates /app/templates
COPY application.py /app/application.py
COPY download.sh /app/download.sh

EXPOSE 8000
CMD ["pipenv", "run", "app"]

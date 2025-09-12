FROM python:3.13
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
COPY Pipfile* /app
WORKDIR /app
RUN pipenv install
COPY download.sh /app
RUN pipenv run download

COPY . /app

EXPOSE 8000
CMD ["pipenv", "run", "app"]

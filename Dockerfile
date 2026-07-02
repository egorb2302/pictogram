FROM python:3.4

RUN groupadd -r uwsgi && useradd -r -g uwsgi uwsgi

RUN pip install Flask uWSGI requests

WORKDIR /app

COPY app /app

EXPOSE 5000

USER uwsgi

CMD [ "python", "identidock.py" ]
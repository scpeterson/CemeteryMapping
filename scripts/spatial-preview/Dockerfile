# Runtime GEOS must be >=3.14; the worker probes the actual C API at execution.
FROM postgis/postgis:18-3.6
RUN apt-get update && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*
COPY coverage-worker.py /opt/coverage-worker.py
USER nobody
ENTRYPOINT ["python3", "/opt/coverage-worker.py"]

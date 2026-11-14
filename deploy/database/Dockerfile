# Keep SQL-only TIGER restore compatibility: upstream PostGIS 3.7 split it out.
FROM postgis/postgis:18-3.6@sha256:4a43e3c3e5d55b9208240fc71db543b79c638766280c625a425bd0a2390989c4 AS tiger_sql
FROM postgis/postgis:18-3.7@sha256:c5d1ba4292ff7b4471ff41cd515c677633797b72cdd2a7bb691cadaab91f1a1f
# No 3.6 shared libraries or core PostGIS SQL are copied into the 3.7 runtime.
COPY --from=tiger_sql /usr/share/postgresql/18/extension/postgis_tiger_geocoder* /usr/share/postgresql/18/extension/

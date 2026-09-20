#!/bin/bash
# Creates one database per service (POSTGRES_MULTIPLE_DATABASES isn't native to the postgres image).
set -e
for db in auth_db product_db order_db payment_db inventory_db; do
  psql -U "$POSTGRES_USER" -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 || \
    psql -U "$POSTGRES_USER" -c "CREATE DATABASE $db"
  echo "database ready: $db"
done

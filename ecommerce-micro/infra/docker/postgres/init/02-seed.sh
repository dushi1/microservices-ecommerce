#!/bin/bash
# Runs schema + seed SQL against the right databases after 01-create-databases.sh.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
psql -U "$POSTGRES_USER" -d product_db   -f "$DIR/product-schema.sql"
psql -U "$POSTGRES_USER" -d product_db   -f "$DIR/product-seed.sql"
psql -U "$POSTGRES_USER" -d inventory_db -f "$DIR/inventory-schema.sql"
psql -U "$POSTGRES_USER" -d inventory_db -f "$DIR/inventory-seed.sql"
echo "schemas + seed data loaded"

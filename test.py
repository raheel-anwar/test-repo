#!/usr/bin/env python3
"""
Enterprise-grade migration runner for FastAPI apps.
Designed to be executed BEFORE starting Gunicorn.
Ensures only one container runs migrations using a DB lock.
"""

import os
import sys
import time
import logging
import psycopg2
from psycopg2 import sql, errors
import subprocess

# ──────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────

DB_URL = os.getenv("DATABASE_URL")  # e.g. postgres://user:pass@host:5432/dbname
LOCK_TABLE = "migrations_lock"
LOCK_ID = 1
LOCK_TIMEOUT = int(os.getenv("MIGRATION_LOCK_TIMEOUT", "300"))  # seconds
LOCK_POLL_INTERVAL = int(os.getenv("MIGRATION_LOCK_POLL_INTERVAL", "2"))  # seconds
MIGRATION_COMMAND = os.getenv("MIGRATION_COMMAND", "alembic upgrade head")  # or custom script

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

# ──────────────────────────────────────────────
# HELPER FUNCTIONS
# ──────────────────────────────────────────────

def get_db_connection():
    """Establish a DB connection."""
    try:
        conn = psycopg2.connect(DB_URL)
        conn.autocommit = True
        return conn
    except Exception as e:
        logging.error(f"Unable to connect to DB: {e}")
        sys.exit(1)


def ensure_lock_table_exists(conn):
    """Create the lock table if it doesn't exist."""
    with conn.cursor() as cur:
        cur.execute(sql.SQL("""
            CREATE TABLE IF NOT EXISTS {} (
                lock_id INT PRIMARY KEY,
                locked_at TIMESTAMPTZ DEFAULT NOW()
            )
        """).format(sql.Identifier(LOCK_TABLE)))


def acquire_lock(conn, timeout=LOCK_TIMEOUT):
    """Try to acquire the migration lock."""
    logging.info("Attempting to acquire migration lock...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    sql.SQL("INSERT INTO {} (lock_id) VALUES (%s)").format(sql.Identifier(LOCK_TABLE)),
                    [LOCK_ID]
                )
            logging.info("Migration lock acquired.")
            return True
        except errors.UniqueViolation:
            # Lock already exists
            time.sleep(LOCK_POLL_INTERVAL)
        except Exception as e:
            logging.error(f"Error acquiring lock: {e}")
            time.sleep(LOCK_POLL_INTERVAL)
    logging.error("Timeout waiting for migration lock.")
    return False


def release_lock(conn):
    """Release the migration lock."""
    try:
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL("DELETE FROM {} WHERE lock_id = %s").format(sql.Identifier(LOCK_TABLE)),
                [LOCK_ID]
            )
        logging.info("Migration lock released.")
    except Exception as e:
        logging.error(f"Error releasing lock: {e}")


def run_migrations():
    """Run the actual migrations command."""
    logging.info(f"Running migrations: {MIGRATION_COMMAND}")
    try:
        result = subprocess.run(MIGRATION_COMMAND, shell=True, check=True)
        logging.info("Migrations completed successfully.")
        return True
    except subprocess.CalledProcessError as e:
        logging.error(f"Migrations failed with exit code {e.returncode}")
        return False


# ──────────────────────────────────────────────
# MAIN SCRIPT
# ──────────────────────────────────────────────

def main():
    conn = get_db_connection()
    ensure_lock_table_exists(conn)

    if acquire_lock(conn):
        try:
            success = run_migrations()
            if not success:
                sys.exit(1)
        finally:
            release_lock(conn)
    else:
        logging.info("Another instance is running migrations. Waiting for it to complete...")
        # Wait for lock to be released
        start_wait = time.time()
        while True:
            with conn.cursor() as cur:
                cur.execute(
                    sql.SQL("SELECT COUNT(*) FROM {} WHERE lock_id = %s").format(sql.Identifier(LOCK_TABLE)),
                    [LOCK_ID]
                )
                count = cur.fetchone()[0]
            if count == 0:
                logging.info("Previous migration completed. Proceeding.")
                break
            if time.time() - start_wait > LOCK_TIMEOUT:
                logging.error("Timeout waiting for migrations to complete.")
                sys.exit(1)
            time.sleep(LOCK_POLL_INTERVAL)


if __name__ == "__main__":
    main()


import logging
import sys
import time
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.db import engine

LOG = logging.getLogger("db.migrate")

LOCK_ID = 999999
LOCK_TIMEOUT = 180
POLL_INTERVAL = 5


class MigrationFailed(SystemExit):
    pass


def acquire_lock(conn):
    start = time.time()
    LOG.info("Waiting to acquire DB migration lock...")

    while True:
        locked = conn.execute(
            text("SELECT pg_try_advisory_lock(:id)"),
            {"id": LOCK_ID}
        ).scalar()

        if locked:
            LOG.info("✅ Migration lock acquired")
            return

        if time.time() - start > LOCK_TIMEOUT:
            raise MigrationFailed("⏱ Timeout waiting for migration lock")

        time.sleep(POLL_INTERVAL)


def release_lock(conn):
    conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": LOCK_ID})
    LOG.info("✅ Migration lock released")


def run():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    )

    LOG.info("🚀 Starting migrations")

    try:
        with engine.begin() as conn:
            acquire_lock(conn)

            try:
                alembic_cfg = Config("alembic.ini")
                alembic_cfg.attributes["connection"] = conn

                LOG.info("Applying Alembic migrations...")
                command.upgrade(alembic_cfg, "head")
                LOG.info("✅ Migrations complete")

            finally:
                release_lock(conn)

    except SQLAlchemyError:
        LOG.exception("❌ Database error during migration")
        raise MigrationFailed(1)

    except Exception:
        LOG.exception("🔥 Migration failure")
        raise


if __name__ == "__main__":
    try:
        run()
    except Exception:
        sys.exit(1)


connection = config.attributes.get("connection")

if connection is not None:
    context.configure(connection=connection, target_metadata=target_metadata)
else:
    context.configure(...)


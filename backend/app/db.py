"""Database access — SQLite (local) or PostgreSQL (Docker)."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Any, Iterator

from app.config import DATABASE_URL, DATA_DIR, uses_postgres

_SQLITE_PATH = DATA_DIR / "deepcellar.db"


def _pg_sql(sql: str) -> str:
    """Convert sqlite-style `?` placeholders to psycopg `%s`."""
    return sql.replace("?", "%s")


class _Cursor:
    def __init__(self, cursor: Any, *, postgres: bool):
        self._cursor = cursor
        self._postgres = postgres

    def execute(self, sql: str, params: tuple | list | None = None):
        if self._postgres:
            self._cursor.execute(_pg_sql(sql), params or ())
        else:
            self._cursor.execute(sql, params or ())
        return self

    def fetchone(self):
        row = self._cursor.fetchone()
        if row is None:
            return None
        if self._postgres:
            return dict(row)
        return row

    def fetchall(self):
        rows = self._cursor.fetchall()
        if self._postgres:
            return [dict(r) for r in rows]
        return rows


class _Connection:
    def __init__(self, conn: Any, *, postgres: bool):
        self._conn = conn
        self._postgres = postgres

    def execute(self, sql: str, params: tuple | list | None = None) -> _Cursor:
        cur = self._conn.cursor()
        wrapper = _Cursor(cur, postgres=self._postgres)
        wrapper.execute(sql, params)
        return wrapper

    def commit(self) -> None:
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> _Connection:
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if exc_type is None:
            self.commit()
        self.close()


@contextmanager
def get_connection() -> Iterator[_Connection]:
    if uses_postgres():
        import psycopg
        from psycopg.rows import dict_row

        raw = psycopg.connect(DATABASE_URL, row_factory=dict_row)
        conn = _Connection(raw, postgres=True)
    else:
        path = _sqlite_path_from_url()
        raw = sqlite3.connect(path)
        raw.row_factory = sqlite3.Row
        conn = _Connection(raw, postgres=False)
    try:
        yield conn
        conn.commit()
    except Exception:
        if uses_postgres():
            conn._conn.rollback()
        raise
    finally:
        conn.close()


def _sqlite_path_from_url() -> str:
    if DATABASE_URL.startswith("sqlite:///"):
        return DATABASE_URL.removeprefix("sqlite:///")
    return str(_SQLITE_PATH)


def init_db() -> None:
    with get_connection() as conn:
        if uses_postgres():
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        else:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
                """
            )

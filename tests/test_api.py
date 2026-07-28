import json

import pytest
from fastapi.testclient import TestClient

from app import db, main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """TestClient backed by a throwaway SQLite database."""
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    db.init_db()
    return TestClient(main.app)


def signup(client, username="adel", password="password123"):
    return client.post(
        "/api/signup",
        json={
            "username": username,
            "first_name": "Adel",
            "last_name": "Aloui",
            "password": password,
        },
    )


def login(client, username="adel", password="password123"):
    return client.post("/api/login", json={"username": username, "password": password})


def test_signup_login_me_logout(client):
    assert signup(client).status_code == 201
    assert signup(client).status_code == 409  # duplicate username
    assert login(client, password="wrong-password").status_code == 401

    assert login(client).status_code == 200
    me = client.get("/api/me")
    assert me.status_code == 200
    assert me.json()["username"] == "adel"

    assert client.post("/api/logout").status_code == 200
    assert client.get("/api/me").status_code == 401


def test_chats_crud(client):
    signup(client)
    login(client)

    created = client.post("/api/chats", json={"model": "qwen3:8b"})
    assert created.status_code == 201
    chat = created.json()
    assert chat["title"] == ""

    chats = client.get("/api/chats").json()["chats"]
    assert [c["id"] for c in chats] == [chat["id"]]

    detail = client.get(f"/api/chats/{chat['id']}").json()
    assert detail["model"] == "qwen3:8b"
    assert detail["messages"] == []

    renamed = client.patch(f"/api/chats/{chat['id']}", json={"title": "Renamed"})
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Renamed"

    assert client.delete(f"/api/chats/{chat['id']}").status_code == 200
    assert client.get(f"/api/chats/{chat['id']}").status_code == 404
    assert client.get("/api/chats").json()["chats"] == []


def test_chats_require_auth(client):
    assert client.get("/api/chats").status_code == 401
    assert client.post("/api/chats", json={"model": "m"}).status_code == 401
    assert client.get("/api/chats/1").status_code == 401
    assert client.patch("/api/chats/1", json={"title": "x"}).status_code == 401
    assert client.delete("/api/chats/1").status_code == 401


def test_cross_user_access_returns_404(client):
    other = TestClient(main.app)
    signup(client, "alice")
    login(client, "alice")
    signup(other, "bob")
    login(other, "bob")

    chat_id = client.post("/api/chats", json={"model": "m"}).json()["id"]

    assert other.get(f"/api/chats/{chat_id}").status_code == 404
    assert other.patch(f"/api/chats/{chat_id}", json={"title": "x"}).status_code == 404
    assert other.delete(f"/api/chats/{chat_id}").status_code == 404
    assert (
        other.post(
            "/api/chat",
            json={
                "model": "m",
                "messages": [{"role": "user", "content": "hi"}],
                "chat_id": chat_id,
            },
        ).status_code
        == 404
    )
    assert other.get("/api/chats").json()["chats"] == []


async def fake_stream(model, messages, think):
    yield (
        json.dumps(
            {"message": {"role": "assistant", "content": "Hello "}, "done": False}
        )
        + "\n"
    )
    yield (
        json.dumps(
            {"message": {"role": "assistant", "content": "world"}, "done": False}
        )
        + "\n"
    )
    yield json.dumps({"done": True}) + "\n"


async def failing_stream(model, messages, think):
    yield json.dumps({"done": True, "error": "Ollama is not reachable."}) + "\n"


def persisted_chat(client, monkeypatch):
    monkeypatch.setattr(main, "stream_chat", fake_stream)
    signup(client)
    login(client)
    return client.post("/api/chats", json={"model": "m"}).json()["id"]


def send_turn(client, chat_id, text="hi there"):
    return client.post(
        "/api/chat",
        json={
            "model": "m",
            "messages": [{"role": "user", "content": text}],
            "chat_id": chat_id,
        },
    )


def test_chat_turn_persists_and_autotitles(client, monkeypatch):
    chat_id = persisted_chat(client, monkeypatch)

    res = send_turn(client, chat_id)
    assert res.status_code == 200
    assert '"done":true' in res.text.replace(" ", "")
    assert "x-chat-id" not in res.headers  # only set on auto-create

    detail = client.get(f"/api/chats/{chat_id}").json()
    assert detail["title"] == "hi there"
    assert [(m["role"], m["content"]) for m in detail["messages"]] == [
        ("user", "hi there"),
        ("assistant", "Hello world"),
    ]

    # a second turn appends and keeps the original title
    send_turn(client, chat_id, "another question")
    detail = client.get(f"/api/chats/{chat_id}").json()
    assert detail["title"] == "hi there"
    assert len(detail["messages"]) == 4

    # deleting the chat cascades its messages
    assert client.delete(f"/api/chats/{chat_id}").status_code == 200
    with db.get_connection() as conn:
        orphans = conn.execute(
            "SELECT COUNT(*) AS n FROM messages WHERE chat_id = ?", (chat_id,)
        ).fetchone()["n"]
    assert orphans == 0


def test_failed_turn_is_not_persisted(client, monkeypatch):
    chat_id = persisted_chat(client, monkeypatch)
    monkeypatch.setattr(main, "stream_chat", failing_stream)

    res = send_turn(client, chat_id)
    assert res.status_code == 200  # error travels inside the stream
    detail = client.get(f"/api/chats/{chat_id}").json()
    assert detail["messages"] == []
    assert detail["title"] == ""


def test_chat_without_chat_id_autocreates(client, monkeypatch):
    monkeypatch.setattr(main, "stream_chat", fake_stream)
    signup(client)
    login(client)

    res = client.post(
        "/api/chat",
        json={
            "model": "m",
            "messages": [{"role": "user", "content": "auto me"}],
        },
    )
    assert res.status_code == 200
    chat_id = int(res.headers["x-chat-id"])

    detail = client.get(f"/api/chats/{chat_id}").json()
    assert detail["model"] == "m"
    assert detail["title"] == "auto me"
    assert [(m["role"], m["content"]) for m in detail["messages"]] == [
        ("user", "auto me"),
        ("assistant", "Hello world"),
    ]

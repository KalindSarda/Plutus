"""Auth smoke tests — register, login, protected endpoint."""


def test_register_and_login_returns_access_token(client):
    """Registering then logging in should yield a valid access_token."""
    reg_resp = client.post(
        "/api/auth/register",
        json={
            "name": "Alice",
            "email": "alice@example.com",
            "password": "secure123",
            "invite_code": "plutus2024",
        },
    )
    assert reg_resp.status_code == 201, reg_resp.json()

    login_resp = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "secure123"},
    )
    assert login_resp.status_code == 200, login_resp.json()
    data = login_resp.json()
    assert "access_token" in data
    assert len(data["access_token"]) > 10


def test_protected_endpoint_returns_401_without_token(client):
    """Accessing /api/auth/me without a token must return 401."""
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401

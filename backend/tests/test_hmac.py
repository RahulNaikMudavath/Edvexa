import json
from backend.app.security.hmac_validator import compute_hmac_sha256, verify_hmac_signature

def test_compute_hmac():
    secret = "my_secret_token"
    payload = b'{"event":"test"}'
    signature = compute_hmac_sha256(secret, payload)
    assert isinstance(signature, str)
    assert len(signature) == 64 # SHA-256 hex string

def test_verify_hmac_valid():
    secret = "super_secret_key"
    payload = b'{"amount":100}'
    sig = compute_hmac_sha256(secret, payload)
    
    # Standard format
    is_valid, msg = verify_hmac_signature(payload, secret, sig)
    assert is_valid is True
    assert "Valid HMAC" in msg

    # GitHub format with sha256= prefix
    is_valid, _ = verify_hmac_signature(payload, secret, f"sha256={sig}")
    assert is_valid is True

def test_verify_hmac_invalid():
    secret = "super_secret_key"
    payload = b'{"amount":100}'
    tampered_sig = "a" * 64

    is_valid, msg = verify_hmac_signature(payload, secret, tampered_sig)
    assert is_valid is False
    assert "mismatch" in msg.lower()

def test_webhook_endpoint_hmac_success(client, sample_integration):
    payload = {"type": "payment.succeeded", "amount": 100, "id": "evt_test_1"}
    raw_body = json.dumps(payload).encode("utf-8")
    signature = compute_hmac_sha256(sample_integration.secret_key, raw_body)

    response = client.post(
        f"/api/v1/webhooks/{sample_integration.slug}",
        data=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Signature": f"sha256={signature}",
            "X-Idempotency-Key": "idemp_test_hmac_1"
        }
    )
    assert response.status_code == 202
    res_data = response.get_json()
    assert res_data["status"] == "accepted"
    assert "event_id" in res_data

def test_webhook_endpoint_hmac_failure(client, sample_integration):
    payload = {"type": "payment.succeeded", "amount": 100}
    raw_body = json.dumps(payload).encode("utf-8")

    response = client.post(
        f"/api/v1/webhooks/{sample_integration.slug}",
        data=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Signature": "sha256=wrong_signature_12345"
        }
    )
    assert response.status_code == 401
    res_data = response.get_json()
    assert "Invalid HMAC signature" in res_data["error"]

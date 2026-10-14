import json
from backend.app.security.hmac_validator import compute_hmac_sha256

def test_idempotency_duplicate_event_handling(client, sample_integration):
    slug = sample_integration.slug
    secret = sample_integration.secret_key

    payload = {"type": "payment.succeeded", "amount": 250, "id": "evt_idemp_check"}
    raw_body = json.dumps(payload).encode("utf-8")
    sig = compute_hmac_sha256(secret, raw_body)
    idempotency_key = "idemp_unique_key_999"

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": f"sha256={sig}",
        "X-Idempotency-Key": idempotency_key
    }

    # First request -> Accepted (202)
    resp1 = client.post(f"/api/v1/webhooks/{slug}", data=raw_body, headers=headers)
    assert resp1.status_code == 202
    data1 = resp1.get_json()
    assert data1["status"] == "accepted"
    first_event_id = data1["event_id"]

    # Second duplicate request with exact same idempotency key -> 200 Duplicate Ignored
    resp2 = client.post(f"/api/v1/webhooks/{slug}", data=raw_body, headers=headers)
    assert resp2.status_code == 200
    data2 = resp2.get_json()
    assert data2["status"] == "duplicate_ignored"
    assert data2["event_id"] == first_event_id
    assert "already processed" in data2["message"]

def test_different_idempotency_keys_are_both_processed(client, sample_integration):
    slug = sample_integration.slug
    secret = sample_integration.secret_key

    payload1 = {"type": "payment.succeeded", "amount": 100, "id": "evt_order_1"}
    raw_body1 = json.dumps(payload1).encode("utf-8")
    sig1 = compute_hmac_sha256(secret, raw_body1)

    resp1 = client.post(
        f"/api/v1/webhooks/{slug}",
        data=raw_body1,
        headers={"Content-Type": "application/json", "X-Webhook-Signature": f"sha256={sig1}", "X-Idempotency-Key": "key_alpha"}
    )
    assert resp1.status_code == 202

    payload2 = {"type": "payment.succeeded", "amount": 150, "id": "evt_order_2"}
    raw_body2 = json.dumps(payload2).encode("utf-8")
    sig2 = compute_hmac_sha256(secret, raw_body2)

    resp2 = client.post(
        f"/api/v1/webhooks/{slug}",
        data=raw_body2,
        headers={"Content-Type": "application/json", "X-Webhook-Signature": f"sha256={sig2}", "X-Idempotency-Key": "key_beta"}
    )
    assert resp2.status_code == 202
    assert resp1.get_json()["event_id"] != resp2.get_json()["event_id"]

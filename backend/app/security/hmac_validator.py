import hmac
import hashlib
from typing import Tuple

def compute_hmac_sha256(secret: str, data: bytes) -> str:
    """Computes SHA-256 HMAC for given data using the secret key."""
    if isinstance(secret, str):
        secret = secret.encode("utf-8")
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hmac.new(secret, data, hashlib.sha256).hexdigest()

def verify_hmac_signature(
    raw_body: bytes,
    secret_key: str,
    signature_header: str
) -> Tuple[bool, str]:
    """
    Validates incoming webhook request signature against secret key using constant-time comparison.
    Supports formats:
      - 'sha256=abcdef...' (GitHub)
      - 't=12345,v1=abcdef...' (Stripe)
      - 'abcdef...' (Standard hex)
    
    Returns (is_valid: bool, reason: str)
    """
    if not secret_key:
        return True, "No secret key configured for integration; verification skipped"

    if not signature_header:
        return False, "Missing signature header in request"

    # Extract actual signature
    provided_signature = signature_header.strip()

    # GitHub format: sha256=<hex>
    if provided_signature.startswith("sha256="):
        provided_signature = provided_signature[7:]

    # Stripe format: t=<timestamp>,v1=<hex>
    elif "v1=" in provided_signature:
        parts = dict(item.split("=", 1) for item in provided_signature.split(",") if "=" in item)
        if "v1" in parts:
            provided_signature = parts["v1"]
            # If timestamp is provided, Stripe also hashes f"{timestamp}.{raw_body.decode('utf-8')}"
            if "t" in parts:
                timestamp = parts["t"]
                stripe_data = f"{timestamp}.".encode("utf-8") + raw_body
                expected_stripe = compute_hmac_sha256(secret_key, stripe_data)
                if hmac.compare_digest(expected_stripe, provided_signature):
                    return True, "Valid Stripe HMAC signature"

    # Compute expected signature directly from raw body
    expected_signature = compute_hmac_sha256(secret_key, raw_body)

    # Constant time comparison to prevent timing attacks
    if hmac.compare_digest(expected_signature, provided_signature):
        return True, "Valid HMAC signature"

    return False, f"Signature mismatch: computed {expected_signature[:8]}... vs provided {provided_signature[:8]}..."

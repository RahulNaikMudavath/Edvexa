import re
from datetime import datetime, timezone
from typing import Dict, Any, List

def analyze_failure_fallback(
    error_message: str,
    error_details: Dict[str, Any],
    step_logs: List[Dict[str, Any]],
    workflow_info: Dict[str, Any],
    input_payload: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Intelligent rule-based failure diagnostics engine.
    Used when external LLM services are unavailable or not configured.
    Produces high-fidelity, actionable root cause analysis with log evidence.
    """
    error_str = (error_message or "").lower()
    status_code = error_details.get("status_code") if error_details else None
    failed_step = None

    # Find the step that failed in the logs
    for step in step_logs or []:
        if step.get("status") == "failed":
            failed_step = step
            break

    step_name = failed_step.get("step_name", "Unknown Step") if failed_step else "Workflow Step"
    step_type = failed_step.get("step_type", "action") if failed_step else "action"
    target_url = error_details.get("url", "") if error_details else ""

    now_iso = datetime.now(timezone.utc).isoformat()

    # Rule 1: HTTP 401 / 403 Unauthorized
    if status_code in (401, 403) or "unauthorized" in error_str or "forbidden" in error_str:
        return {
            "summary": f"Authentication Failure in {step_name}",
            "root_cause": f"The target endpoint ({target_url or 'external service'}) rejected the request with HTTP {status_code or 401}. The Authorization header or API token is missing, expired, or possesses insufficient permissions.",
            "evidence": f"Failed step: '{step_name}' ({step_type}). Error response: {error_message}",
            "suggested_action": "Verify the 'Authorization' header in this action's configuration. Ensure your Bearer token or API key is valid and has not expired.",
            "suggested_config_diff": {
                "headers": {"Authorization": "Bearer <YOUR_ACTIVE_TOKEN>"}
            },
            "confidence_score": 0.95,
            "provider": "rule_based_fallback",
            "generated_at": now_iso
        }

    # Rule 2: HTTP 404 Not Found
    if status_code == 404 or "not found" in error_str:
        return {
            "summary": f"Endpoint or Resource Not Found in {step_name}",
            "root_cause": f"The requested resource at URL '{target_url}' returned HTTP 404. Either the endpoint URL contains a typo, or a dynamic parameter (like an ID) refers to a non-existent entity.",
            "evidence": f"Failed step: '{step_name}'. Target URL: {target_url}. Error: {error_message}",
            "suggested_action": "Inspect the URL template. Check whether referenced variables in {{path}} correctly resolve to existing identifiers.",
            "suggested_config_diff": {
                "url": target_url or "https://api.example.com/v1/valid-endpoint"
            },
            "confidence_score": 0.92,
            "provider": "rule_based_fallback",
            "generated_at": now_iso
        }

    # Rule 3: HTTP 422 / 400 Bad Request / Validation Failure
    if status_code in (400, 422) or "bad request" in error_str or "validation" in error_str:
        return {
            "summary": f"Payload Validation Rejected by External API in {step_name}",
            "root_cause": f"The remote API rejected the request payload with HTTP {status_code}. The payload structure does not conform to the schema required by the recipient service.",
            "evidence": f"Remote response: {error_details.get('response_body') or error_message}",
            "suggested_action": "Review the API request body schema. Ensure required fields (e.g. email, amount, currency) are populated and formatted correctly.",
            "suggested_config_diff": {
                "body_format": "Check required JSON keys against API documentation"
            },
            "confidence_score": 0.90,
            "provider": "rule_based_fallback",
            "generated_at": now_iso
        }

    # Rule 4: HTTP 429 Rate Limit
    if status_code == 429 or "rate limit" in error_str or "too many requests" in error_str:
        return {
            "summary": f"Rate Limit Throttling in {step_name}",
            "root_cause": f"The external API throttled requests due to exceeding rate limits (HTTP 429).",
            "evidence": f"Target: {target_url}. Error: {error_message}",
            "suggested_action": "Enable exponential backoff with higher initial delays or increase retry intervals in workflow configuration.",
            "suggested_config_diff": {
                "retry_config": {"initial_delay": 5.0, "backoff_factor": 2.5}
            },
            "confidence_score": 0.96,
            "provider": "rule_based_fallback",
            "generated_at": now_iso
        }

    # Rule 5: HTTP 500 / 502 / 503 / 504 Upstream Server Error
    if status_code and status_code >= 500 or "server error" in error_str or "bad gateway" in error_str:
        return {
            "summary": f"Remote Server Outage or Internal Error in {step_name}",
            "root_cause": f"The target service at '{target_url}' returned HTTP {status_code}. This indicates a temporary outage, crash, or gateway issue on the external system.",
            "evidence": f"Remote response status: {status_code}. Message: {error_message}",
            "suggested_action": "This is typically transient. Allow the automatic exponential backoff retry mechanism to retry the execution.",
            "suggested_config_diff": {
                "retry_strategy": "Automatic backoff retry enabled"
            },
            "confidence_score": 0.88,
            "provider": "rule_based_fallback",
            "generated_at": now_iso
        }

    # Rule 6: Connection Timeout / DNS failure
    if "timeout" in error_str or "timed out" in error_str or "connection" in error_str:
        return {
            "summary": f"Connection Timeout or Network Failure in {step_name}",
            "root_cause": f"Failed to connect to '{target_url}' within the configured timeout window. The external server may be down, unreachable, or network latency is high.",
            "evidence": f"Network exception: {error_message}",
            "suggested_action": "Increase the HTTP timeout setting in the action config (e.g. from 5s to 15s) and verify external service connectivity.",
            "suggested_config_diff": {
                "timeout": 15
            },
            "confidence_score": 0.91,
            "provider": "rule_based_fallback",
            "generated_at": now_iso
        }

    # Rule 7: Data Transformation / Key Missing
    if "keyerror" in error_str or "not found in context" in error_str or "cannot compare" in error_str:
        return {
            "summary": f"Data Transformation / Extraction Error in {step_name}",
            "root_cause": "The workflow tried to access a missing or malformed property from the incoming webhook payload during transformation or template interpolation.",
            "evidence": f"Error: {error_message}. Input payload keys: {list(input_payload.keys()) if isinstance(input_payload, dict) else 'none'}",
            "suggested_action": "Check the incoming event payload schema. Ensure the path mapped in this step matches the actual keys delivered by the integration.",
            "suggested_config_diff": {
                "data_path": "Verify dot-path mappings against raw payload"
            },
            "confidence_score": 0.89,
            "provider": "rule_based_fallback",
            "generated_at": now_iso
        }

    # Generic Fallback
    return {
        "summary": f"Execution Failure in {step_name}",
        "root_cause": f"An unhandled execution failure occurred: {error_message}",
        "evidence": f"Failed step: {step_name}. Details: {error_details or 'No structured details'}",
        "suggested_action": "Review the execution logs, check parameter mappings, and verify external service availability before retrying.",
        "suggested_config_diff": {},
        "confidence_score": 0.75,
        "provider": "rule_based_fallback",
        "generated_at": now_iso
    }

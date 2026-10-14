from backend.app.ai.analyzer import AiFailureAnalyzer
from backend.app.ai.fallback import analyze_failure_fallback

def test_ai_fallback_unauthorized():
    result = analyze_failure_fallback(
        error_message="HTTP 401: Invalid Bearer token",
        error_details={"status_code": 401, "url": "https://api.crm.com/v1/lead"},
        step_logs=[{"step_name": "Call CRM API", "step_type": "api_call", "status": "failed"}],
        workflow_info={"name": "Sync Lead"},
        input_payload={"email": "lead@example.com"}
    )
    assert "Authentication Failure" in result["summary"]
    assert "Authorization" in result["suggested_action"]
    assert "Bearer" in result["suggested_action"]
    assert result["provider"] == "rule_based_fallback"
    assert "evidence" in result
    assert "root_cause" in result

def test_ai_fallback_not_found():
    result = analyze_failure_fallback(
        error_message="HTTP 404: Not Found",
        error_details={"status_code": 404, "url": "https://api.example.com/orders/99999"},
        step_logs=[{"step_name": "Fetch Order", "step_type": "api_call", "status": "failed"}],
        workflow_info={"name": "Fetch Details"},
        input_payload={"order_id": 99999}
    )
    assert "Not Found" in result["summary"]
    assert "https://api.example.com/orders/99999" in result["root_cause"]

def test_ai_fallback_rate_limit():
    result = analyze_failure_fallback(
        error_message="HTTP 429: Too many requests",
        error_details={"status_code": 429, "url": "https://api.github.com/repos"},
        step_logs=[{"step_name": "Call GitHub", "step_type": "api_call", "status": "failed"}],
        workflow_info={"name": "GitHub Sync"},
        input_payload={}
    )
    assert "Rate Limit" in result["summary"]
    assert "retry_config" in result["suggested_config_diff"]

def test_analyzer_class_with_mock_mode():
    analyzer = AiFailureAnalyzer()
    analyzer.provider = "mock"
    result = analyzer.analyze(
        error_message="HTTP 500: Internal Server Error",
        error_details={"status_code": 500, "url": "https://api.service.com"},
        step_logs=[],
        workflow_info={},
        input_payload={}
    )
    assert result is not None
    assert "summary" in result
    assert "root_cause" in result
    assert "evidence" in result
    assert "suggested_action" in result

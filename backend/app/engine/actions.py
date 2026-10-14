import re
import json
import requests
from typing import Any, Dict, Tuple
from backend.app.engine.evaluator import get_nested_value

def interpolate_template(template_str: str, context: dict) -> str:
    """Replaces {{path.to.key}} placeholders with values from context."""
    if not isinstance(template_str, str):
        return template_str

    pattern = re.compile(r"\{\{\s*([\w\.\-]+)\s*\}\}")

    def replacer(match):
        key = match.group(1)
        val = get_nested_value(context, key)
        if val is None:
            return ""
        return str(val)

    return pattern.sub(replacer, template_str)

def interpolate_dict(obj: Any, context: dict) -> Any:
    """Recursively interpolates templates inside dicts, lists, and strings."""
    if isinstance(obj, str):
        # If it's an exact placeholder {{key}}, preserve original type (int, float, dict)
        match = re.fullmatch(r"\{\{\s*([\w\.\-]+)\s*\}\}", obj.strip())
        if match:
            key = match.group(1)
            val = get_nested_value(context, key)
            return val if val is not None else obj
        return interpolate_template(obj, context)
    elif isinstance(obj, dict):
        return {k: interpolate_dict(v, context) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [interpolate_dict(item, context) for item in obj]
    return obj


class ActionExecutionError(Exception):
    def __init__(self, message: str, step_id: str, action_type: str, details: dict = None):
        super().__init__(message)
        self.message = message
        self.step_id = step_id
        self.action_type = action_type
        self.details = details or {}


class ActionExecutor:
    """Executes single workflow action steps."""

    @staticmethod
    def execute_transform(config: dict, context: dict) -> Dict[str, Any]:
        """
        Transforms data based on field mappings and templates.
        Config schema:
          {
            "mappings": {"order_id": "data.id", "amount": "data.amount"},
            "template_output": {"summary": "Payment of {{data.amount}} by {{data.customer}}"},
            "math_operations": [{"field": "amount_dollars", "source": "data.amount", "operation": "divide", "operand": 100}]
          }
        """
        output = dict(context)
        mappings = config.get("mappings", {})
        for target_key, source_path in mappings.items():
            val = get_nested_value(context, source_path)
            output[target_key] = val

        # Math operations
        math_ops = config.get("math_operations", [])
        for op in math_ops:
            field = op.get("field")
            source = op.get("source")
            operation = op.get("operation")
            operand = op.get("operand", 1)
            val = get_nested_value(output, source)
            try:
                num = float(val)
                if operation == "divide" and operand != 0:
                    output[field] = num / operand
                elif operation == "multiply":
                    output[field] = num * operand
                elif operation == "add":
                    output[field] = num + operand
                elif operation == "subtract":
                    output[field] = num - operand
            except (ValueError, TypeError):
                output[field] = val

        # Template outputs evaluated against updated output state
        templates = config.get("template_output", {})
        for key, tmpl in templates.items():
            output[key] = interpolate_dict(tmpl, output)

        return output

    @staticmethod
    def execute_api_call(config: dict, context: dict, step_id: str = "api_step") -> Dict[str, Any]:
        """
        Performs an external HTTP API request.
        Config schema:
          {
            "url": "https://httpbin.org/post",
            "method": "POST",
            "headers": {"Authorization": "Bearer ..."},
            "body": {"event_id": "{{id}}"},
            "timeout": 10,
            "simulate_failure": false # For testing failure analysis
          }
        """
        raw_url = config.get("url", "")
        if not raw_url:
            raise ActionExecutionError("API Action error: URL is missing or empty", step_id, "api_call")

        url = interpolate_template(raw_url, context)
        method = config.get("method", "POST").upper()
        headers = interpolate_dict(config.get("headers", {}), context)
        body = interpolate_dict(config.get("body", {}), context)
        timeout = float(config.get("timeout", 10))

        # Check for simulated failure mode (useful for testing failure analysis & retries)
        if config.get("simulate_failure"):
            status_code = config.get("simulated_status", 500)
            err_msg = config.get("simulated_error", "Simulated external service failure (Internal Server Error)")
            raise ActionExecutionError(
                f"HTTP {status_code}: {err_msg}",
                step_id,
                "api_call",
                {"status_code": status_code, "url": url, "method": method, "response_body": err_msg}
            )

        # Check for simulated mock URL (mock://)
        if url.startswith("mock://"):
            return {
                "status_code": 200,
                "mock": True,
                "url": url,
                "received_payload": body,
                "message": "Mock API destination received request successfully"
            }

        try:
            req_kwargs = {"headers": headers, "timeout": timeout}
            if method in ("POST", "PUT", "PATCH"):
                if isinstance(body, dict):
                    req_kwargs["json"] = body
                else:
                    req_kwargs["data"] = str(body)

            resp = requests.request(method, url, **req_kwargs)

            # Parse response
            try:
                resp_data = resp.json()
            except Exception:
                resp_data = resp.text

            if not (200 <= resp.status_code < 300):
                raise ActionExecutionError(
                    f"External API returned HTTP {resp.status_code}: {str(resp_data)[:250]}",
                    step_id,
                    "api_call",
                    {
                        "status_code": resp.status_code,
                        "url": url,
                        "method": method,
                        "response_body": resp_data,
                        "headers": dict(resp.headers)
                    }
                )

            return {
                "status_code": resp.status_code,
                "data": resp_data,
                "url": url
            }

        except requests.exceptions.RequestException as e:
            raise ActionExecutionError(
                f"Network/Connection error calling API at {url}: {str(e)}",
                step_id,
                "api_call",
                {"url": url, "method": method, "exception": str(e)}
            )

    @staticmethod
    def execute_notification(config: dict, context: dict, step_id: str = "notify_step") -> Dict[str, Any]:
        """
        Sends notifications (Slack webhook, email simulator, or internal notification).
        Config schema:
          {
            "channel": "slack", # slack, email, webhook, internal
            "webhook_url": "https://hooks.slack.com/...",
            "recipient": "dev-alerts@edvexa.com",
            "message": "Notification: {{summary}}"
          }
        """
        channel = config.get("channel", "internal")
        raw_msg = config.get("message", "Workflow event notification")
        message = interpolate_template(raw_msg, context)
        recipient = interpolate_template(config.get("recipient", "general"), context)
        webhook_url = config.get("webhook_url", "")

        result = {
            "channel": channel,
            "recipient": recipient,
            "message": message,
            "status": "delivered",
            "delivered_at": True
        }

        # If a real webhook URL is provided, dispatch it
        if webhook_url and channel in ("slack", "webhook"):
            try:
                url = interpolate_template(webhook_url, context)
                if not url.startswith("mock://"):
                    payload = {"text": message} if channel == "slack" else {"recipient": recipient, "message": message}
                    resp = requests.post(url, json=payload, timeout=5)
                    result["remote_status"] = resp.status_code
            except Exception as e:
                # Notifications can log warning without necessarily aborting workflow
                result["warning"] = f"Remote notification endpoint error: {str(e)}"

        return result

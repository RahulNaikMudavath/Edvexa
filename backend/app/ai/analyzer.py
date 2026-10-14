import os
import json
import logging
from typing import Dict, Any, List
from backend.app.config import Config
from backend.app.ai.fallback import analyze_failure_fallback

logger = logging.getLogger(__name__)

class AiFailureAnalyzer:
    """
    AI-Assisted failure analysis service.
    Analyzes failed workflow execution logs, error messages, and payload data.
    Gracefully degrades to rule-based fallback if external LLM is offline or unconfigured.
    """

    def __init__(self):
        self.gemini_api_key = Config.GEMINI_API_KEY
        self.openai_api_key = Config.OPENAI_API_KEY
        self.provider = Config.AI_PROVIDER

    def analyze(
        self,
        error_message: str,
        error_details: Dict[str, Any],
        step_logs: List[Dict[str, Any]],
        workflow_info: Dict[str, Any],
        input_payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Main entry point for failure analysis.
        Attempts LLM analysis if credentials available; otherwise uses deterministic fallback.
        """
        # If explicitly set to mock, or if no API keys are provided
        if self.provider == "mock" or (not self.gemini_api_key and not self.openai_api_key):
            logger.info("Using deterministic rule-based AI failure analysis")
            return analyze_failure_fallback(
                error_message=error_message,
                error_details=error_details,
                step_logs=step_logs,
                workflow_info=workflow_info,
                input_payload=input_payload
            )

        # Try Gemini API if key is available
        if self.gemini_api_key:
            try:
                return self._analyze_with_gemini(
                    error_message=error_message,
                    error_details=error_details,
                    step_logs=step_logs,
                    workflow_info=workflow_info,
                    input_payload=input_payload
                )
            except Exception as e:
                logger.warning(f"Gemini API analysis failed: {e}. Falling back to rule-based analyzer.")

        # Try OpenAI API if key is available
        if self.openai_api_key:
            try:
                return self._analyze_with_openai(
                    error_message=error_message,
                    error_details=error_details,
                    step_logs=step_logs,
                    workflow_info=workflow_info,
                    input_payload=input_payload
                )
            except Exception as e:
                logger.warning(f"OpenAI API analysis failed: {e}. Falling back to rule-based analyzer.")

        # Fallback if both fail or unconfigured
        return analyze_failure_fallback(
            error_message=error_message,
            error_details=error_details,
            step_logs=step_logs,
            workflow_info=workflow_info,
            input_payload=input_payload
        )

    def _build_prompt(
        self,
        error_message: str,
        error_details: dict,
        step_logs: list,
        workflow_info: dict,
        input_payload: dict
    ) -> str:
        return f"""You are an expert DevOps and Integration Reliability Engineer.
Analyze the following workflow execution failure and provide a concise, structured root cause diagnosis.

Workflow Info:
Name: {workflow_info.get('name')}
Trigger: {workflow_info.get('trigger_event_type')}
Actions: {json.dumps(workflow_info.get('actions', []), indent=2)}

Error Message:
{error_message}

Error Details:
{json.dumps(error_details, indent=2)}

Step Execution Logs:
{json.dumps(step_logs, indent=2)}

Input Event Payload:
{json.dumps(input_payload, indent=2)}

Respond ONLY with a JSON object adhering to this exact schema:
{{
  "summary": "Short 1-sentence summary of the failure",
  "root_cause": "Detailed technical explanation of what caused the failure",
  "evidence": "Specific log message, status code, or payload snippet proving the root cause",
  "suggested_action": "Clear, actionable step the user should take to fix the issue",
  "suggested_config_diff": {{}},
  "confidence_score": 0.95,
  "provider": "gemini"
}}
"""

    def _analyze_with_gemini(self, **kwargs) -> Dict[str, Any]:
        """Calls Gemini REST API directly using requests to avoid heavy dependency issues."""
        import requests
        prompt = self._build_prompt(**kwargs)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.gemini_api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"response_mime_type": "application/json"}
        }
        resp = requests.post(url, json=payload, timeout=12)
        if resp.status_code == 200:
            res_json = resp.json()
            text = res_json["candidates"][0]["content"]["parts"][0]["text"]
            result = json.loads(text)
            result["provider"] = "gemini-1.5-flash"
            return result
        raise RuntimeError(f"Gemini API returned HTTP {resp.status_code}: {resp.text}")

    def _analyze_with_openai(self, **kwargs) -> Dict[str, Any]:
        """Calls OpenAI REST API directly using requests."""
        import requests
        prompt = self._build_prompt(**kwargs)
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "You are a DevOps and API integration reliability engineer. Output strictly valid JSON."},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"}
        }
        resp = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=12)
        if resp.status_code == 200:
            res_json = resp.json()
            content = res_json["choices"][0]["message"]["content"]
            result = json.loads(content)
            result["provider"] = "openai-gpt-4o-mini"
            return result
        raise RuntimeError(f"OpenAI API returned HTTP {resp.status_code}: {resp.text}")

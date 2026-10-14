from typing import Any, Tuple

def get_nested_value(data: Any, path: str, default: Any = None) -> Any:
    """Safely traverses nested dictionaries/lists using dot notation like 'data.object.amount'."""
    if not path or not isinstance(data, (dict, list)):
        return data

    parts = path.split(".")
    curr = data
    for part in parts:
        if isinstance(curr, dict):
            curr = curr.get(part)
        elif isinstance(curr, list) and part.isdigit():
            idx = int(part)
            if 0 <= idx < len(curr):
                curr = curr[idx]
            else:
                return default
        else:
            return default
        if curr is None:
            return default
    return curr

def evaluate_trigger_filter(filter_config: dict, payload: dict) -> Tuple[bool, str]:
    """
    Evaluates trigger filters against the incoming payload.
    Empty filter returns True (matches all).
    Supported structure:
      {
        "field": "data.amount",
        "operator": ">=",   # ==, !=, >, >=, <, <=, contains, in, exists
        "value": 100
      }
    Or compound {"and": [...]} / {"or": [...]}
    """
    if not filter_config:
        return True, "No filter specified; passes by default"

    # Compound AND filter
    if "and" in filter_config and isinstance(filter_config["and"], list):
        for sub_filter in filter_config["and"]:
            passed, reason = evaluate_trigger_filter(sub_filter, payload)
            if not passed:
                return False, f"AND condition failed: {reason}"
        return True, "All AND conditions passed"

    # Compound OR filter
    if "or" in filter_config and isinstance(filter_config["or"], list):
        for sub_filter in filter_config["or"]:
            passed, _ = evaluate_trigger_filter(sub_filter, payload)
            if passed:
                return True, "At least one OR condition passed"
        return False, "None of the OR conditions passed"

    field = filter_config.get("field")
    operator = filter_config.get("operator", "==")
    target_value = filter_config.get("value")

    if not field:
        return True, "Empty field in filter; passes"

    actual_value = get_nested_value(payload, field)

    if operator == "exists":
        passed = actual_value is not None
        return passed, f"Field '{field}' exists: {passed}"

    if operator in ("==", "equals"):
        passed = actual_value == target_value
        return passed, f"'{field}' ({actual_value}) == {target_value}"

    if operator in ("!=", "not_equals"):
        passed = actual_value != target_value
        return passed, f"'{field}' ({actual_value}) != {target_value}"

    if operator in (">", "gt"):
        try:
            passed = float(actual_value) > float(target_value)
            return passed, f"'{field}' ({actual_value}) > {target_value}"
        except (ValueError, TypeError):
            return False, f"Cannot compare non-numeric types: {actual_value} > {target_value}"

    if operator in (">=", "gte"):
        try:
            passed = float(actual_value) >= float(target_value)
            return passed, f"'{field}' ({actual_value}) >= {target_value}"
        except (ValueError, TypeError):
            return False, f"Cannot compare non-numeric types: {actual_value} >= {target_value}"

    if operator in ("<", "lt"):
        try:
            passed = float(actual_value) < float(target_value)
            return passed, f"'{field}' ({actual_value}) < {target_value}"
        except (ValueError, TypeError):
            return False, f"Cannot compare non-numeric types: {actual_value} < {target_value}"

    if operator in ("<=", "lte"):
        try:
            passed = float(actual_value) <= float(target_value)
            return passed, f"'{field}' ({actual_value}) <= {target_value}"
        except (ValueError, TypeError):
            return False, f"Cannot compare non-numeric types: {actual_value} <= {target_value}"

    if operator == "contains":
        passed = target_value in str(actual_value) if actual_value is not None else False
        return passed, f"'{field}' ({actual_value}) contains {target_value}"

    if operator == "in":
        if isinstance(target_value, list):
            passed = actual_value in target_value
        else:
            passed = str(actual_value) in str(target_value)
        return passed, f"'{field}' ({actual_value}) in {target_value}"

    return True, f"Unknown operator '{operator}'; passed by default"

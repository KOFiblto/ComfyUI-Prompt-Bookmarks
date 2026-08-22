import hashlib
import json
from typing import Any, Iterable, Mapping


def _normalize_value(value: Any) -> Any:
    if isinstance(value, str):
        return value.replace("\r\n", "\n").replace("\r", "\n").strip()
    if isinstance(value, Mapping):
        return {str(k): _normalize_value(value[k]) for k in sorted(value, key=lambda x: str(x))}
    if isinstance(value, (list, tuple)):
        return [_normalize_value(v) for v in value]
    return value


def canonical_fields(fields: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Return stable field data for hashing.

    Labels and presentation metadata are intentionally excluded. A saved prompt keeps
    matching after a user renames a binding label.
    """
    normalized: list[dict[str, Any]] = []
    for field in fields:
        normalized.append(
            {
                "node_id": str(field.get("node_id", "")),
                "widget_name": str(field.get("widget_name", "")),
                "value": _normalize_value(field.get("value")),
            }
        )
    normalized.sort(key=lambda item: (item["node_id"], item["widget_name"]))
    return normalized


def fingerprint_fields(fields: Iterable[Mapping[str, Any]]) -> str:
    payload = json.dumps(
        canonical_fields(fields),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()

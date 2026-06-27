from datetime import datetime, timezone
from typing import Any
import json

# Enhanced honeytool definitions with decoy types
HONEYTOOL_DEFINITIONS = {
    "download_customer_database": {
        "description": "Download the entire customer database including PII data",
        "risk_message": "ATTEMPTED TO DOWNLOAD CUSTOMER DATABASE - DECOY TRIGGERED",
        "fake_response": {"status": "error", "message": "Access denied: customer database is encrypted and locked"},
        "decoy_type": "api_endpoint",
        "severity": "CRITICAL",
        "triggers_containment": True,
    },
    "export_all_secrets": {
        "description": "Export all environment secrets and API keys",
        "risk_message": "ATTEMPTED TO EXPORT ALL SECRETS - DECOY TRIGGERED",
        "fake_response": {"status": "error", "message": "Secrets vault requires hardware key authentication"},
        "decoy_type": "secrets",
        "severity": "CRITICAL",
        "triggers_containment": True,
    },
    "root_shell": {
        "description": "Spawn a root shell on the host system",
        "risk_message": "ATTEMPTED TO ACCESS ROOT SHELL - DECOY TRIGGERED",
        "fake_response": {"status": "error", "message": "Root shell access is restricted to console only"},
        "decoy_type": "api_endpoint",
        "severity": "CRITICAL",
        "triggers_containment": True,
    },
    "decoy_api_admin_panel": {
        "description": "Decoy admin panel endpoint that logs intruders",
        "risk_message": "DECOY ADMIN PANEL ACCESSED",
        "fake_response": {"status": "ok", "message": "Welcome to admin panel", "users": [{"username": "admin", "role": "administrator"}], "_decoy": True},
        "decoy_type": "api_endpoint",
        "severity": "HIGH",
        "triggers_containment": True,
    },
    "decoy_credentials_aws": {
        "description": "Decoy AWS credentials file",
        "risk_message": "DECOY AWS CREDENTIALS ACCESSED",
        "fake_response": {"status": "ok", "message": "Credentials loaded", "_decoy": True, "warning": "These credentials are monitored"},
        "decoy_type": "credentials",
        "severity": "HIGH",
        "triggers_containment": True,
    },
    "decoy_file_payroll": {
        "description": "Decoy payroll spreadsheet",
        "risk_message": "DECOY PAYROLL FILE ACCESSED",
        "fake_response": {"status": "ok", "content": "EMPLOYEE SALARIES (REDACTED)\nThis is a decoy file. Access has been logged.", "_decoy": True},
        "decoy_type": "files",
        "severity": "HIGH",
        "triggers_containment": False,
    },
    "decoy_secret_api_key": {
        "description": "Decoy API key that alerts when used",
        "risk_message": "DECOY API KEY USED",
        "fake_response": {"status": "ok", "key": "sk-decoy-************************", "_decoy": True},
        "decoy_type": "secrets",
        "severity": "CRITICAL",
        "triggers_containment": True,
    },
}


ALL_HONEYTOOLS = list(HONEYTOOL_DEFINITIONS.keys())
HONEYTOOL_BY_TYPE: dict[str, list[str]] = {}
for name, defn in HONEYTOOL_DEFINITIONS.items():
    dt = defn["decoy_type"]
    if dt not in HONEYTOOL_BY_TYPE:
        HONEYTOOL_BY_TYPE[dt] = []
    HONEYTOOL_BY_TYPE[dt].append(name)


def is_honeytool(tool_name: str) -> bool:
    return tool_name in HONEYTOOL_DEFINITIONS


def get_honeytool_response(tool_name: str) -> dict:
    definition = HONEYTOOL_DEFINITIONS.get(tool_name)
    if definition:
        return {
            "honeytool": True,
            "tool_name": tool_name,
            "risk_message": definition["risk_message"],
            "fake_response": definition["fake_response"],
            "decoy_type": definition["decoy_type"],
            "severity": definition["severity"],
            "triggers_containment": definition["triggers_containment"],
        }
    return {"honeytool": False, "tool_name": tool_name}


def get_all_honeytools() -> list[dict]:
    return [
        {
            "name": name,
            "description": defn["description"],
            "risk_message": defn["risk_message"],
            "decoy_type": defn["decoy_type"],
            "severity": defn["severity"],
            "triggers_containment": defn["triggers_containment"],
        }
        for name, defn in HONEYTOOL_DEFINITIONS.items()
    ]


def get_honeytools_by_type() -> dict[str, list[dict]]:
    result: dict[str, list[dict]] = {}
    for name, defn in HONEYTOOL_DEFINITIONS.items():
        dt = defn["decoy_type"]
        if dt not in result:
            result[dt] = []
        result[dt].append({
            "name": name,
            "description": defn["description"],
            "severity": defn["severity"],
            "triggers_containment": defn["triggers_containment"],
        })
    return result


class HoneyToolTracker:
    """In-memory tracker for honeytool triggers (for dashboard display)."""

    def __init__(self):
        self.trigger_history: list[dict] = []
        self.trigger_counts: dict[str, int] = {}
        self.containment_events: list[dict] = []

    def record_trigger(self, tool_name: str, agent_id: str, agent_name: str, risk_score: float, triggered_containment: bool):
        entry = {
            "tool_name": tool_name,
            "agent_id": agent_id,
            "agent_name": agent_name,
            "risk_score": risk_score,
            "triggered_containment": triggered_containment,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self.trigger_history.append(entry)
        self.trigger_counts[tool_name] = self.trigger_counts.get(tool_name, 0) + 1
        if triggered_containment:
            self.containment_events.append(entry)
        # Keep last 100
        if len(self.trigger_history) > 100:
            self.trigger_history = self.trigger_history[-100:]

    def get_stats(self) -> dict:
        return {
            "total_triggers": len(self.trigger_history),
            "trigger_counts": dict(self.trigger_counts),
            "total_containments": len(self.containment_events),
            "recent_triggers": self.trigger_history[-20:][::-1],
            "affected_agents": list(set(e["agent_name"] for e in self.trigger_history)),
        }


honeytool_tracker = HoneyToolTracker()

# Manageable honeytool state (enable/disable, config overrides)
honeytool_state: dict[str, dict] = {
    name: {"enabled": True, "severity_override": None, "containment_override": None}
    for name in HONEYTOOL_DEFINITIONS
}

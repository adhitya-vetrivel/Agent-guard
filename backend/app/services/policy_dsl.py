import re
from typing import Any
from datetime import datetime


class DSLToken:
    ALLOW = "ALLOW"
    DENY = "DENY"
    IF = "IF"
    ROLE = "ROLE"
    TIME = "TIME"
    IDENTIFIER = "IDENTIFIER"
    STRING = "STRING"
    STARTS_WITH = "STARTS_WITH"
    EQUALS = "EQUALS"
    AND = "AND"
    OR = "OR"
    LPAREN = "LPAREN"
    RPAREN = "RPAREN"
    EOF = "EOF"


TOKEN_PATTERNS = [
    (r"^\s*allow\b", "ALLOW"),
    (r"^\s*deny\b", "DENY"),
    (r"^\s*if\b", "IF"),
    (r"^\s*role\b", "ROLE"),
    (r"^\s*time\b", "TIME"),
    (r"^\s*and\b", "AND"),
    (r"^\s*or\b", "OR"),
    (r"^\s*\(", "LPAREN"),
    (r"^\s*\)", "RPAREN"),
    (r"^\s*starts_with\b", "STARTS_WITH"),
    (r"^\s*==\s*", "EQUALS"),
    (r'^\s*"([^"]*)"', "STRING"),
    (r"^\s*([a-zA-Z_][a-zA-Z0-9_]*)", "IDENTIFIER"),
]


def tokenize(source: str) -> list[tuple[str, str]]:
    tokens = []
    pos = 0
    while pos < len(source):
        matched = False
        for pattern, tok_type in TOKEN_PATTERNS:
            m = re.match(pattern, source[pos:])
            if m:
                val = m.group(0).strip()
                if tok_type == "STRING":
                    val = m.group(1)
                elif tok_type in ("ALLOW", "DENY", "IF", "ROLE", "TIME", "AND", "OR",
                                  "STARTS_WITH", "EQUALS", "LPAREN", "RPAREN"):
                    val = tok_type
                elif tok_type == "IDENTIFIER":
                    val = m.group(1)
                tokens.append((tok_type, val))
                pos += m.end() - m.start()
                matched = True
                break
        if not matched:
            pos += 1
    tokens.append(("EOF", ""))
    return tokens


class DSLAST:
    def __init__(self, action: str, tool: str, conditions: list | None = None):
        self.action = action
        self.tool = tool
        self.conditions = conditions or []


def parse(tokens: list[tuple[str, str]], pos: int = 0):
    tok_type, tok_val = tokens[pos]

    if tok_type == "ALLOW":
        action = "ALLOW"
    elif tok_type == "DENY":
        action = "DENY"
    else:
        raise SyntaxError(f"Expected ALLOW or DENY, got {tok_type}")

    pos += 1
    _, tool = tokens[pos]
    pos += 1
    conditions = []

    while pos < len(tokens) and tokens[pos][0] != "EOF":
        if tokens[pos][0] == "IF":
            pos += 1
            cond = parse_condition(tokens, pos)
            conditions.append(cond)
            pos = cond[1]
        else:
            break

    return DSLAST(action, tool, conditions), pos


def parse_condition(tokens: list[tuple[str, str]], pos: int):
    cond_type = tokens[pos][0]
    if cond_type == "ROLE":
        pos += 1
        _, val = tokens[pos]
        pos += 1
        return ("role", val), pos
    elif cond_type == "TIME":
        pos += 1
        _, time_val = tokens[pos]
        pos += 1
        return ("time", time_val), pos
    elif cond_type == "STARTS_WITH":
        pos += 1
        _, field = tokens[pos]
        pos += 1
        _, val = tokens[pos]
        pos += 1
        return ("startswith", field, val), pos
    elif cond_type == "IDENTIFIER":
        name = tokens[pos][1]
        pos += 1
        if tokens[pos][0] == "STARTS_WITH":
            pos += 1
            _, val = tokens[pos]
            pos += 1
            return ("startswith", name, val), pos
        elif tokens[pos][0] == "EQUALS":
            pos += 1
            _, val = tokens[pos]
            pos += 1
            return ("equals", name, val), pos
    raise SyntaxError(f"Unexpected token: {tokens[pos]}")


def compile_dsl(source: str) -> list[dict]:
    tokens = tokenize(source)
    rules = []
    pos = 0
    while pos < len(tokens) and tokens[pos][0] != "EOF":
        ast, pos = parse(tokens, pos)
        rule = {"action": ast.action, "tool": ast.tool, "conditions": []}
        for cond in ast.conditions:
            rule["conditions"].append(cond[0])
        rules.append(rule)
        # Skip AND/OR connectors
        while pos < len(tokens) and tokens[pos][0] in ("AND", "OR"):
            pos += 1
    return rules


class PolicyDSEngine:
    def __init__(self):
        self._compiled: list[dict] = []

    def load(self, source: str):
        self._compiled = compile_dsl(source)

    def load_json(self, json_rules: list[dict]):
        self._compiled = json_rules

    def evaluate(self, tool_name: str, role: str | None = None, path: str | None = None) -> tuple[str, str]:
        for rule in self._compiled:
            tool_pattern = rule.get("tool", "")
            if not self._match_tool(tool_name, tool_pattern):
                continue
            conditions = rule.get("conditions", [])
            if self._evaluate_conditions(conditions, role, path):
                return rule["action"], f"DSL rule matched: {rule['action']} {tool_pattern}"
        return "DENY", "No matching DSL rule"

    def _match_tool(self, tool_name: str, pattern: str) -> bool:
        if pattern.endswith("*"):
            return tool_name.startswith(pattern[:-1])
        return tool_name == pattern

    def _evaluate_conditions(self, conditions: list, role: str | None, path: str | None) -> bool:
        if not conditions:
            return True
        for cond_type, *args in conditions:
            if cond_type == "role":
                if role != args[0]:
                    return False
            elif cond_type == "startswith":
                field, val = args
                if field == "path" and path:
                    if not path.startswith(val):
                        return False
                elif field != "path":
                    return False
            elif cond_type == "equals":
                field, val = args
                if field == "role" and role != val:
                    return False
        return True

    def validate(self, source: str) -> list[str]:
        errors = []
        try:
            compile_dsl(source)
        except SyntaxError as e:
            errors.append(str(e))
        return errors

    def get_rules(self) -> list[dict]:
        return self._compiled

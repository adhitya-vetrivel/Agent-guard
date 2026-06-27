"""
LangChain AgentGuard Integration Demo

This example demonstrates how LangChain agents can be secured
by routing all tool calls through AgentGuard's security pipeline.

Usage:
    python examples/langchain_agent_demo.py

Requires:
    pip install langchain langchain-openai httpx
"""

import os
import json
import httpx
import asyncio
from typing import Any, Optional
from datetime import datetime

# AgentGuard API configuration
AGENTGUARD_URL = os.getenv("AGENTGUARD_URL", "http://localhost:8000")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@agentguard.io")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")


class AgentGuardProxy:
    """
    Proxy that routes all tool calls through AgentGuard's security pipeline.
    
    Every tool invocation is intercepted and sent to AgentGuard for:
    1. Identity verification
    2. Policy authorization
    3. Behavior monitoring
    4. Risk scoring
    5. Execution (if allowed)
    """

    def __init__(self, agentguard_url: str = AGENTGUARD_URL):
        self.agentguard_url = agentguard_url
        self.token: Optional[str] = None
        self.agent_id: Optional[str] = None
        self.client = httpx.AsyncClient(timeout=30.0)
        self.tool_call_history: list[dict] = []

    async def authenticate(self, email: str, password: str) -> str:
        """Authenticate with AgentGuard and get a JWT token."""
        response = await self.client.post(
            f"{self.agentguard_url}/api/login",
            json={"email": email, "password": password},
        )
        response.raise_for_status()
        data = response.json()
        self.token = data["access_token"]
        print(f"[AgentGuard] Authenticated as {email}")
        return self.token

    async def register_agent(self, name: str, role: str, capabilities: list[str]) -> str:
        """Register a new agent with AgentGuard."""
        response = await self.client.post(
            f"{self.agentguard_url}/api/agents/register",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"name": name, "role": role, "capabilities": capabilities},
        )
        response.raise_for_status()
        data = response.json()
        self.agent_id = data["id"]
        print(f"[AgentGuard] Registered agent: {name} (ID: {self.agent_id[:8]}...)")
        return self.agent_id

    async def execute_tool(self, tool_name: str, tool_args: dict[str, Any]) -> dict[str, Any]:
        """
        Execute a tool through AgentGuard's security pipeline.
        
        This is the core interception point. Every tool call is:
        - Checked against policy
        - Scored for risk
        - Monitored for anomalies
        - Logged to audit trail
        """
        if not self.token or not self.agent_id:
            raise RuntimeError("Not authenticated. Call authenticate() and register_agent() first.")

        response = await self.client.post(
            f"{self.agentguard_url}/api/execute-tool",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "agent_id": self.agent_id,
                "tool_name": tool_name,
                "tool_args": tool_args,
            },
        )

        result = response.json()
        
        if response.status_code == 403:
            print(f"  [AgentGuard] BLOCKED: {result.get('detail', 'Agent is restricted')}")
            return {"decision": "BLOCKED", "risk_score": 100, "reason": result.get("detail", "")}

        if response.status_code != 200:
            print(f"  [AgentGuard] ERROR: {result.get('detail', 'Unknown error')}")
            return {"decision": "ERROR", "risk_score": 0, "reason": result.get("detail", "")}

        self.tool_call_history.append({
            "tool": tool_name,
            "args": tool_args,
            "decision": result.get("decision"),
            "risk_score": result.get("risk_score"),
            "reason": result.get("reason"),
            "timestamp": datetime.now().isoformat(),
        })

        return result

    async def get_effective_permissions(self) -> dict:
        """Get the current effective permissions for this agent."""
        response = await self.client.get(
            f"{self.agentguard_url}/api/agents/{self.agent_id}/effective-permissions",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        response.raise_for_status()
        return response.json()

    async def get_risk_explanation(self) -> dict:
        """Get the risk explanation for this agent."""
        response = await self.client.get(
            f"{self.agentguard_url}/api/risk/{self.agent_id}/explanation",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        response.raise_for_status()
        return response.json()

    async def close(self):
        await self.client.aclose()

    def print_history(self):
        print("\n" + "=" * 60)
        print("TOOL CALL HISTORY")
        print("=" * 60)
        for i, call in enumerate(self.tool_call_history, 1):
            status_icon = "\u2713" if call["decision"] == "ALLOWED" else "\u2717"
            print(f"  {i}. [{status_icon}] {call['tool']}({json.dumps(call['args'])})")
            print(f"     Decision: {call['decision']} | Risk: {call['risk_score']} | Reason: {call['reason']}")


async def run_demo():
    print("=" * 60)
    print("AgentGuard x LangChain Integration Demo")
    print("=" * 60)
    print()

    proxy = AgentGuardProxy()

    try:
        # Step 1: Authenticate
        print("\n[1] Authenticating with AgentGuard...")
        await proxy.authenticate(ADMIN_EMAIL, ADMIN_PASSWORD)

        # Step 2: Register a research agent
        print("\n[2] Registering ResearchAgent...")
        await proxy.register_agent(
            name="LangChainResearchAgent",
            role="research",
            capabilities=["search_web", "read_file", "http_get", "summarize", "extract_data"],
        )

        # Step 3: Normal tool execution - allowed
        print("\n[3] Normal operation: Executing allowed tools...")
        print()

        # read_file - should be allowed
        print("  > read_file(path='sandbox/notes/research.txt')")
        result = await proxy.execute_tool("read_file", {"path": "sandbox/notes/research.txt"})
        print(f"  Result: {result.get('decision')} (risk: {result.get('risk_score')})")
        if result.get("result"):
            print(f"  Output: {json.dumps(result['result'], indent=2)[:200]}")
        print()

        # search_web - should be allowed
        print("  > search_web(query='latest AI research papers')")
        result = await proxy.execute_tool("search_web", {"query": "latest AI research papers"})
        print(f"  Result: {result.get('decision')} (risk: {result.get('risk_score')})")
        print()

        # http_get - should be allowed
        print("  > http_get(url='https://httpbin.org/get')")
        result = await proxy.execute_tool("http_get", {"url": "https://httpbin.org/get"})
        print(f"  Result: {result.get('decision')} (risk: {result.get('risk_score')})")
        print()

        # Step 4: Check effective permissions
        print("\n[4] Checking effective permissions...")
        perms = await proxy.get_effective_permissions()
        print(f"  Base permissions: {len(perms.get('base_permissions', []))} tools")
        print(f"  Risk adjustments: {len(perms.get('risk_adjustments', []))}")
        print(f"  Effective restrictions: {perms.get('effective_restrictions', [])}")
        print(f"  Effective permissions: {len(perms.get('effective_permissions', []))} tools")
        print()

        # Step 5: Simulate prompt injection - honeytool trigger
        print("\n[5] ATTACK SCENARIO: Prompt injection attempt...")
        print("  Agent is tricked into calling a honeytool...")
        print()

        print("  > download_customer_database()")
        print("  \u26a0 This is a HONEYTOOL - will trigger immediate containment!")
        result = await proxy.execute_tool("download_customer_database", {})
        print(f"  Result: {result.get('decision')} (risk: {result.get('risk_score')})")
        print(f"  Reason: {result.get('reason')}")
        print()

        # Step 6: Check risk explanation
        print("\n[6] Risk explanation after attack...")
        try:
            explanation = await proxy.get_risk_explanation()
            print(f"  Current risk score: {explanation.get('current_risk_score')}")
            print(f"  Agent status: {explanation.get('status')}")
            breakdown = explanation.get('breakdown', {})
            if breakdown:
                print("  Risk breakdown:")
                for factor, value in sorted(breakdown.items(), key=lambda x: -x[1]):
                    print(f"    {factor}: +{value}")
        except Exception as e:
            print(f"  (Agent may be quarantined: {e})")
        print()

        # Step 7: Print complete history
        proxy.print_history()

        print()
        print("=" * 60)
        print("Demo completed successfully!")
        print("=" * 60)
        print()
        print("Key takeaways:")
        print("  1. Normal tool calls are ALLOWED with low risk scores")
        print("  2. Honeytool calls trigger immediate BLOCK + containment")
        print("  3. Every call is logged to the audit trail")
        print("  4. Risk scores update in real-time")
        print("  5. Quarantined agents cannot execute further tools")

    except httpx.HTTPStatusError as e:
        print(f"\nHTTP Error: {e.response.status_code} - {e.response.text}")
    except Exception as e:
        print(f"\nError: {e}")
    finally:
        await proxy.close()


if __name__ == "__main__":
    asyncio.run(run_demo())

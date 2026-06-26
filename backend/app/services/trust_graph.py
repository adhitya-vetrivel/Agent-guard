import json
from datetime import datetime, timezone, timedelta
from typing import Any
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.agent import Agent
from app.models.trust_edge import TrustEdge


class TrustGraphService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_edge(
        self,
        parent_agent_id: str,
        child_agent_id: str,
        relationship: str = "delegates",
        delegated_permissions: list[str] | None = None,
        trust_inheritance: bool = True,
        trust_level: float = 1.0,
        ttl_hours: int | None = None,
    ) -> TrustEdge:
        expires_at = None
        if ttl_hours:
            expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)

        edge = TrustEdge(
            parent_agent_id=parent_agent_id,
            child_agent_id=child_agent_id,
            relationship=relationship,
            delegated_permissions=json.dumps(delegated_permissions or []),
            trust_inheritance=trust_inheritance,
            trust_level=trust_level,
            expires_at=expires_at,
        )
        self.session.add(edge)
        await self.session.flush()
        return edge

    async def get_children(self, agent_id: str) -> list[dict]:
        edges = await self.session.execute(
            select(TrustEdge).where(
                TrustEdge.parent_agent_id == agent_id,
                TrustEdge.is_active == True,
            )
        )
        result = []
        for edge in edges.scalars().all():
            if edge.expires_at and edge.expires_at < datetime.now(timezone.utc):
                edge.is_active = False
                continue
            child = await self.session.execute(select(Agent).where(Agent.id == edge.child_agent_id))
            child_agent = child.scalar_one_or_none()
            result.append({
                "edge_id": edge.id,
                "agent_id": edge.child_agent_id,
                "agent_name": child_agent.name if child_agent else "unknown",
                "relationship": edge.relationship,
                "delegated_permissions": json.loads(edge.delegated_permissions) if edge.delegated_permissions else [],
                "trust_inheritance": edge.trust_inheritance,
                "trust_level": edge.trust_level,
                "expires_at": edge.expires_at.isoformat() if edge.expires_at else None,
                "is_active": edge.is_active,
            })
        return result

    async def get_parents(self, agent_id: str) -> list[dict]:
        edges = await self.session.execute(
            select(TrustEdge).where(
                TrustEdge.child_agent_id == agent_id,
                TrustEdge.is_active == True,
            )
        )
        result = []
        for edge in edges.scalars().all():
            parent = await self.session.execute(select(Agent).where(Agent.id == edge.parent_agent_id))
            parent_agent = parent.scalar_one_or_none()
            result.append({
                "edge_id": edge.id,
                "agent_id": edge.parent_agent_id,
                "agent_name": parent_agent.name if parent_agent else "unknown",
                "relationship": edge.relationship,
                "delegated_permissions": json.loads(edge.delegated_permissions) if edge.delegated_permissions else [],
                "trust_level": edge.trust_level,
                "expires_at": edge.expires_at.isoformat() if edge.expires_at else None,
                "is_active": edge.is_active,
            })
        return result

    async def get_full_graph(self) -> dict:
        edges = await self.session.execute(
            select(TrustEdge).where(TrustEdge.is_active == True)
        )
        nodes_set: set[str] = set()
        graph_edges = []
        for edge in edges.scalars().all():
            if edge.expires_at and edge.expires_at < datetime.now(timezone.utc):
                edge.is_active = False
                continue
            nodes_set.add(edge.parent_agent_id)
            nodes_set.add(edge.child_agent_id)
            graph_edges.append({
                "source": edge.parent_agent_id,
                "target": edge.child_agent_id,
                "relationship": edge.relationship,
                "trust_level": edge.trust_level,
            })

        nodes = []
        for nid in nodes_set:
            agent = await self.session.execute(select(Agent).where(Agent.id == nid))
            agent_model = agent.scalar_one_or_none()
            nodes.append({
                "id": nid,
                "name": agent_model.name if agent_model else "unknown",
                "role": agent_model.role if agent_model else "unknown",
                "status": agent_model.status.value if agent_model else "UNKNOWN",
                "risk_score": agent_model.risk_score if agent_model else 0,
            })

        return {"nodes": nodes, "edges": graph_edges}

    async def deactivate_edge(self, edge_id: str) -> bool:
        result = await self.session.execute(select(TrustEdge).where(TrustEdge.id == edge_id))
        edge = result.scalar_one_or_none()
        if not edge:
            return False
        edge.is_active = False
        await self.session.flush()
        return True

    async def check_delegated_permission(self, agent_id: str, tool_name: str) -> tuple[bool, str]:
        parents = await self.get_parents(agent_id)
        for rel in parents:
            if tool_name in rel.get("delegated_permissions", []):
                return True, f"Delegated by {rel['agent_name']}"
            if rel.get("trust_inheritance"):
                return True, f"Trust inheritance from {rel['agent_name']}"
        return False, "No delegated permission found"

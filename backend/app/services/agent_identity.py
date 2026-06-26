import hashlib
import json
from typing import Any
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.agent import Agent


class AgentCryptoService:
    def __init__(self, session: AsyncSession):
        self.session = session

    @staticmethod
    def generate_key_pair() -> tuple[str, str]:
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend(),
        )
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")

        public_key = private_key.public_key()
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode("utf-8")

        return private_pem, public_pem

    @staticmethod
    def sign_request(private_key_pem: str, payload: dict) -> str:
        private_key = serialization.load_pem_private_key(
            private_key_pem.encode("utf-8"),
            password=None,
            backend=default_backend(),
        )
        message = json.dumps(payload, sort_keys=True).encode("utf-8")
        signature = private_key.sign(
            message,
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        return signature.hex()

    @staticmethod
    def verify_signature(public_key_pem: str, payload: dict, signature_hex: str) -> bool:
        try:
            public_key = serialization.load_pem_public_key(
                public_key_pem.encode("utf-8"),
                backend=default_backend(),
            )
            message = json.dumps(payload, sort_keys=True).encode("utf-8")
            signature = bytes.fromhex(signature_hex)
            public_key.verify(
                signature,
                message,
                padding.PKCS1v15(),
                hashes.SHA256(),
            )
            return True
        except Exception:
            return False

    async def register_public_key(self, agent_id: str, public_key_pem: str) -> bool:
        result = await self.session.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        if not agent:
            return False
        agent.public_key = public_key_pem
        await self.session.flush()
        return True

    async def verify_request(self, agent_id: str, payload: dict, signature_hex: str) -> bool:
        result = await self.session.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        if not agent or not agent.public_key:
            return False
        return self.verify_signature(agent.public_key, payload, signature_hex)

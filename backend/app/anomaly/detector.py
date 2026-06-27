import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Any


class MultiLevelAnomalyDetector:
    def __init__(self):
        self.global_model = IsolationForest(
            contamination=0.1,
            random_state=42,
            warm_start=True,
        )
        self.global_initialized = False
        self.global_buffer: list[list[float]] = []

        self.role_models: dict[str, IsolationForest] = {}
        self.role_initialized: dict[str, bool] = {}
        self.role_buffers: dict[str, list[list[float]]] = {}

        self.agent_models: dict[str, IsolationForest] = {}
        self.agent_initialized: dict[str, bool] = {}
        self.agent_buffers: dict[str, list[list[float]]] = {}

        self.feature_names = [
            "tool_frequency_1h",
            "tool_frequency_24h",
            "denied_requests_24h",
            "tool_diversity_24h",
            "failed_attempts_24h",
        ]

    def extract_features(self, behavior: dict[str, Any]) -> list[float]:
        return [
            float(behavior.get("tool_frequency_1h", 0)),
            float(behavior.get("tool_frequency_24h", 0)),
            float(behavior.get("denied_requests_24h", 0)),
            float(behavior.get("tool_diversity_24h", 0)),
            float(behavior.get("failed_attempts_24h", 0)),
        ]

    def add_sample(self, features: list[float], role: str | None = None, agent_id: str | None = None):
        self.global_buffer.append(features)
        if len(self.global_buffer) >= 10:
            self._train_global()

        if role:
            if role not in self.role_buffers:
                self.role_buffers[role] = []
                self.role_models[role] = IsolationForest(
                    contamination=0.1, random_state=42, warm_start=True,
                )
                self.role_initialized[role] = False
            self.role_buffers[role].append(features)
            if len(self.role_buffers[role]) >= 5:
                self._train_role(role)

        if agent_id:
            if agent_id not in self.agent_buffers:
                self.agent_buffers[agent_id] = []
                self.agent_models[agent_id] = IsolationForest(
                    contamination=0.1, random_state=42, warm_start=True,
                )
                self.agent_initialized[agent_id] = False
            self.agent_buffers[agent_id].append(features)
            if len(self.agent_buffers[agent_id]) >= 3:
                self._train_agent(agent_id)

    def _train_global(self):
        if len(self.global_buffer) < 10:
            return
        X = np.array(self.global_buffer)
        self.global_model.fit(X)
        self.global_initialized = True

    def _train_role(self, role: str):
        buf = self.role_buffers.get(role, [])
        if len(buf) < 5:
            return
        X = np.array(buf)
        self.role_models[role].fit(X)
        self.role_initialized[role] = True

    def _train_agent(self, agent_id: str):
        buf = self.agent_buffers.get(agent_id, [])
        if len(buf) < 3:
            return
        X = np.array(buf)
        self.agent_models[agent_id].fit(X)
        self.agent_initialized[agent_id] = True

    def _predict_model(self, model: IsolationForest, initialized: bool, features: list[float]) -> tuple[bool, float]:
        if not initialized:
            return False, 0.0
        X = np.array([features])
        pred = model.predict(X)
        score = model.decision_function(X)[0]
        is_anomaly = bool(pred[0] == -1)
        anomaly_score = float(max(0.0, min(1.0, -score / 2 + 0.5)))
        return is_anomaly, anomaly_score

    def predict(
        self, features: list[float], role: str | None = None, agent_id: str | None = None
    ) -> dict[str, Any]:
        global_anomaly, global_score = self._predict_model(
            self.global_model, self.global_initialized, features
        )

        role_anomaly, role_score = False, 0.0
        if role and role in self.role_models:
            role_anomaly, role_score = self._predict_model(
                self.role_models[role], self.role_initialized.get(role, False), features
            )

        agent_anomaly, agent_score = False, 0.0
        if agent_id and agent_id in self.agent_models:
            agent_anomaly, agent_score = self._predict_model(
                self.agent_models[agent_id], self.agent_initialized.get(agent_id, False), features
            )

        weights = []
        scores = []
        if self.global_initialized:
            weights.append(0.3)
            scores.append(global_score)
        if role and self.role_initialized.get(role, False):
            weights.append(0.3)
            scores.append(role_score)
        if agent_id and self.agent_initialized.get(agent_id, False):
            weights.append(0.4)
            scores.append(agent_score)

        combined_score = 0.0
        if scores and weights:
            combined_score = sum(s * w for s, w in zip(scores, weights)) / sum(weights)

        return {
            "global_score": round(global_score, 3),
            "role_score": round(role_score, 3),
            "personal_score": round(agent_score, 3),
            "combined_score": round(combined_score, 3),
            "is_anomaly": combined_score > 0.6 or global_anomaly,
            "is_global_anomaly": global_anomaly,
            "is_role_anomaly": role_anomaly,
            "is_agent_anomaly": agent_anomaly,
            "global_initialized": self.global_initialized,
            "role_initialized": self.role_initialized.get(role, False) if role else False,
            "agent_initialized": self.agent_initialized.get(agent_id, False) if agent_id else False,
            "samples_global": len(self.global_buffer),
            "samples_role": len(self.role_buffers.get(role, [])) if role else 0,
            "samples_agent": len(self.agent_buffers.get(agent_id, [])) if agent_id else 0,
        }

    def get_stats(self) -> dict:
        return {
            "global_samples": len(self.global_buffer),
            "global_initialized": self.global_initialized,
            "role_models": list(self.role_models.keys()),
            "role_samples": {r: len(b) for r, b in self.role_buffers.items()},
            "agent_models": len(self.agent_models),
            "agent_samples": {a: len(b) for a, b in list(self.agent_buffers.items())[:10]},
        }


anomaly_detector = MultiLevelAnomalyDetector()

# Backward-compatible alias
AnomalyDetector = MultiLevelAnomalyDetector

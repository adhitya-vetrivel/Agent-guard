import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Any


class AnomalyDetector:
    def __init__(self):
        self.model = IsolationForest(
            contamination=0.1,
            random_state=42,
            warm_start=True,
        )
        self.initialized = False
        self.feature_buffer: list[list[float]] = []

    def extract_features(self, behavior: dict[str, Any]) -> list[float]:
        return [
            float(behavior.get("tool_frequency_1h", 0)),
            float(behavior.get("tool_frequency_24h", 0)),
            float(behavior.get("denied_requests_24h", 0)),
            float(behavior.get("tool_diversity_24h", 0)),
            float(behavior.get("failed_attempts_24h", 0)),
        ]

    def add_sample(self, features: list[float]):
        self.feature_buffer.append(features)
        if len(self.feature_buffer) >= 10:
            self._train()

    def _train(self):
        if len(self.feature_buffer) < 10:
            return
        X = np.array(self.feature_buffer)
        self.model.fit(X)
        self.initialized = True

    def predict(self, features: list[float]) -> tuple[bool, float]:
        if not self.initialized or len(self.feature_buffer) < 10:
            return False, 0.0
        X = np.array([features])
        pred = self.model.predict(X)
        score = self.model.decision_function(X)[0]
        is_anomaly = bool(pred[0] == -1)
        anomaly_score = float(max(0.0, min(1.0, -score / 2 + 0.5)))
        return is_anomaly, anomaly_score


anomaly_detector = AnomalyDetector()

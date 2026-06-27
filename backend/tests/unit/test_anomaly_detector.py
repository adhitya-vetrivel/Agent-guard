import pytest
from app.anomaly.detector import AnomalyDetector


class TestAnomalyDetector:
    def test_extract_features(self):
        detector = AnomalyDetector()
        behavior = {
            "tool_frequency_1h": 5,
            "tool_frequency_24h": 20,
            "denied_requests_24h": 2,
            "tool_diversity_24h": 4,
            "failed_attempts_24h": 1,
        }
        features = detector.extract_features(behavior)
        assert features == [5.0, 20.0, 2.0, 4.0, 1.0]

    def test_extract_features_defaults(self):
        detector = AnomalyDetector()
        features = detector.extract_features({})
        assert features == [0.0, 0.0, 0.0, 0.0, 0.0]

    def test_not_initialized(self):
        detector = AnomalyDetector()
        result = detector.predict([1, 2, 3, 4, 5])
        assert result["is_anomaly"] == False
        assert result["combined_score"] == 0.0

    def test_initialized_after_10_samples(self):
        detector = AnomalyDetector()
        assert detector.global_initialized == False
        for _ in range(10):
            detector.add_sample([1.0, 2.0, 3.0, 4.0, 5.0])
        assert detector.global_initialized == True

    def test_add_sample_buffer_size(self):
        detector = AnomalyDetector()
        assert len(detector.global_buffer) == 0
        detector.add_sample([1.0, 2.0, 3.0, 4.0, 5.0])
        assert len(detector.global_buffer) == 1
        assert detector.global_initialized == False

    def test_prediction_returns_dict(self):
        detector = AnomalyDetector()
        normal = [5.0, 20.0, 2.0, 4.0, 1.0]
        for _ in range(10):
            detector.add_sample(normal)
        result = detector.predict(normal)
        assert isinstance(result["is_anomaly"], bool)
        assert isinstance(result["combined_score"], float)
        assert 0.0 <= result["combined_score"] <= 1.0

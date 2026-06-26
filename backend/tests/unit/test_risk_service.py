import pytest
from app.services.risk_service import RiskService
from app.models.agent import Agent, AgentStatus
from app.models.risk_event import RiskSeverity


class TestRiskServiceStatic:
    def test_get_severity_static_safe(self):
        assert RiskService.get_severity_static(0) == "SAFE"
        assert RiskService.get_severity_static(15) == "SAFE"
        assert RiskService.get_severity_static(30) == "SAFE"

    def test_get_severity_static_warning(self):
        assert RiskService.get_severity_static(31) == "WARNING"
        assert RiskService.get_severity_static(45) == "WARNING"
        assert RiskService.get_severity_static(60) == "WARNING"

    def test_get_severity_static_high(self):
        assert RiskService.get_severity_static(61) == "HIGH"
        assert RiskService.get_severity_static(70) == "HIGH"
        assert RiskService.get_severity_static(80) == "HIGH"

    def test_get_severity_static_critical(self):
        assert RiskService.get_severity_static(81) == "CRITICAL"
        assert RiskService.get_severity_static(95) == "CRITICAL"
        assert RiskService.get_severity_static(100) == "CRITICAL"


class TestRiskServiceInstance:
    @pytest.mark.asyncio
    async def test_get_severity_safe(self, session):
        service = RiskService(session)
        assert service.get_severity(0) == RiskSeverity.SAFE
        assert service.get_severity(30) == RiskSeverity.SAFE

    @pytest.mark.asyncio
    async def test_get_severity_warning(self, session):
        service = RiskService(session)
        assert service.get_severity(31) == RiskSeverity.WARNING
        assert service.get_severity(60) == RiskSeverity.WARNING

    @pytest.mark.asyncio
    async def test_get_severity_high(self, session):
        service = RiskService(session)
        assert service.get_severity(61) == RiskSeverity.HIGH
        assert service.get_severity(80) == RiskSeverity.HIGH

    @pytest.mark.asyncio
    async def test_get_severity_critical(self, session):
        service = RiskService(session)
        assert service.get_severity(81) == RiskSeverity.CRITICAL
        assert service.get_severity(100) == RiskSeverity.CRITICAL

    @pytest.mark.asyncio
    async def test_should_contain_thresholds(self, session, mocker):
        service = RiskService(session)
        mocker.patch("app.services.risk_service.settings.DEFAULT_RISK_THRESHOLD", 80)
        assert await service.should_contain(50) == False
        assert await service.should_contain(79) == False
        assert await service.should_contain(81) == True
        assert await service.should_contain(100) == True

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from unios_companion.server import CompanionService


class CompanionServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.service = CompanionService.create(
            state_dir=Path(self.temp_dir.name),
            model="test-model",
            ollama_url="http://127.0.0.1:11434",
            pairing_code="test-code",
            pairing_ttl_seconds=60,
            lan_enabled=False,
        )

    def tearDown(self) -> None:
        self.service.store.close()
        self.temp_dir.cleanup()

    def test_confirm_pairing_issues_authorizable_token(self) -> None:
        paired = self.service.confirm_pairing(
            pairing_code="test-code", device_id="phone-12345678", label="Test phone"
        )

        authorized = self.service.store.authorize(paired["token"])

        self.assertEqual("phone-12345678", paired["device_id"])
        self.assertEqual("Bearer", paired["token_type"])
        self.assertIsNotNone(authorized)

    def test_confirm_pairing_rejects_bad_code(self) -> None:
        with self.assertRaises(PermissionError):
            self.service.confirm_pairing(
                pairing_code="wrong-code", device_id="phone-12345678", label="Test phone"
            )


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from unios_companion.store import PairingStore


class PairingStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = PairingStore(Path(self.temp_dir.name))

    def tearDown(self) -> None:
        self.store.close()
        self.temp_dir.cleanup()

    def test_issued_token_authorizes_only_its_device(self) -> None:
        token = self.store.issue_token("phone-12345678", "Test phone")

        device = self.store.authorize(token)

        self.assertIsNotNone(device)
        assert device is not None
        self.assertEqual("phone-12345678", device.device_id)
        self.assertIsNone(self.store.authorize("not-a-real-token"))

    def test_revoke_invalidates_token(self) -> None:
        token = self.store.issue_token("phone-12345678", "Test phone")

        self.assertTrue(self.store.revoke(token))
        self.assertIsNone(self.store.authorize(token))
        self.assertFalse(self.store.revoke(token))


if __name__ == "__main__":
    unittest.main()

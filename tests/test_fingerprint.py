import unittest

from prompt_bookmarks.fingerprint import fingerprint_fields


class FingerprintTests(unittest.TestCase):
    def test_field_order_does_not_change_fingerprint(self):
        a = [
            {"node_id": "2", "widget_name": "text", "label": "B", "value": "world"},
            {"node_id": "1", "widget_name": "text", "label": "A", "value": "hello"},
        ]
        b = list(reversed(a))
        self.assertEqual(fingerprint_fields(a), fingerprint_fields(b))

    def test_label_does_not_change_fingerprint(self):
        a = [{"node_id": "1", "widget_name": "text", "label": "Main", "value": "hello"}]
        b = [{"node_id": "1", "widget_name": "text", "label": "Renamed", "value": "hello"}]
        self.assertEqual(fingerprint_fields(a), fingerprint_fields(b))

    def test_value_change_changes_fingerprint(self):
        a = [{"node_id": "1", "widget_name": "text", "value": "hello"}]
        b = [{"node_id": "1", "widget_name": "text", "value": "hello!"}]
        self.assertNotEqual(fingerprint_fields(a), fingerprint_fields(b))

    def test_newlines_and_outer_whitespace_are_normalized(self):
        a = [{"node_id": "1", "widget_name": "text", "value": "  a\r\nb  "}]
        b = [{"node_id": "1", "widget_name": "text", "value": "a\nb"}]
        self.assertEqual(fingerprint_fields(a), fingerprint_fields(b))


if __name__ == "__main__":
    unittest.main()

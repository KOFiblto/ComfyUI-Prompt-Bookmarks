import tempfile
import unittest
from pathlib import Path

from prompt_bookmarks.database import PromptBookmarksDB


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.db = PromptBookmarksDB(Path(self.tempdir.name) / "vault.db")
        self.workflow_id = "wf-123"
        self.db.upsert_workflow(self.workflow_id, "H3 Test", "H3 Test.json")

    def tearDown(self):
        self.tempdir.cleanup()

    def fields(self, value="a woman turns around"):
        return [
            {
                "node_id": "42",
                "node_type": "TextNode",
                "widget_name": "text",
                "label": "Main prompt",
                "value": value,
            }
        ]

    def test_bindings_replace(self):
        bindings = self.db.replace_bindings(
            self.workflow_id,
            [{"node_id": "42", "node_type": "TextNode", "widget_name": "text", "label": "Main"}],
        )
        self.assertEqual(len(bindings), 1)
        self.assertEqual(bindings[0]["node_id"], "42")

    def test_create_and_list_prompt(self):
        group = self.db.create_group(self.workflow_id, "Character")
        prompt = self.db.create_prompt(self.workflow_id, "Turn around", self.fields(), group["id"])
        items = self.db.list_prompts(workflow_id=self.workflow_id)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], prompt["id"])
        self.assertEqual(items[0]["group_name"], "Character")
        self.assertEqual(items[0]["fields"][0]["value"], "a woman turns around")

    def test_apply_usage_counter_storage(self):
        prompt = self.db.create_prompt(self.workflow_id, "Turn around", self.fields())
        self.db.mark_used(prompt["id"])
        stored = self.db.get_prompt(prompt["id"])
        self.assertEqual(stored["use_count"], 1)
        self.assertIsNotNone(stored["last_used_at"])

    def test_media_links_only_when_fields_match(self):
        prompt = self.db.create_prompt(self.workflow_id, "Turn around", self.fields())
        linked = self.db.link_media_by_fields(
            self.workflow_id,
            self.fields(),
            "exec-1",
            [{"filename": "x.mp4", "subfolder": "H3", "type": "output", "media_type": "video"}],
        )
        self.assertEqual(linked, [prompt["id"]])
        self.assertEqual(self.db.get_prompt(prompt["id"])["media_count"], 1)

        not_linked = self.db.link_media_by_fields(
            self.workflow_id,
            self.fields("different prompt"),
            "exec-2",
            [{"filename": "y.mp4", "subfolder": "H3", "type": "output", "media_type": "video"}],
        )
        self.assertEqual(not_linked, [])
        self.assertEqual(self.db.get_prompt(prompt["id"])["media_count"], 1)

    def test_group_delete_keeps_prompt(self):
        group = self.db.create_group(self.workflow_id, "Character")
        prompt = self.db.create_prompt(self.workflow_id, "Turn around", self.fields(), group["id"])
        self.assertTrue(self.db.delete_group(group["id"]))
        stored = self.db.get_prompt(prompt["id"])
        self.assertIsNone(stored["group_id"])


if __name__ == "__main__":
    unittest.main()

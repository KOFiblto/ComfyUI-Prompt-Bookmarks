import sqlite3
import tempfile
import unittest
from pathlib import Path

from prompt_bookmarks.database import PromptBookmarksDB, SCHEMA_VERSION


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
                "binding_key": "TextNode|Prompt||text",
                "label": "Main prompt",
                "value": value,
            }
        ]

    def test_schema_version_is_current(self):
        self.assertEqual(self.db.schema_version(), SCHEMA_VERSION)

    def test_bindings_replace(self):
        bindings = self.db.replace_bindings(
            self.workflow_id,
            [
                {
                    "node_id": "42",
                    "node_type": "TextNode",
                    "widget_name": "text",
                    "binding_key": "TextNode|Prompt||text",
                    "label": "Main",
                }
            ],
        )
        self.assertEqual(len(bindings), 1)
        self.assertEqual(bindings[0]["node_id"], "42")
        self.assertEqual(bindings[0]["binding_key"], "TextNode|Prompt||text")

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

    def test_overwrite_prompt_keeps_identity_and_usage(self):
        prompt = self.db.create_prompt(self.workflow_id, "Turn around", self.fields("old prompt"))
        self.db.mark_used(prompt["id"])
        updated = self.db.update_prompt(prompt["id"], fields=self.fields("new prompt"))
        self.assertEqual(updated["id"], prompt["id"])
        self.assertEqual(updated["use_count"], 1)
        self.assertEqual(updated["fields"][0]["value"], "new prompt")

    def test_sort_modes(self):
        prompt_b = self.db.create_prompt(self.workflow_id, "Beta", self.fields("beta"))
        self.db.create_prompt(self.workflow_id, "Alpha", self.fields("alpha"))
        self.db.mark_used(prompt_b["id"])
        self.db.mark_used(prompt_b["id"])

        by_name = self.db.list_prompts(workflow_id=self.workflow_id, sort="name")
        self.assertEqual([item["name"] for item in by_name], ["Alpha", "Beta"])

        by_use = self.db.list_prompts(workflow_id=self.workflow_id, sort="used")
        self.assertEqual(by_use[0]["name"], "Beta")
        self.assertEqual(by_use[0]["use_count"], 2)

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

    def test_new_binding_key_does_not_break_legacy_prompt_fingerprint(self):
        legacy_fields = [
            {
                "node_id": "42",
                "node_type": "TextNode",
                "widget_name": "text",
                "label": "Main prompt",
                "value": "legacy prompt",
            }
        ]
        prompt = self.db.create_prompt(self.workflow_id, "Legacy", legacy_fields)
        new_fields = [dict(legacy_fields[0], binding_key="TextNode|Prompt||text")]
        linked = self.db.link_media_by_fields(
            self.workflow_id,
            new_fields,
            "exec-upgraded",
            [{"filename": "upgraded.png", "subfolder": "", "type": "output", "media_type": "image"}],
        )
        self.assertEqual(linked, [prompt["id"]])
        self.assertEqual(self.db.get_prompt(prompt["id"])["media_count"], 1)

    def test_group_delete_rejects_non_empty_group(self):
        group = self.db.create_group(self.workflow_id, "Character")
        prompt = self.db.create_prompt(self.workflow_id, "Turn around", self.fields(), group["id"])
        with self.assertRaisesRegex(ValueError, "Group is not empty"):
            self.db.delete_group(group["id"])
        stored = self.db.get_prompt(prompt["id"])
        self.assertEqual(stored["group_id"], group["id"])

    def test_empty_group_can_be_deleted(self):
        group = self.db.create_group(self.workflow_id, "Character")
        self.assertTrue(self.db.delete_group(group["id"]))
        self.assertEqual(self.db.list_groups(self.workflow_id), [])

    def test_backup_round_trip(self):
        self.db.replace_bindings(
            self.workflow_id,
            [
                {
                    "node_id": "42",
                    "node_type": "TextNode",
                    "widget_name": "text",
                    "binding_key": "TextNode|Prompt||text",
                    "label": "Main",
                }
            ],
        )
        group = self.db.create_group(self.workflow_id, "Character")
        prompt = self.db.create_prompt(self.workflow_id, "Turn around", self.fields(), group["id"])
        self.db.mark_used(prompt["id"])
        self.db.link_media_by_fields(
            self.workflow_id,
            self.fields(),
            "exec-1",
            [{"filename": "preview.mp4", "subfolder": "H3", "type": "output", "media_type": "video"}],
        )

        backup = self.db.export_backup()
        restored = PromptBookmarksDB(Path(self.tempdir.name) / "restored.db")
        counts = restored.import_backup(backup)

        self.assertEqual(counts["workflows"], 1)
        self.assertEqual(counts["prompts"], 1)
        restored_prompt = restored.get_prompt(prompt["id"])
        self.assertIsNotNone(restored_prompt)
        self.assertEqual(restored_prompt["group_name"], "Character")
        self.assertEqual(restored_prompt["fields"][0]["binding_key"], "TextNode|Prompt||text")
        self.assertEqual(restored_prompt["use_count"], 1)
        self.assertEqual(restored_prompt["media_count"], 1)
        self.assertEqual(restored.get_bindings(self.workflow_id)[0]["binding_key"], "TextNode|Prompt||text")

        preview = restored.preview_backup_import(backup)
        self.assertEqual(preview["name_conflicts"], 0)
        second = restored.import_backup(backup)
        self.assertEqual(second["media"], 0)
        self.assertEqual(restored.get_prompt(prompt["id"])["media_count"], 1)

    def test_backup_name_conflict_policies(self):
        source = PromptBookmarksDB(Path(self.tempdir.name) / "source.db")
        source.upsert_workflow(self.workflow_id, "H3 Test", "H3 Test.json")
        source_group = source.create_group(self.workflow_id, "Character")
        incoming = source.create_prompt(self.workflow_id, "Turn around", self.fields("incoming prompt"), source_group["id"])
        source.link_media_by_fields(
            self.workflow_id,
            self.fields("incoming prompt"),
            "exec-import",
            [{"filename": "incoming.png", "subfolder": "", "type": "output", "media_type": "image"}],
        )
        backup = source.export_backup()

        def target(filename):
            db = PromptBookmarksDB(Path(self.tempdir.name) / filename)
            db.upsert_workflow(self.workflow_id, "H3 Test", "H3 Test.json")
            group = db.create_group(self.workflow_id, "Character")
            local = db.create_prompt(self.workflow_id, "Turn around", self.fields("local prompt"), group["id"])
            return db, local

        overwrite_db, overwrite_local = target("overwrite.db")
        preview = overwrite_db.preview_backup_import(backup)
        self.assertEqual(preview["name_conflicts"], 1)
        overwritten = overwrite_db.import_backup(backup, conflict_policy="overwrite")
        self.assertEqual(overwritten["name_conflicts"], 1)
        self.assertEqual(overwritten["overwritten"], 1)
        overwrite_items = overwrite_db.list_prompts(workflow_id=self.workflow_id)
        self.assertEqual(len(overwrite_items), 1)
        self.assertEqual(overwrite_items[0]["id"], overwrite_local["id"])
        self.assertEqual(overwrite_items[0]["fields"][0]["value"], "incoming prompt")
        self.assertEqual(overwrite_items[0]["media_count"], 1)

        keep_db, _ = target("keep.db")
        kept = keep_db.import_backup(backup, conflict_policy="keep_both")
        self.assertEqual(kept["name_conflicts"], 1)
        keep_items = keep_db.list_prompts(workflow_id=self.workflow_id)
        self.assertEqual(len(keep_items), 2)
        self.assertIn(incoming["id"], {item["id"] for item in keep_items})

        skip_db, skip_local = target("skip.db")
        skipped = skip_db.import_backup(backup, conflict_policy="skip")
        self.assertEqual(skipped["name_conflicts"], 1)
        self.assertEqual(skipped["skipped"], 1)
        skip_items = skip_db.list_prompts(workflow_id=self.workflow_id)
        self.assertEqual(len(skip_items), 1)
        self.assertEqual(skip_items[0]["id"], skip_local["id"])
        self.assertEqual(skip_items[0]["fields"][0]["value"], "local prompt")

    def test_backup_import_rejects_unknown_format(self):
        with self.assertRaisesRegex(ValueError, "Unsupported"):
            self.db.import_backup({"format": "other", "format_version": 1, "workflows": []})

    def test_legacy_database_migrates_to_schema_v2(self):
        path = Path(self.tempdir.name) / "legacy.db"
        conn = sqlite3.connect(path)
        conn.executescript(
            """
            CREATE TABLE workflows (
                workflow_id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                path TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE workflow_bindings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workflow_id TEXT NOT NULL,
                node_id TEXT NOT NULL,
                node_type TEXT NOT NULL DEFAULT '',
                widget_name TEXT NOT NULL,
                label TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0,
                UNIQUE(workflow_id, node_id, widget_name)
            );
            INSERT INTO workflows VALUES('legacy-wf', 'Legacy', '', '2026-01-01', '2026-01-01');
            INSERT INTO workflow_bindings(workflow_id, node_id, node_type, widget_name, label, sort_order)
            VALUES('legacy-wf', '7', 'TextNode', 'text', 'Prompt', 0);
            """
        )
        conn.commit()
        conn.close()

        migrated = PromptBookmarksDB(path)
        self.assertEqual(migrated.schema_version(), 2)
        binding = migrated.get_bindings("legacy-wf")[0]
        self.assertEqual(binding["node_id"], "7")
        self.assertEqual(binding["binding_key"], "")


if __name__ == "__main__":
    unittest.main()

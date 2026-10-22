"""
Tests for task API endpoints used by the Tasks modal.
"""
import pytest

import main

NEW_TASK = {"title": "Review Q4 inventory levels", "priority": "high", "dueDate": "2025-10-08"}


@pytest.fixture(autouse=True)
def clear_tasks():
    """Reset in-memory tasks between tests."""
    main.tasks.clear()
    yield
    main.tasks.clear()


class TestTaskEndpoints:
    """Test suite for task CRUD endpoints."""

    def test_no_tasks_initially(self, client):
        """Test the task list starts empty."""
        response = client.get("/api/tasks")
        assert response.status_code == 200
        assert response.json() == []

    def test_create_task(self, client):
        """Test creating a task returns it as pending with an id."""
        response = client.post("/api/tasks", json=NEW_TASK)
        assert response.status_code == 201

        task = response.json()
        assert task["title"] == "Review Q4 inventory levels"
        assert task["priority"] == "high"
        assert task["dueDate"] == "2025-10-08"
        assert task["status"] == "pending"
        assert isinstance(task["id"], str)

    def test_task_ids_do_not_collide_with_sample_task_ids(self, client):
        """Test API task ids are never the numeric ids the client's sample tasks use."""
        task = client.post("/api/tasks", json=NEW_TASK).json()
        assert not task["id"].isdigit()

    def test_created_tasks_are_listed_newest_first(self, client):
        """Test the list returns tasks newest first, matching how the client prepends them."""
        first = client.post("/api/tasks", json=NEW_TASK).json()
        second = client.post("/api/tasks", json={**NEW_TASK, "title": "Approve Tokyo order"}).json()

        listed = client.get("/api/tasks").json()
        assert [t["id"] for t in listed] == [second["id"], first["id"]]
        assert first["id"] != second["id"]

    def test_create_task_trims_title(self, client):
        """Test surrounding whitespace is removed from the title."""
        task = client.post("/api/tasks", json={**NEW_TASK, "title": "  Count bins  "}).json()
        assert task["title"] == "Count bins"

    @pytest.mark.parametrize("title", ["", "   "])
    def test_create_task_blank_title_rejected(self, client, title):
        """Test a blank title is a validation error."""
        response = client.post("/api/tasks", json={**NEW_TASK, "title": title})
        assert response.status_code == 422
        assert client.get("/api/tasks").json() == []

    def test_create_task_invalid_priority_rejected(self, client):
        """Test priority must be high, medium, or low."""
        response = client.post("/api/tasks", json={**NEW_TASK, "priority": "urgent"})
        assert response.status_code == 422

    def test_create_task_invalid_due_date_rejected(self, client):
        """Test dueDate must be a YYYY-MM-DD date."""
        response = client.post("/api/tasks", json={**NEW_TASK, "dueDate": "next week"})
        assert response.status_code == 422

    def test_create_task_missing_field_rejected(self, client):
        """Test all fields are required."""
        response = client.post("/api/tasks", json={"title": "No date", "priority": "low"})
        assert response.status_code == 422

    def test_toggle_task_completes_then_reopens(self, client):
        """Test PATCH flips status between pending and completed."""
        task = client.post("/api/tasks", json=NEW_TASK).json()

        completed = client.patch(f"/api/tasks/{task['id']}")
        assert completed.status_code == 200
        assert completed.json()["status"] == "completed"

        reopened = client.patch(f"/api/tasks/{task['id']}")
        assert reopened.json()["status"] == "pending"
        assert client.get("/api/tasks").json()[0]["status"] == "pending"

    def test_toggle_nonexistent_task(self, client):
        """Test toggling a task that doesn't exist."""
        response = client.patch("/api/tasks/task-999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_delete_task(self, client):
        """Test deleting a task removes only that task."""
        keep = client.post("/api/tasks", json=NEW_TASK).json()
        remove = client.post("/api/tasks", json={**NEW_TASK, "title": "Remove me"}).json()

        response = client.delete(f"/api/tasks/{remove['id']}")
        assert response.status_code == 200
        assert response.json()["id"] == remove["id"]
        assert [t["id"] for t in client.get("/api/tasks").json()] == [keep["id"]]

    def test_delete_nonexistent_task(self, client):
        """Test deleting a task that doesn't exist."""
        response = client.delete("/api/tasks/task-999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_ids_are_not_reused_after_delete(self, client):
        """Test a new task never gets the id of a deleted one."""
        first = client.post("/api/tasks", json=NEW_TASK).json()
        client.delete(f"/api/tasks/{first['id']}")
        second = client.post("/api/tasks", json=NEW_TASK).json()
        assert second["id"] != first["id"]

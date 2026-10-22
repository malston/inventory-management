"""
Tests for restocking API endpoints.
"""
from datetime import date, timedelta

import pytest

import main

FULL_RESTOCK_COST = 4136.98
FULL_RESTOCK_ORDER = [
    "FLT-405", "WDG-001", "GSK-203",
    "BRG-102", "PSU-501", "SNR-420", "CTL-330", "VLV-506",
]


@pytest.fixture(autouse=True)
def clear_restock_orders():
    """Reset in-memory restock orders between tests."""
    main.restock_orders.clear()
    yield
    main.restock_orders.clear()


class TestDemandForecastRestockFields:
    """Test suite for restock fields on demand forecasts."""

    def test_demand_forecasts_have_cost_and_lead_time(self, client):
        """Test that every forecast carries a unit cost and lead time."""
        response = client.get("/api/demand")
        data = response.json()

        for forecast in data:
            assert isinstance(forecast["unit_cost"], (int, float))
            assert forecast["unit_cost"] > 0
            assert isinstance(forecast["lead_time_days"], int)
            assert forecast["lead_time_days"] > 0


class TestRestockRecommendations:
    """Test suite for budget-based restock recommendations."""

    def test_recommendations_structure(self, client):
        """Test the recommendation response structure."""
        response = client.get("/api/restock/recommendations?budget=1000")
        assert response.status_code == 200

        data = response.json()
        assert data["budget"] == 1000
        assert isinstance(data["items"], list)
        assert "total_cost" in data
        assert "remaining_budget" in data
        assert "full_restock_cost" in data

        item = data["items"][0]
        for field in ["item_sku", "item_name", "trend", "quantity",
                      "unit_cost", "line_total", "lead_time_days"]:
            assert field in item

    def test_full_restock_cost(self, client):
        """Test full restock cost covers every positive demand gap."""
        response = client.get("/api/restock/recommendations?budget=0")
        data = response.json()
        assert abs(data["full_restock_cost"] - FULL_RESTOCK_COST) < 0.01

    def test_large_budget_ranks_increasing_trend_then_gap(self, client):
        """Test a budget covering everything orders increasing trends first, then by gap size."""
        response = client.get("/api/restock/recommendations?budget=100000")
        data = response.json()

        assert [item["item_sku"] for item in data["items"]] == FULL_RESTOCK_ORDER
        assert abs(data["total_cost"] - FULL_RESTOCK_COST) < 0.01
        assert abs(data["remaining_budget"] - (100000 - FULL_RESTOCK_COST)) < 0.01

    def test_quantity_is_demand_gap(self, client):
        """Test recommended quantity equals forecasted minus current demand."""
        demand = {d["item_sku"]: d for d in client.get("/api/demand").json()}
        response = client.get("/api/restock/recommendations?budget=100000")

        for item in response.json()["items"]:
            forecast = demand[item["item_sku"]]
            assert item["quantity"] == forecast["forecasted_demand"] - forecast["current_demand"]

    def test_line_total_calculation(self, client):
        """Test each line total is quantity times unit cost."""
        response = client.get("/api/restock/recommendations?budget=100000")

        for item in response.json()["items"]:
            assert abs(item["line_total"] - item["quantity"] * item["unit_cost"]) < 0.01

    def test_items_without_demand_gap_excluded(self, client):
        """Test decreasing-demand items are never recommended."""
        for budget in [0, 1000, 100000]:
            response = client.get(f"/api/restock/recommendations?budget={budget}")
            skus = [item["item_sku"] for item in response.json()["items"]]
            assert "MTR-304" not in skus

    def test_zero_budget_recommends_nothing(self, client):
        """Test a zero budget returns no items."""
        response = client.get("/api/restock/recommendations?budget=0")
        data = response.json()

        assert data["items"] == []
        assert data["total_cost"] == 0
        assert data["remaining_budget"] == 0

    def test_budget_exactly_matching_line_total(self, client):
        """Test a budget equal to the first line total buys it in full with nothing left."""
        response = client.get("/api/restock/recommendations?budget=960")
        data = response.json()

        assert [(i["item_sku"], i["quantity"]) for i in data["items"]] == [("FLT-405", 150)]
        assert data["total_cost"] == 960
        assert data["remaining_budget"] == 0

    def test_partial_quantity_on_last_item(self, client):
        """Test leftover budget buys a partial quantity of the next item."""
        response = client.get("/api/restock/recommendations?budget=1000")
        data = response.json()

        assert [(i["item_sku"], i["quantity"]) for i in data["items"]] == [
            ("FLT-405", 150), ("WDG-001", 3),
        ]
        assert abs(data["total_cost"] - 997.50) < 0.01
        assert abs(data["remaining_budget"] - 2.50) < 0.01

    def test_stops_after_partial_item(self, client):
        """Test no further items are added once an item is partially filled."""
        # 1020 leaves $10 after WDG-001's partial fill, enough for one GSK-203 at $8.75.
        response = client.get("/api/restock/recommendations?budget=1020")
        data = response.json()

        assert [(i["item_sku"], i["quantity"]) for i in data["items"]] == [
            ("FLT-405", 150), ("WDG-001", 4),
        ]
        assert abs(data["remaining_budget"] - 10.00) < 0.01

    def test_negative_budget_rejected(self, client):
        """Test a negative budget is a validation error."""
        response = client.get("/api/restock/recommendations?budget=-1")
        assert response.status_code == 422

    def test_missing_budget_rejected(self, client):
        """Test budget is required."""
        response = client.get("/api/restock/recommendations")
        assert response.status_code == 422


class TestRestockOrders:
    """Test suite for submitting and listing restock orders."""

    def test_no_restock_orders_initially(self, client):
        """Test the restock order list starts empty."""
        response = client.get("/api/restock/orders")
        assert response.status_code == 200
        assert response.json() == []

    def test_place_restock_order(self, client):
        """Test placing an order stores the recommended items for the budget."""
        recommendation = client.get("/api/restock/recommendations?budget=1000").json()

        response = client.post("/api/restock/orders", json={"budget": 1000})
        assert response.status_code == 201

        order = response.json()
        assert order["id"]
        assert order["order_number"].startswith("RST-")
        assert order["status"] == "Submitted"
        assert order["items"] == recommendation["items"]
        assert abs(order["total_cost"] - recommendation["total_cost"]) < 0.01

    def test_restock_order_lead_time_is_slowest_item(self, client):
        """Test order lead time is the longest item lead time."""
        response = client.post("/api/restock/orders", json={"budget": 100000})
        order = response.json()

        assert order["lead_time_days"] == max(i["lead_time_days"] for i in order["items"])

    def test_restock_order_expected_delivery_date(self, client):
        """Test expected delivery is the submit date plus lead time."""
        response = client.post("/api/restock/orders", json={"budget": 1000})
        order = response.json()

        created = date.fromisoformat(order["created_date"])
        expected = date.fromisoformat(order["expected_delivery_date"])
        assert expected - created == timedelta(days=order["lead_time_days"])

    def test_placed_orders_are_listed(self, client):
        """Test submitted orders appear in the restock order list in submit order."""
        first = client.post("/api/restock/orders", json={"budget": 1000}).json()
        second = client.post("/api/restock/orders", json={"budget": 5000}).json()

        listed = client.get("/api/restock/orders").json()
        assert [o["id"] for o in listed] == [first["id"], second["id"]]
        assert first["order_number"] != second["order_number"]

    def test_place_order_with_nothing_affordable_rejected(self, client):
        """Test an order is refused when the budget buys nothing."""
        response = client.post("/api/restock/orders", json={"budget": 0})
        assert response.status_code == 400
        assert "detail" in response.json()
        assert client.get("/api/restock/orders").json() == []

    def test_place_order_negative_budget_rejected(self, client):
        """Test a negative budget is a validation error on submit."""
        response = client.post("/api/restock/orders", json={"budget": -5})
        assert response.status_code == 422

    def test_restock_orders_do_not_change_customer_orders(self, client):
        """Test restock orders stay out of the customer orders list."""
        before = len(client.get("/api/orders").json())
        client.post("/api/restock/orders", json={"budget": 1000})
        after = len(client.get("/api/orders").json())
        assert after == before

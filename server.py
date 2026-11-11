#!/usr/bin/env python3
"""
Ember & Ash Roastery — Simple & Clean Python Backend
----------------------------------------------------
- Uses only the Python standard library (no Node.js, no pip dependencies).
- Serves original HTML & CSS static files directly.
- Provides clean REST API endpoints with persistent JSON storage (data.json).
"""

import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

PORT = 8000
DATA_FILE = os.path.join(os.path.dirname(__file__), "data.json")


def load_data():
    """Load roastery data from data.json."""
    if not os.path.exists(DATA_FILE):
        return {"beans": [], "orders": [], "cupping_event": {}, "newsletter_subscribers": []}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data):
    """Save data back to data.json."""
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


class RoasteryHandler(SimpleHTTPRequestHandler):
    """HTTP Request Handler for Ember & Ash Roastery."""

    def send_json(self, status_code, payload):
        """Helper to send JSON responses."""
        response_bytes = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response_bytes)

    def parse_body(self):
        """Read and parse incoming JSON request body."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length)
        return json.loads(body.decode("utf-8"))

    def do_GET(self):
        """Handle GET requests for static files and REST API."""
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        # REST API: Get all beans
        if path == "/api/beans":
            data = load_data()
            return self.send_json(200, {"success": True, "beans": data.get("beans", [])})

        # REST API: Get all orders
        elif path == "/api/orders":
            data = load_data()
            return self.send_json(200, {"success": True, "orders": data.get("orders", [])})

        # REST API: Get Saturday cupping details & remaining seats
        elif path == "/api/cupping":
            data = load_data()
            event = data.get("cupping_event", {})
            rsvps = event.get("rsvps", [])
            total_seats = event.get("total_seats", 12)
            taken_seats = sum(r.get("guests", 1) for r in rsvps)
            remaining = max(0, total_seats - taken_seats)
            return self.send_json(200, {
                "success": True,
                "event": event,
                "remaining_seats": remaining
            })

        # Serve static HTML/CSS files untouched
        return super().do_GET()

    def do_POST(self):
        """Handle POST requests for orders, cupping RSVPs, and newsletter."""
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        try:
            body = self.parse_body()
            data = load_data()

            # REST API: Place a fresh coffee order
            if path == "/api/orders":
                bean_id = body.get("bean_id")
                bean = next((b for b in data.get("beans", []) if b["id"] == bean_id), None)
                if not bean:
                    return self.send_json(400, {"success": False, "error": "Invalid bean_id"})

                qty = max(1, int(body.get("quantity", 1)))
                bag_size = body.get("bag_size", "250g")
                price_multiplier = 1.9 if bag_size == "500g" else (3.6 if bag_size == "1kg" else 1.0)
                total_amount = int(bean["price"] * qty * price_multiplier)

                order = {
                    "order_id": f"EA-{len(data.get('orders', [])) + 1001}",
                    "customer_name": body.get("customer_name", "Guest"),
                    "email": body.get("email", ""),
                    "phone": body.get("phone", ""),
                    "city": body.get("city", "Pune"),
                    "delivery_address": body.get("address", ""),
                    "delivery_date": body.get("delivery_date", ""),
                    "bean_name": bean["name"],
                    "grind": body.get("grind", "Whole Bean"),
                    "bag_size": bag_size,
                    "quantity": qty,
                    "notes": body.get("notes", ""),
                    "total_amount": total_amount,
                    "status": "Received"
                }
                data.setdefault("orders", []).append(order)
                save_data(data)
                return self.send_json(201, {"success": True, "order": order})

            # REST API: Cupping RSVP
            elif path == "/api/cupping/rsvp":
                event = data.setdefault("cupping_event", {})
                rsvps = event.setdefault("rsvps", [])
                total_seats = event.get("total_seats", 12)
                guests = max(1, int(body.get("guests", 1)))
                taken_seats = sum(r.get("guests", 1) for r in rsvps)

                if taken_seats + guests > total_seats:
                    return self.send_json(400, {"success": False, "error": "Not enough seats remaining for this session"})

                rsvp = {
                    "name": body.get("name", "Coffee Enthusiast"),
                    "email": body.get("email", ""),
                    "phone": body.get("phone", ""),
                    "city": body.get("city", "Pune"),
                    "session_date": body.get("session_date", "This Saturday, 10:00 AM"),
                    "guests": guests
                }
                rsvps.append(rsvp)
                save_data(data)
                return self.send_json(201, {"success": True, "rsvp": rsvp})

            # REST API: Newsletter Subscription
            elif path == "/api/newsletter":
                email = body.get("email", "").strip().lower()
                if not email or "@" not in email:
                    return self.send_json(400, {"success": False, "error": "Invalid email"})

                subs = data.setdefault("newsletter_subscribers", [])
                if email not in subs:
                    subs.append(email)
                    save_data(data)
                return self.send_json(200, {"success": True, "message": "Subscribed to Tuesday batch drops!"})

            else:
                return self.send_json(404, {"success": False, "error": "Endpoint not found"})

        except Exception as e:
            return self.send_json(500, {"success": False, "error": str(e)})


def main():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, RoasteryHandler)
    print(f"\n☕ Ember & Ash Roastery Python server running at: http://localhost:{PORT}")
    print(f"📄 Serving original index.html & style.css without modifications")
    print(f"📦 REST API available at: http://localhost:{PORT}/api/beans\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()


if __name__ == "__main__":
    main()

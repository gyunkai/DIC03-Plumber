from flask import Flask, request, jsonify

app = Flask(__name__)

# Simulated in-memory data storage
data = {
    1: {"name": "Item 1", "value": 100},
    2: {"name": "Item 2", "value": 200}
}
@app.route('/')
def index():
    return "Welcome to the Plumber API!"

# Get all items
@app.route('/items', methods=['GET'])
def get_items():
    return jsonify(data)

# Get a specific item by ID
@app.route('/items/<int:item_id>', methods=['GET'])
def get_item(item_id):
    item = data.get(item_id)
    if item:
        return jsonify(item)
    return jsonify({"error": "Item not found"}), 404

# Create a new item
@app.route('/items', methods=['POST'])
def create_item():
    new_id = max(data.keys()) + 1 if data else 1
    item_data = request.json
    data[new_id] = item_data
    return jsonify({"id": new_id, "data": item_data}), 201

# Update an item
@app.route('/items/<int:item_id>', methods=['PUT'])
def update_item(item_id):
    if item_id in data:
        data[item_id].update(request.json)
        return jsonify({"message": "Item updated", "data": data[item_id]})
    return jsonify({"error": "Item not found"}), 404

# Delete an item
@app.route('/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    if item_id in data:
        del data[item_id]
        return jsonify({"message": "Item deleted"})
    return jsonify({"error": "Item not found"}), 404

if __name__ == '__main__':
    app.run(debug=True)

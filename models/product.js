const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    imageUrl: { type: String, required: true },
    user: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    category: String
});

module.exports = mongoose.model('Product', productSchema);

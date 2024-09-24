const mongoose = require('mongoose');

const revenueSchema = new mongoose.Schema({
    user: { type: String, required: true },
    date: { type: String, required: true },  // YYYY-MM-DD
    totalRevenue: { type: Number, default: 0 }
});

module.exports = mongoose.model('Revenue', revenueSchema);

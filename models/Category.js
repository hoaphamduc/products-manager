const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    user: { type: String, required: true }  // Thêm trường username
});

module.exports = mongoose.model('Category', categorySchema);

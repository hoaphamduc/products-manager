const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    storeName: { type: String, required: true },
    field: { type: String },
    phone: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    country: { type: String, required: true },
    city: { type: String, required: true },
    referral: { type: String },
    initData: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Mã hóa mật khẩu trước khi lưu
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

module.exports = mongoose.model('User', userSchema);

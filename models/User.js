const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },  // Required
    password: { type: String, required: true },  // Required
    storeName: { type: String, required: true },  // Required
    storeAddress: { type: String },
    role: {
        type: String,
        enum: ['admin', 'shopOwner', 'staff'],
        default: 'staff'
    }, // Optional, with a default value of 'staff'
    phone: { type: String },  // Optional
    email: { type: String, required: true, unique: true },  // Required
    country: { type: String },  // Optional
    city: { type: String },  // Optional
    referral: { type: String },  // Optional
    qrCodeImageUrl: { type: String },  // Optional
    bankAccountNumber: { 
        type: String, 
        validate: {
            validator: function (v) {
                return !v || /^\d+$/.test(v); // Ensures that if provided, only digits are allowed
            },
            message: props => `${props.value} is not a valid bank account number!`
        }
    }, // Optional, validate only if present
    initData: { type: Boolean, default: false }  // Optional, with a default value
}, {
    timestamps: true
});

// Mã hóa mật khẩu trước khi lưu
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

module.exports = mongoose.model('User', userSchema);

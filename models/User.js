const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    storeName: { type: String, required: true },
    storeAddress: { type: String },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    phone: { type: String },
    email: { type: String, required: true, unique: true },
    country: { type: String },
    city: { type: String },
    qrCodeImageUrl: { type: String },
    bankAccountNumber: { 
        type: String, 
        validate: {
            validator: function (v) {
                return !v || /^\d+$/.test(v);
            },
            message: props => `${props.value} is not a valid bank account number!`
        }
    },
    bankName: { type: String },
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);

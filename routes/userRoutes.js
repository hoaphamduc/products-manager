const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const VerificationCode = require('../models/VerificationCode');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Middleware to prevent access to login and register routes if the user is already logged in
const redirectIfAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return res.redirect('/dashboard');  // Redirect nếu đã đăng nhập
    }
    next();  // Tiếp tục nếu chưa đăng nhập
};

// Route đăng nhập, áp dụng middleware để kiểm tra nếu đã đăng nhập
router.get('/login', redirectIfAuthenticated, (req, res) => {
    res.render('login');  // Hiển thị trang login
});

// Route đăng ký, áp dụng middleware để kiểm tra nếu đã đăng nhập
router.get('/register', redirectIfAuthenticated, (req, res) => {
    res.render('register');  // Hiển thị trang đăng ký nếu chưa đăng nhập
});

// Route đăng ký người dùng
router.post('/register', redirectIfAuthenticated, async (req, res) => {
    const {
        username,
        password,
        storeName,
        storeAddress = '',
        role = 'user',
        phone,
        email,
        country = 'Vietnam',
        city = '',
        qrCodeImageUrl = '',
        bankAccountNumber = '',
        bankName = '',
    } = req.body;

    try {
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Username hoặc Email đã tồn tại' });
        }

        const fullPhone = `+84${phone}`;

        const user = new User({
            username,
            password,
            storeName,
            storeAddress,
            role,
            phone: fullPhone,
            email,
            country,
            city,
            qrCodeImageUrl,
            bankAccountNumber,
            bankName,
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({
            message: 'Đăng ký thành công',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Route xử lý đăng nhập bằng username
router.post('/login', redirectIfAuthenticated, async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Tên đăng nhập không tồn tại' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mật khẩu không đúng' });
        }

        req.session.user = {
            id: user._id,
            username: user.username,
            email: user.email,
            storeName: user.storeName,
            storeAddress: user.storeAddress,
            role: user.role,
            phone: user.phone,
            country: user.country,
            city: user.city,
        };

        // Save session before redirecting
        req.session.save(() => {
            res.redirect('/dashboard');
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Route xử lý đăng xuất
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Đăng xuất thất bại' });
        }
        res.redirect('/');
    });
});

// Route lấy thông tin người dùng từ session
router.get('/user-info', (req, res) => {
    if (req.session.user) {
        return res.status(200).json({
            message: 'Lấy thông tin người dùng thành công',
            user: req.session.user
        });
    } else {
        return res.status(401).json({
            message: 'Người dùng chưa đăng nhập'
        });
    }
});

// Set up multer for file uploads (e.g., QR code image)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Specify the uploads directory
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

router.post('/update-info', upload.single('qrCodeImage'), async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Người dùng chưa đăng nhập' });
    }

    const userId = req.session.user.id;
    const { storeName, storeAddress, phone, email, city, country, bankAccountNumber, bankName } = req.body;

    try {
        const existingUserWithEmail = await User.findOne({ email, _id: { $ne: userId } });
        if (existingUserWithEmail) {
            return res.status(400).json({ message: 'Email đã tồn tại, vui lòng chọn email khác' });
        }

        const user = await User.findById(userId);

        let qrCodeImageUrl = user.qrCodeImageUrl;
        if (req.file) {
            if (user.qrCodeImageUrl) {
                const oldQrPath = path.join(__dirname, '../', user.qrCodeImageUrl);
                fs.unlink(oldQrPath, (err) => {
                    if (err) {
                        console.error('Failed to delete old QR code:', err);
                    }
                });
            }
            qrCodeImageUrl = `/uploads/${req.file.filename}`;
        }

        const updatedData = {
            storeName: storeName || user.storeName,
            storeAddress: storeAddress || user.storeAddress,
            phone: phone || user.phone,
            email: email || user.email,
            city: city || user.city,
            country: country || user.country,
            bankAccountNumber: bankAccountNumber || user.bankAccountNumber,
            bankName: bankName || user.bankName,
            qrCodeImageUrl: qrCodeImageUrl
        };

        const updatedUser = await User.findByIdAndUpdate(userId, updatedData, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        req.session.user = {
            id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            storeName: updatedUser.storeName,
            storeAddress: updatedUser.storeAddress,
            role: updatedUser.role,
            phone: updatedUser.phone,
            country: updatedUser.country,
            city: updatedUser.city,
            bankAccountNumber: updatedUser.bankAccountNumber,
            bankName: updatedUser.bankName,
            qrCodeImageUrl: updatedUser.qrCodeImageUrl
        };

        res.status(200).json({ message: 'Cập nhật thông tin thành công', user: updatedUser });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Route to display user information for updating
router.get('/update-info', async (req, res) => {
    // Check if the user is logged in (session has user data)
    if (!req.session.user) {
        return res.redirect('/login'); // Redirect to login if no user is in session
    }

    try {
        // Fetch the user data from the database using the user ID stored in the session
        const user = await User.findById(req.session.user.id);

        // If user not found, handle the case
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Render the view and pass the user object to the EJS template
        res.render('updateInfo', { user });
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).send('Error loading user info');
    }
});

router.post('/change-password', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Người dùng chưa đăng nhập' });
    }
    const userId = req.session.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;
    try {
        // Find the user in the database
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Người dùng không tồn tại' });
        }
        // Check if the current password matches
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
        }
        // Check if new passwords match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'Mật khẩu mới không khớp' });
        }
        // Hash the new password and save it
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();
        return res.status(200).json({ message: 'Đổi mật khẩu thành công' });
    } catch (error) {
        console.error('Error changing password:', error);
        return res.status(500).json({ message: 'Lỗi server' });
    }
});

// Route to render the change password form
router.get('/change-password', (req, res) => {
    if (!req.session.user) {
        // If the user is not logged in, redirect to the login page
        return res.redirect('/login');
    }
    // If the user is logged in, render the change password form
    res.render('changePassword', { title: 'Đổi mật khẩu' });
});

// Gửi mã xác thực email và lưu vào MongoDB
router.post('/send-verification-email', async (req, res) => {
    const { email } = req.body;
    try {
        // Kiểm tra xem email đã tồn tại trong hệ thống chưa
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email đã tồn tại, vui lòng chọn email khác.' });
        }
        // Tạo mã xác thực ngẫu nhiên (6 ký tự)
        const verificationCode = crypto.randomBytes(3).toString('hex').toUpperCase();
        const expiresAt = new Date(Date.now() + 5 * 60000); // Thời gian hết hạn là 5 phút
        // Lưu mã xác thực vào MongoDB (nếu tồn tại email đã có mã trước đó thì xóa)
        await VerificationCode.deleteOne({ email });
        const codeEntry = new VerificationCode({
            email,
            code: verificationCode,
            expiresAt
        });
        await codeEntry.save();
        // Cấu hình Nodemailer
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USER, // Tài khoản email của bạn
                pass: process.env.EMAIL_PASSWORD // Mật khẩu email hoặc App Password
            }
        });
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Mã xác thực tài khoản',
            text: `Mã xác thực của bạn là: ${verificationCode}. Mã này sẽ hết hạn sau 5 phút.`
        };
        // Gửi email
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Mã xác thực đã được gửi đến email của bạn.' });
    } catch (error) {
        console.error('Error sending verification email:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});
// Xác nhận mã xác thực
router.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;
    // Kiểm tra xem dữ liệu email và code có được cung cấp không
    if (!email || !code) {
        return res.status(400).json({ message: 'Thiếu email hoặc mã xác thực.' });
    }
    try {
        // Tìm mã xác thực theo email và mã
        const codeEntry = await VerificationCode.findOne({ email, code });
        if (!codeEntry) {
            return res.status(400).json({ message: 'Mã xác thực không đúng.' });
        }
        // Kiểm tra thời gian hết hạn
        if (codeEntry.expiresAt < new Date()) {
            return res.status(400).json({ message: 'Mã xác thực đã hết hạn.' });
        }
        // Mã hợp lệ, thực hiện các bước tiếp theo (ví dụ: đăng ký tài khoản)
        res.status(200).json({ message: 'Xác thực thành công.' });
        // Xóa mã xác thực sau khi xác nhận thành công
        await VerificationCode.deleteOne({ _id: codeEntry._id });
    } catch (error) {
        console.error('Error verifying code:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});
// API kiểm tra xem email và username đã tồn tại chưa
router.post('/check-user', async (req, res) => {
    const { username, email } = req.body;
    if (!username || !email) {
        return res.status(400).json({ message: 'Thiếu tên đăng nhập hoặc email' });
    }
    try {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(200).json({ exists: true });
        } else {
            return res.status(200).json({ exists: false });
        }
    } catch (error) {
        console.error('Error checking user:', error);
        return res.status(500).json({ message: 'Lỗi server' });
    }
});

// Các route khác vẫn hoạt động bình thường...
module.exports = router;

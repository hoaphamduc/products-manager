const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Route đăng ký người dùng
router.post('/register', async (req, res) => {
    const { username, password, storeName, field, phone, email, country, city, referral, initData } = req.body;

    try {
        // Kiểm tra xem email hoặc username đã tồn tại chưa
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Username hoặc Email đã tồn tại' });
        }

        // Tạo mới người dùng
        const user = new User({
            username,
            password,
            storeName,
            field,
            phone,
            email,
            country,
            city,
            referral,
            initData: initData === 'yes' ? true : false
        });

        // Lưu người dùng vào database
        await user.save();

        // Tạo JWT token cho người dùng (tùy chọn)
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });

        // Phản hồi thành công
        res.status(201).json({
            message: 'Đăng ký thành công',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Route xử lý đăng nhập bằng username
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Kiểm tra xem người dùng có tồn tại không dựa trên username
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Tên đăng nhập không tồn tại' });
        }

        // Kiểm tra mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mật khẩu không đúng' });
        }

        // Tạo session cho người dùng sau khi đăng nhập thành công
        req.session.user = {
            id: user._id,
            username: user.username,
            email: user.email
        };

        // Chuyển hướng đến trang /dashboard
        res.redirect('/dashboard');  // Chuyển hướng đến dashboard sau khi đăng nhập thành công
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
        res.redirect('/login');  // Sau khi đăng xuất, chuyển hướng về trang đăng nhập
    });
});

// Route lấy thông tin người dùng từ session
router.get('/user-info', (req, res) => {
    if (req.session.user) {
        // Nếu người dùng đã đăng nhập, trả về thông tin người dùng
        return res.status(200).json({
            message: 'Lấy thông tin người dùng thành công',
            user: req.session.user
        });
    } else {
        // Nếu chưa đăng nhập, trả về lỗi
        return res.status(401).json({
            message: 'Người dùng chưa đăng nhập'
        });
    }
});


module.exports = router;

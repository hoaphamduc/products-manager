const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

// Route đăng ký người dùng
router.post('/register', async (req, res) => {
    const { 
        username, 
        password, 
        storeName, 
        storeAddress = '', 
        role = 'staff', // Default role is 'staff' if not provided
        phone = '', // Optional field, initialized to an empty string if not provided
        email, 
        country = '', // Optional field
        city = '', // Optional field
        referral = '', // Optional field
        qrCodeImageUrl = '', // Optional field for QR code image URL
        bankAccountNumber = '', // Optional field for bank account number
        initData = false // Optional, default is false
    } = req.body;

    try {
        // Kiểm tra xem email hoặc username đã tồn tại chưa
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Username hoặc Email đã tồn tại' });
        }

        // Tạo mới người dùng với tất cả các trường
        const user = new User({
            username,
            password,
            storeName,
            storeAddress,
            role,
            phone,
            email,
            country,
            city,
            referral,
            qrCodeImageUrl,
            bankAccountNumber,
            initData: initData === 'yes' ? true : false // Convert string 'yes' to true, else false
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

        // Tạo session cho người dùng sau khi đăng nhập thành công, lưu tất cả các thông tin cần thiết
        req.session.user = {
            id: user._id,
            username: user.username,
            email: user.email,
            storeName: user.storeName,
            storeAddress: user.storeAddress,
            role: user.role,
            phone: user.phone,
            country: user.country,
            city: user.city
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
    const { storeName, storeAddress, phone, email, city, country, role, bankAccountNumber } = req.body;

    try {
        // Log the request body and file to ensure it's receiving the correct fields and file
        console.log('Request body:', req.body);
        console.log('File:', req.file);

        const existingUserWithEmail = await User.findOne({ email, _id: { $ne: userId } });
        if (existingUserWithEmail) {
            return res.status(400).json({ message: 'Email đã tồn tại, vui lòng chọn email khác' });
        }

        // Update the user's QR code image if a new one is uploaded
        let qrCodeImageUrl = req.session.user.qrCodeImageUrl || ''; // Keep the old QR image if no new one is uploaded
        if (req.file) {
            qrCodeImageUrl = `/uploads/${req.file.filename}`;
        }

        // Prepare the updated data
        const updatedData = {
            storeName: storeName || '',
            storeAddress: storeAddress || '',
            phone: phone || '',
            email: email || '',
            city: city || '',
            country: country || '',
            role: role || 'staff',
            bankAccountNumber: bankAccountNumber || '',
            qrCodeImageUrl: qrCodeImageUrl
        };

        // Update the user data in the database
        const updatedUser = await User.findByIdAndUpdate(userId, updatedData, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update the session with the new user data
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

module.exports = router;

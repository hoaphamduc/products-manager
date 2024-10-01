const express = require('express');
const dotenv = require('dotenv');
const session = require('express-session');
const path = require('path');
const connectDB = require('./config/db');
const layoutMiddleware = require('./middlewares/layout');
const MongoStore = require('connect-mongo');

// Cấu hình dotenv để lấy các biến môi trường
dotenv.config();

// Kết nối MongoDB
connectDB();

// Khởi tạo ứng dụng Express
const app = express();

// Layout middleware
app.use(layoutMiddleware);

// Middleware để parse dữ liệu từ form (body-parser)
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Dùng để xử lý JSON

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// Cấu hình session
app.use(session({
    secret: 'meobeosieudeptrai@2024',  // Khóa bí mật
    resave: false,  // Không lưu lại session nếu không có sự thay đổi
    saveUninitialized: false,  // Không lưu session mới chưa được khởi tạo
    cookie: {
        maxAge: 1000 * 60 * 60,  // Thời gian sống của cookie (1 giờ)
        httpOnly: true,  // Chỉ truy cập được qua HTTP
    },
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,  // URL kết nối MongoDB
        collectionName: 'sessions',  // Tên collection để lưu session
        ttl: 60 * 60  // Thời gian sống của session trong MongoDB (1 giờ)
    })
}));

// Import route
const userRoutes = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboard');

// Cấu hình view engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Cấu hình thư mục tĩnh cho CSS, JS, hình ảnh
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Định nghĩa route
app.use('/', userRoutes);
app.use('/', dashboardRoutes);

// Trang chủ
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('index', { title: 'Trang chủ' });
});

// Cấu hình port
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));

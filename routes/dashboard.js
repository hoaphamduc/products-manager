const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const upload = require('../config/multer');
const fs = require('fs');
const path = require('path');
const Category = require('../models/Category');
const Revenue = require('../models/Revenue');

// Middleware to check if the user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next(); // User is authenticated, proceed
    }
    return res.redirect('/login'); // Redirect to login if not authenticated
};

// Route for the dashboard, only accessible by logged-in users
router.get('/dashboard', isAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

// Route for sales page
router.get('/sales', isAuthenticated, async (req, res) => {
    try {
        const username = req.session.user.username;
        const user = req.session.user;

        const selectedCategory = req.query.category || 'Tất cả';
        const categories = await Category.find({ user: username });

        let products;
        if (selectedCategory === 'Tất cả') {
            products = await Product.find({ user: username });
        } else {
            products = await Product.find({ user: username, category: selectedCategory });
        }

        res.render('sales', { products, categories, selectedCategory, user });
    } catch (error) {
        console.error(error);
        res.status(500).send('Lỗi khi lấy sản phẩm');
    }
});

// Route to handle sales checkout
router.post('/sales/checkout', isAuthenticated, async (req, res) => {
    const { cart } = req.body;
    const username = req.session.user.username;

    if (!Array.isArray(cart)) {
        return res.status(400).send('Giỏ hàng không hợp lệ');
    }

    try {
        for (let item of cart) {
            const product = await Product.findById(item.id);
            if (!product) {
                return res.status(400).send(`Sản phẩm với ID ${item.id} không tồn tại`);
            }

            if (product.stock >= item.quantity) {
                await Product.findByIdAndUpdate(item.id, { $inc: { stock: -item.quantity } });
                await Product.findByIdAndUpdate(item.id, { $inc: { sold: item.quantity } });
            } else {
                return res.status(400).send(`Không đủ hàng trong kho cho sản phẩm ${product.name}`);
            }
        }

        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const today = new Date();
        await Revenue.updateOne(
            { user: username, date: today.toISOString().split('T')[0] },
            { $inc: { totalRevenue: total } },
            { upsert: true }
        );

        res.status(200).send('Thanh toán thành công');
    } catch (error) {
        console.error('Lỗi khi thanh toán:', error);
        res.status(500).send('Lỗi khi thanh toán');
    }
});

// Route to get sales report
router.get('/sales/report', isAuthenticated, async (req, res) => {
    const username = req.session.user.username;

    try {
        const bestSellingProducts = await Product.find({ user: username, sold: { $gt: 0 } }).sort({ sold: -1 }).limit(10);
        const lowStockProducts = await Product.find({ user: username, stock: { $lt: 10 } });
        const dailyRevenue = await Revenue.find({ user: username }).sort({ date: -1 }).limit(30);

        const monthlyRevenue = await Revenue.aggregate([
            { $match: { user: username } },
            { $group: { _id: { $substr: ['$date', 0, 7] }, total: { $sum: '$totalRevenue' } } },
            { $sort: { _id: -1 } }
        ]);

        const yearlyRevenue = await Revenue.aggregate([
            { $match: { user: username } },
            { $group: { _id: { $substr: ['$date', 0, 4] }, total: { $sum: '$totalRevenue' } } },
            { $sort: { _id: -1 } }
        ]);

        res.render('report', {
            bestSellingProducts,
            lowStockProducts,
            dailyRevenue,
            monthlyRevenue,
            yearlyRevenue
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Lỗi khi lấy thống kê');
    }
});

// Route for managing products
router.get('/products', isAuthenticated, async (req, res) => {
    try {
        const username = req.session.user.username;
        const categories = await Category.find({ user: username });
        const products = await Product.find({ user: username });

        res.render('products', { title: 'Quản lý kho', products, categories });
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi server');
    }
});

// Route to add new product
router.post('/products/new', isAuthenticated, upload.single('image'), async (req, res) => {
    const { name, description, price, stock, category } = req.body;
    let imageUrl = '/uploads/default.png';

    if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
    }

    try {
        const username = req.session.user.username;

        if (!username) {
            return res.status(400).send('User chưa đăng nhập');
        }

        const newProduct = new Product({
            name,
            description,
            price,
            stock,
            imageUrl,
            category,
            user: username
        });

        await newProduct.save();
        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi thêm sản phẩm');
    }
});

// Route to update product stock
router.post('/products/:id/add-stock', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { stock } = req.body;

    try {
        await Product.findByIdAndUpdate(id, { $inc: { stock: stock } });
        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi thêm vào kho');
    }
});

// Route to delete product
router.post('/products/:id/delete', isAuthenticated, async (req, res) => {
    const { id } = req.params;

    try {
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).send('Sản phẩm không tồn tại');
        }

        const imagePath = path.join(__dirname, '..', product.imageUrl);

        await Product.deleteOne({ _id: id });

        fs.unlink(imagePath, (err) => {
            if (err) {
                console.error('Lỗi khi xóa file:', err);
                return res.status(500).send('Lỗi khi xóa ảnh');
            }

            res.redirect('/products');
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi xóa sản phẩm');
    }
});

// Route to display product edit form
router.get('/products/:id/edit', isAuthenticated, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        const categories = await Category.find({ user: req.session.user.username });

        if (!product) {
            return res.status(404).send('Sản phẩm không tồn tại');
        }

        res.render('editProduct', { title: 'Sửa sản phẩm', product, categories });
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi lấy sản phẩm');
    }
});

// Route to update product details
router.post('/products/:id/edit', isAuthenticated, upload.single('image'), async (req, res) => {
    const { name, description, price, stock, category } = req.body;
    let updatedProduct = { name, description, price, stock, category };

    if (req.file) {
        updatedProduct.imageUrl = `/uploads/${req.file.filename}`;
    }

    try {
        await Product.findByIdAndUpdate(req.params.id, updatedProduct);
        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi cập nhật sản phẩm');
    }
});

// Route to add new category
router.post('/categories/new', isAuthenticated, async (req, res) => {
    const { category } = req.body;
    const username = req.session.user.username;

    if (!category) {
        return res.status(400).send('Tên danh mục không hợp lệ');
    }

    try {
        const existingCategory = await Category.findOne({ name: category, user: username });
        if (existingCategory) {
            return res.status(400).send('Danh mục đã tồn tại');
        }

        const newCategory = new Category({
            name: category,
            user: username
        });

        await newCategory.save();
        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi thêm danh mục');
    }
});

module.exports = router;

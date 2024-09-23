const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const upload = require('../config/multer');
const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../middlewares/auth');

// Route dashboard, chỉ dành cho người dùng đã đăng nhập
router.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.renderWithLayout('dashboard', { user: req.session.user });
});

// Route bán hàng
router.get('/sales', async (req, res) => {
    try {
        const products = await Product.find({});
        const categories = ['Tất cả', 'Mi - Cháo - Phở', 'Bia - Kẹo', 'Dầu gội - Sữa tắm', 'Văn phòng phẩm', 'Beverage', 'Food Preparation'];
        res.render('sale', { products, categories });
    } catch (error) {
        console.error(error);
        res.status(500).send('Lỗi khi lấy sản phẩm');
    }
});

router.get('/partners', (req, res) => {
    res.renderWithLayout('partners', { title: 'Đối tác' });
});

// GET: Trang quản lý sản phẩm (chỉ hiển thị sản phẩm của người dùng hiện tại)
// Giả sử bạn có danh sách các danh mục
const categories = ['Mi - Cháo - Phở', 'Bia - Kẹo', 'Dầu gội - Sữa tắm', 'Văn phòng phẩm', 'Beverage', 'Food Preparation'];

// Route cho trang quản lý sản phẩm
router.get('/products', isAuthenticated, async (req, res) => {
    try {
        // Lấy danh mục của user từ database
        const username = req.session.user.username;
        const categories = await Category.find({ user: username });

        // Lấy sản phẩm của user nếu cần (giả sử user cũng liên quan tới sản phẩm)
        const products = await Product.find({ user: username });

        res.render('products', { title: 'Quản lý kho', products, categories });
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi server');
    }
});
// Route thêm sản phẩm mới
router.post('/products/new', isAuthenticated, upload.single('image'), async (req, res) => {
    const { name, description, price, stock, category } = req.body;
    let imageUrl = '/uploads/default.png'; // Nếu không có ảnh

    if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
    }

    try {
        // Lấy username từ session để lưu vào sản phẩm
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
            user: username  // Lưu username của người dùng
        });

        await newProduct.save();
        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi thêm sản phẩm');
    }
});


// POST: Cập nhật số lượng kho của sản phẩm
router.post('/products/:id/add-stock', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { stock } = req.body;
    try {
        // Tìm sản phẩm theo ID và cập nhật số lượng trong kho
        await Product.findByIdAndUpdate(id, { $inc: { stock: stock } });
        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi thêm vào kho');
    }
});

// DELETE: Xóa sản phẩm và xóa ảnh khỏi máy chủ
router.post('/products/:id/delete', isAuthenticated, async (req, res) => {
    const { id } = req.params;

    try {
        // Tìm sản phẩm theo ID
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).send('Sản phẩm không tồn tại');
        }

        // Lấy đường dẫn hình ảnh của sản phẩm
        const imagePath = path.join(__dirname, '..', product.imageUrl);

        // Xóa sản phẩm khỏi DB
        await Product.deleteOne({ _id: id });  // Sử dụng deleteOne để xóa sản phẩm

        // Xóa file ảnh khỏi máy chủ
        fs.unlink(imagePath, (err) => {
            if (err) {
                console.error('Lỗi khi xóa file:', err);
                return res.status(500).send('Lỗi khi xóa ảnh');
            }

            // Sau khi xóa thành công
            res.redirect('/products');
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi xóa sản phẩm');
    }
});

// Route hiển thị form sửa sản phẩm
router.get('/products/:id/edit', isAuthenticated, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        const categories = await Category.find({ user: req.session.user.username }); // Lấy danh mục của user
        if (!product) {
            return res.status(404).send('Sản phẩm không tồn tại');
        }
        res.render('editProduct', { title: 'Sửa sản phẩm', product, categories });
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi khi lấy sản phẩm');
    }
});

// Route xử lý cập nhật sản phẩm
router.post('/products/:id/edit', isAuthenticated, upload.single('image'), async (req, res) => {
    const { name, description, price, stock, category } = req.body;
    let updatedProduct = { name, description, price, stock, category };

    if (req.file) {
        // Cập nhật hình ảnh nếu có hình mới
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

const Category = require('../models/Category');

// Route hiển thị form thêm danh mục
router.get('/categories/new', isAuthenticated, (req, res) => {
    res.render('newCategory', { title: 'Thêm danh mục mới' });
});

// Route xử lý thêm danh mục mới
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
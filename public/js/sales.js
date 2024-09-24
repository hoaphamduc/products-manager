// Lọc sản phẩm theo tên
$('#search-input').on('keyup', function () {
    var searchText = $(this).val().toLowerCase();
    $('.product-item').each(function () {
        var productName = $(this).find('.card-title').text().toLowerCase();
        if (productName.indexOf(searchText) !== -1) {
            $(this).show();
        } else {
            $(this).hide();
        }
    });
});

// Giỏ hàng
let cart = [];

$('.add-to-cart').on('click', function () {
    const productId = $(this).data('id');
    const productName = $(this).closest('.card').find('.card-title').text();
    const productPrice = parseInt($(this).closest('.card').find('.card-text').text().replace('đ', ''));
    const productStock = parseInt($(this).closest('.card').find('.card-text').last().text().replace('Số lượng còn: ', ''));

    if (productStock === 0) {
        alert('Sản phẩm này đã hết hàng');
        return;
    }

    const foundProduct = cart.find(item => item.id === productId);
    if (foundProduct) {
        if (foundProduct.quantity < productStock) {
            foundProduct.quantity++;
        } else {
            alert('Số lượng trong giỏ đã đạt giới hạn trong kho!');
        }
    } else {
        cart.push({ id: productId, name: productName, price: productPrice, quantity: 1, stock: productStock });
    }

    renderCart();
    checkStockLimits();
});

// Hàm hiển thị giỏ hàng
function renderCart() {
    let subtotal = 0;
    $('#cart-items').empty();
    cart.forEach(item => {
        $('#cart-items').append(`
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <button class="btn btn-danger btn-sm remove-item" data-id="${item.id}">Xóa</button>
                ${item.name} 
                <button class="btn btn-sm btn-outline-secondary decrease-quantity" data-id="${item.id}">-</button>
                <span class="badge bg-primary rounded-pill">${item.quantity} x ${item.price}đ</span>
                <button class="btn btn-sm btn-outline-secondary increase-quantity" data-id="${item.id}">+</button>
            </li>
        `);
        subtotal += item.price * item.quantity;
    });

    $('#subtotal').text(subtotal + 'đ');
    const tax = subtotal * 0.0;  // Thuế 0%
    $('#tax').text(tax + 'đ');
    const total = subtotal + tax;
    $('#total').text(total + 'đ');
}

// Kiểm tra giới hạn kho và disable các nút "Tăng số lượng" hoặc "Thêm vào giỏ"
function checkStockLimits() {
    $('.product-item').each(function () {
        const productId = $(this).find('.add-to-cart').data('id');
        const productStock = parseInt($(this).find('.card-text').last().text().replace('Số lượng còn: ', ''));
        const foundProduct = cart.find(item => item.id === productId);

        if (foundProduct && foundProduct.quantity >= productStock) {
            $(this).find('.add-to-cart').prop('disabled', true).text('Đã đạt giới hạn');
        } else {
            $(this).find('.add-to-cart').prop('disabled', false).text('Thêm vào giỏ');
        }
    });

    cart.forEach(item => {
        const increaseBtn = $(`.increase-quantity[data-id="${item.id}"]`);
        if (item.quantity >= item.stock) {
            increaseBtn.prop('disabled', true);
        } else {
            increaseBtn.prop('disabled', false);
        }
    });
}

// Sự kiện tăng số lượng sản phẩm trong giỏ
$(document).on('click', '.increase-quantity', function () {
    const productId = $(this).data('id');
    const foundProduct = cart.find(item => item.id === productId);

    if (foundProduct.quantity < foundProduct.stock) {
        foundProduct.quantity++;
    } else {
        alert('Số lượng trong giỏ đã đạt giới hạn trong kho!');
    }

    renderCart();
    checkStockLimits();
});

// Sự kiện giảm số lượng sản phẩm trong giỏ
$(document).on('click', '.decrease-quantity', function () {
    const productId = $(this).data('id');
    const foundProduct = cart.find(item => item.id === productId);

    if (foundProduct.quantity > 1) {
        foundProduct.quantity--;
    } else {
        // Nếu số lượng = 1 và người dùng nhấn giảm, xóa sản phẩm khỏi giỏ
        cart = cart.filter(item => item.id !== productId);
    }

    renderCart();
    checkStockLimits();
});

// Sự kiện xóa sản phẩm khỏi giỏ
$(document).on('click', '.remove-item', function () {
    const productId = $(this).data('id');
    cart = cart.filter(item => item.id !== productId);
    renderCart();
    checkStockLimits();
});

// Sự kiện khi nhấn "Thanh toán"
$('#checkout-btn').on('click', function () {
    console.log('Cart before sending:', cart);  // Ghi log để kiểm tra cart
    if (cart.length === 0) return alert('Giỏ hàng trống!');

    if (confirm('Xác nhận thanh toán?')) {
        $.ajax({
            url: '/sales/checkout',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ cart }),
            success: function (response) {
                alert('Thanh toán thành công!');
                window.location.reload();
            },
            error: function (xhr, status, error) {
                console.error('Lỗi khi thanh toán:', error);
                alert('Lỗi khi thanh toán');
            }
        });
    }
});
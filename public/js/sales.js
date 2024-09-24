let cart = [];

$('.add-to-cart').on('click', function () {
    const productId = $(this).data('id');
    const productStock = parseInt($(this).closest('.card').find('.stock').text());

    if (productStock === 0) {
        alert('Sản phẩm này đã hết hàng');
        return;
    }

    const productName = $(this).closest('.card').find('.card-title').text();
    const productPrice = parseInt($(this).closest('.card').find('.card-text').text().replace('đ', ''));

    const foundProduct = cart.find(item => item.id === productId);
    if (foundProduct) {
        foundProduct.quantity++;
    } else {
        cart.push({ id: productId, name: productName, price: productPrice, quantity: 1 });
    }

    renderCart();
});


function renderCart() {
    let subtotal = 0;
    $('#cart-items').empty();
    cart.forEach(item => {
        $('#cart-items').append(`
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${item.name}
                <span class="badge bg-primary rounded-pill">${item.quantity} x ${item.price}đ</span>
            </li>
        `);
        subtotal += item.price * item.quantity;
    });

    $('#subtotal').text(subtotal + 'đ');
    const tax = subtotal * 0.1;
    $('#tax').text(tax + 'đ');
    const total = subtotal + tax;
    $('#total').text(total + 'đ');
}

$('.btn-success').on('click', function () {
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

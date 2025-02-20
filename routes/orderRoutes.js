const express = require('express');
const router = express.Router();
const db = require('../database');

// List all orders
router.get('/', (req, res) => {
    const sql = `
        SELECT o.*, s.supplier_name 
        FROM orders o
        LEFT JOIN suppliers s ON o.supplier_id = s.supplier_id
        ORDER BY o.order_date DESC
    `;

    db.all(sql, [], (err, orders) => {
        if (err) {
            console.error(err);
            req.flash('error_msg', 'Error retrieving orders');
            return res.redirect('/');
        }
        res.render('partials/layout', {
            title: 'Purchase Orders',
            body: '../orders/index',
            orders
        });
    });
});

// Show new order form
router.get('/new', (req, res) => {
    db.all('SELECT supplier_id, supplier_name FROM suppliers', [], (err, suppliers) => {
        if (err) {
            console.error(err);
            req.flash('error_msg', 'Error loading suppliers');
            return res.redirect('/orders');
        }
        
        res.render('partials/layout', {
            title: 'New Order',
            body: '../orders/new',
            suppliers
        });
    });
});

// Create new order
router.post('/', (req, res) => {
    const { supplier_id, order_status, items } = req.body;
    
    if (!supplier_id || !order_status || !items || items.length === 0) {
        req.flash('error_msg', 'Missing required fields');
        return res.redirect('/orders/new');
    }

    // Calculate total
    const total = items.reduce((sum, item) => {
        return sum + (parseFloat(item.price) * parseInt(item.quantity));
    }, 0);

    db.serialize(() => {
        db.run(`INSERT INTO orders (
            supplier_id,
            order_status,
            order_total,
            order_date
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`, 
        [supplier_id, order_status, total], function(err) {
            if (err) {
                console.error(err);
                req.flash('error_msg', 'Error creating order');
                return res.redirect('/orders/new');
            }

            const orderId = this.lastID;
            const stmt = db.prepare(`INSERT INTO order_details (
                order_id,
                description,
                price,
                quantity,
                remark
            ) VALUES (?, ?, ?, ?, ?)`);

            items.forEach(item => {
                stmt.run([
                    orderId,
                    item.description,
                    parseFloat(item.price),
                    parseInt(item.quantity),
                    item.remark
                ]);
            });

            stmt.finalize(err => {
                if (err) {
                    console.error(err);
                    req.flash('error_msg', 'Error saving order items');
                    return res.redirect('/orders/new');
                }
                
                req.flash('success_msg', 'Order created successfully');
                res.redirect(`/orders/${orderId}`);
            });
        });
    });
});

// Show single order
router.get('/:id', (req, res) => {
    const orderId = parseInt(req.params.id);

    db.get(`
        SELECT o.*, s.supplier_name 
        FROM orders o
        LEFT JOIN suppliers s ON o.supplier_id = s.supplier_id
        WHERE o.order_id = ?`, 
    [orderId], (err, order) => {
        if (err || !order) {
            req.flash('error_msg', 'Order not found');
            return res.redirect('/orders');
        }

        db.all('SELECT * FROM order_details WHERE order_id = ?', [orderId], (err, details) => {
            res.render('partials/layout', {
                title: `Order #${order.order_id}`,
                body: '../orders/show',
                order,
                details
            });
        });
    });
});

module.exports = router;
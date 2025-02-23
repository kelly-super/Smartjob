const express = require('express');
const router = express.Router();
const db = require('../database');

// List all orders
router.get('/', async (req, res) => {
    console.log("get all orders");
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // items per page
        const offset = (page - 1) * limit;
        
        // Build the WHERE clause based on filters
        let whereClause = [];
        let params = [];
        
        if (req.query.supplier) {
            whereClause.push('o.supplier_id = ?');
            params.push(req.query.supplier);
        }
        
        if (req.query.dateFrom) {
            whereClause.push('o.order_date >= ?');
            params.push(req.query.dateFrom);
        }
        
        if (req.query.dateTo) {
            whereClause.push('o.order_date <= ?');
            params.push(req.query.dateTo);
        }
        
        const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
        
         console.log("whereSQL ="+whereSQL);
        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM orders o 
            ${whereSQL}
        `;
        
        // Get filtered orders
        const orderQuery = `
            SELECT o.*, s.supplier_name 
            FROM orders o 
            LEFT JOIN suppliers s ON o.supplier_id = s.supplier_id 
            ${whereSQL}
            ORDER BY o.order_date DESC 
            LIMIT ? OFFSET ?
        `;
        
        // Execute queries
        const [totalCount, suppliers, orders] = await Promise.all([
            new Promise((resolve, reject) => {
                db.get(countQuery, params, (err, result) => {
                    if (err) reject(err);
                    else resolve(result.total);
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT supplier_id, supplier_name FROM suppliers', [], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            }),
            new Promise((resolve, reject) => {
                db.all(orderQuery, [...params, limit, offset], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            })
        ]);

        // Calculate pagination values
        const totalPages = Math.ceil(totalCount / limit);
        
        // Build search params for pagination links
        const searchParams = new URLSearchParams();
        if (req.query.supplier) searchParams.append('supplier', req.query.supplier);
        if (req.query.dateFrom) searchParams.append('dateFrom', req.query.dateFrom);
        if (req.query.dateTo) searchParams.append('dateTo', req.query.dateTo);
        
        res.render('partials/layout', {
            title: 'Orders',
            body: '../orders/index',
            orders: orders,
            suppliers: suppliers,
            currentPage: page,
            totalPages: totalPages,
            query: req.query,
            searchParams: searchParams.toString() ? '&' + searchParams.toString() : ''
        });
    } catch (err) {
        console.error('Error:', err);
        req.flash('error_msg', 'Error loading orders');
        res.redirect('/');
    }
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
    console.log("Creating new order:", req.body);
    
    const { 
        supplier_id, 
        order_status,
        item_code,
        description,
        unit_price,
        quantity,
        remark 
    } = req.body;
    
    if (!supplier_id || !order_status) {
        req.flash('error_msg', 'Missing required fields');
        return res.redirect('/orders/new');
    }

    // Convert form arrays into array of item objects
    const items = [];
    if (Array.isArray(item_code)) {
        for (let i = 0; i < item_code.length; i++) {
            items.push({
                item_code: item_code[i],
                description: description[i],
                unit_price: parseFloat(unit_price[i]) || 0,
                quantity: parseInt(quantity[i]) || 0,
                remark: remark ? remark[i] : ''
            });
        }
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => {
        return sum + (item.unit_price * item.quantity);
    }, 0);
    
    const gst = subtotal * 0.15;
    const total = subtotal + gst;

    db.serialize(() => {
        db.run(`INSERT INTO orders (
            supplier_id,
            order_status,
            order_subtotal,
            order_gst,
            order_amount,
            order_date
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, 
        [supplier_id, order_status, subtotal, gst, total], function(err) {
            if (err) {
                console.error('Error creating order:', err);
                req.flash('error_msg', 'Error creating order');
                return res.redirect('/orders/new');
            }

            const orderId = this.lastID;
            const stmt = db.prepare(`INSERT INTO order_details (
                order_id,
                item_code,
                description,
                unit_price,
                quantity,
                remark
            ) VALUES (?, ?, ?, ?, ?, ?)`);

            const insertPromises = items.map(item => {
                return new Promise((resolve, reject) => {
                    stmt.run([
                        orderId,
                        item.item_code,
                        item.description,
                        item.unit_price,
                        item.quantity,
                        item.remark
                    ], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            Promise.all(insertPromises)
                .then(() => {
                    stmt.finalize();
                    req.flash('success_msg', 'Order created successfully');
                    res.redirect(`/orders/${orderId}`);
                })
                .catch(err => {
                    console.error('Error saving order items:', err);
                    stmt.finalize();
                    req.flash('error_msg', 'Error saving order items');
                    res.redirect('/orders/new');
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
const express = require('express');
const router = express.Router();
const db = require('../database');

// List all suppliers
router.get('/', (req, res) => {
    const search = req.query.search || '';
    const sql = `
        SELECT * FROM suppliers 
        WHERE supplier_name LIKE ? 
        OR supplier_contact_name LIKE ?
        ORDER BY supplier_name
    `;

    db.all(sql, [`%${search}%`, `%${search}%`], (err, suppliers) => {
        if (err) {
            console.error(err);
            req.flash('error_msg', 'Error retrieving suppliers');
            return res.redirect('/');
        }
        res.render('partials/layout', {
            title: 'Suppliers',
            body: '../suppliers/index',
            suppliers,
            search
        });
    });
});

// Show new supplier form
router.get('/new', (req, res) => {
    res.render('partials/layout', {
        title: 'New Supplier',
        body: '../suppliers/new'
    });
});

// Create new supplier
router.post('/', (req, res) => {
    const { 
        supplier_name,
        supplier_contact_name,
        supplier_contact_phone,
        supplier_email,
        supplier_website,
        supplier_address,
        supplier_postaddress
    } = req.body;

    if (!supplier_name) {
        req.flash('error_msg', 'Supplier name is required');
        return res.redirect('/suppliers/new');
    }

    const sql = `
        INSERT INTO suppliers (
            supplier_name,
            supplier_contact_name,
            supplier_contact_phone,
            supplier_email,
            supplier_website,
            supplier_address,
            supplier_postaddress,
            update_date
        ) VALUES (?, ?, ?, ?, ?, ?,?, CURRENT_TIMESTAMP)
    `;

    db.run(sql, [
        supplier_name,
        supplier_contact_name,
        supplier_contact_phone,
        supplier_email,
        supplier_website,
        supplier_address,
        supplier_postaddress
    ], function(err) {
        if (err) {
            console.error(err);
            req.flash('error_msg', 'Error creating supplier');
            return res.redirect('/suppliers/new');
        }
        
        req.flash('success_msg', 'Supplier created successfully');
        res.redirect(`/suppliers/${this.lastID}`);
    });
});

// Show single supplier
router.get('/:id', (req, res) => {
    const supplierId = parseInt(req.params.id);
    
    if (isNaN(supplierId)) {
        req.flash('error_msg', 'Invalid supplier ID');
        return res.redirect('/suppliers');
    }

    db.get('SELECT * FROM suppliers WHERE supplier_id = ?', [supplierId], (err, supplier) => {
        if (err || !supplier) {
            req.flash('error_msg', 'Supplier not found');
            return res.redirect('/suppliers');
        }
        
        res.render('partials/layout', {
            title: supplier.supplier_name,
            body: '../suppliers/show',
            supplier
        });
    });
});

// Show edit form
router.get('/:id/edit', (req, res) => {
    const supplierId = parseInt(req.params.id);

    db.get('SELECT * FROM suppliers WHERE supplier_id = ?', [supplierId], (err, supplier) => {
        if (err || !supplier) {
            req.flash('error_msg', 'Supplier not found');
            return res.redirect('/suppliers');
        }
        
        res.render('partials/layout', {
            title: 'Edit ' + supplier.supplier_name,
            body: '../suppliers/edit',
            supplier
        });
    });
});

// Update supplier
router.post('/:id', (req, res) => {
    const supplierId = parseInt(req.params.id);
    const { 
        supplier_name,
        supplier_contact_name,
        supplier_contact_phone,
        supplier_email,
        supplier_website,
        supplier_address,
        supplier_postaddress,
        status
    } = req.body;

    const sql = `
        UPDATE suppliers SET
            supplier_name = ?,
            supplier_contact_name = ?,
            supplier_contact_phone =?,
            supplier_email = ?,
            supplier_website = ?,
            supplier_address = ?,
            supplier_postaddress = ?,
            status = ?,
            update_date = CURRENT_TIMESTAMP
        WHERE supplier_id = ?
    `;

    db.run(sql, [
        supplier_name,
        supplier_contact_name,
        supplier_contact_phone,
        supplier_email,
        supplier_website,
        supplier_address,
        supplier_postaddress,
        status,
        supplierId
    ], (err) => {
        if (err) {
            console.error(err);
            req.flash('error_msg', 'Error updating supplier');
            return res.redirect(`/suppliers/${supplierId}/edit`);
        }
        
        req.flash('success_msg', 'Supplier updated successfully');
        res.redirect(`/suppliers/${supplierId}`);
    });
});

module.exports = router;
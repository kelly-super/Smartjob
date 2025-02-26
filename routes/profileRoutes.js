const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');

// Get company profile
router.get('/', async (req, res) => {
    try {
        const profile = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM companies LIMIT 1', [], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        res.render('partials/layout', {
            title: 'Company Profile',
            body: '../profiles/index',
            profile: profile || {}
        });
    } catch (err) {
        console.error('Error loading profile:', err);
        req.flash('error_msg', 'Error loading profile');
        res.redirect('/');
    }
});

// Update company profile
router.post('/update', async (req, res) => {
    const {
        company_name,
        company_address,
        company_postcode,
        company_phone,
        company_email,
        company_website,
        company_registration,
        company_gst,
        bank_name,
        bank_account,
        quote_notes,
        invoice_notes
    } = req.body;

    try {
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT OR REPLACE INTO companies (
                    company_name,
                    company_address,
                    company_postcode,
                    company_phone,
                    company_email,
                    company_website,
                    company_registration,
                    company_gst,
                    bank_name,
                    bank_account,
                    quote_notes,
                    invoice_notes,
                    update_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                company_name,
                company_address,
                company_postcode,
                company_phone,
                company_email,
                company_website,
                company_registration,
                company_gst,
                bank_name,
                bank_account,
                quote_notes,
                invoice_notes
            ], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        req.flash('success_msg', 'Profile updated successfully');
        res.redirect('/profiles');
    } catch (err) {
        console.error('Error updating profile:', err);
        req.flash('error_msg', 'Error updating profile');
        res.redirect('/profiles');
    }
});

module.exports = router;
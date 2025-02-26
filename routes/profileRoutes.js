const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for logo upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = '../public/uploads/logos';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'company-logo-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
    }
});

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
router.post('/update', upload.single('company_logo'), async (req, res) => {
    try {
        const oldCompany = await new Promise((resolve, reject) => {
            db.get('SELECT company_logo FROM companies LIMIT 1', [], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        // Delete old logo if exists and new one is uploaded
        if (req.file && oldCompany?.company_logo) {
            const oldLogoPath = path.join(__dirname, '../public', oldCompany.company_logo);
            if (fs.existsSync(oldLogoPath)) {
                fs.unlinkSync(oldLogoPath);
            }
        }

        const logoPath = req.file ? `../public/uploads/logos/${req.file.filename}` : oldCompany?.company_logo;

        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE companies 
                SET company_name = ?,
                    company_address = ?,
                    company_postcode = ?,
                    company_phone = ?,
                    company_email = ?,
                    company_website = ?,
                    company_registration = ?,
                    company_gst = ?,
                    bank_name = ?,
                    bank_account = ?,
                    company_logo = ?,
                    quote_notes = ?,
                    invoice_notes = ?,
                    update_date = CURRENT_TIMESTAMP
                WHERE company_id = (SELECT company_id FROM companies LIMIT 1)
            `, [
                req.body.company_name,
                req.body.company_address,
                req.body.company_postcode,
                req.body.company_phone,
                req.body.company_email,
                req.body.company_website,
                req.body.company_registration,
                req.body.company_gst,
                req.body.bank_name,
                req.body.bank_account,
                logoPath,
                req.body.quote_notes,
                req.body.invoice_notes
            ], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        req.flash('success_msg', 'Company profile updated successfully');
        res.redirect('/profiles');
    } catch (err) {
        console.error('Error updating profile:', err);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        req.flash('error_msg', 'Error updating profile');
        res.redirect('/profiles');
    }
});

module.exports = router;
const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const app = express();
const port =5000;
const authMiddleware = require('./middleware/auth');

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // set to true if using HTTPS
}));
app.use(flash());

// View engine setup

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use('/public', express.static(path.join(__dirname, 'public')));

// Flash messages middleware
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.user = req.session.user || null;
    next();
});

const userRoutes = require('./routes/userRoutes');
const clientRoutes = require('./routes/clientRoutes');  
const productRoutes = require('./routes/productRoutes');
const jobRoutes = require('./routes/jobRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const orderRoutes = require('./routes/orderRoutes');
const dashboardRoutes  = require('./routes/dashboardRoutes');
const loginRoutes = require('./routes/loginRoutes');
const profileRoutes = require('./routes/profileRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
// Protected routes - require authentication
app.use(authMiddleware);
app.use('/dashboard', dashboardRoutes);
app.use('/users', userRoutes);
app.use('/clients', clientRoutes);
app.use('/products', productRoutes);
app.use('/jobs', jobRoutes);
app.use('/quotes', quoteRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/orders', orderRoutes);
app.use('/', loginRoutes);
app.use('/login', loginRoutes);
app.use('/profiles', profileRoutes);
app.use('/invoices', invoiceRoutes);
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
// Default route to login if not authenticated
app.get('/', (req, res) => {
  console.log('User login in');
    if (!req.session.user) {
      console.log('1');
        res.redirect('/login');
       
    } else {
      console.log('2');
        res.redirect('/dashboard');
        
    }
});



app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});


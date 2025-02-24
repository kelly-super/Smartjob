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



// Middleware to parse JSON and URL-encoded request bodies
app.use(express.urlencoded({ extended: true })); // For form data
app.use(express.json()); // For JSON data
// Session setup (required for flash messages)
app.use(session({
    secret: 'your-secret-key', // Replace with a real secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
  }));
  
  // Flash middleware
  app.use(flash());
  
  // Make flash messages available in all views
  app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
  });




const userRoutes = require('./routes/userRoutes');
const clientRoutes = require('./routes/clientRoutes');  
const productRoutes = require('./routes/productRoutes');
const jobRoutes = require('./routes/jobRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const orderRoutes = require('./routes/orderRoutes');


app.use('/users', userRoutes);
app.use('/clients', clientRoutes);
app.use('/products', productRoutes);
app.use('/jobs', jobRoutes);
app.use('/quotes', quoteRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/orders', orderRoutes);

//middleware
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/public', express.static(__dirname + '/public'));

//routes
app.get('/', (req, res) => {
    res.render('partials/layout', { title: 'Dashboard', body: '../index' });
});


app._router.stack.forEach(function(r) {
    if (r.route && r.route.path) {
      console.log(r.route.path);
    }
  });
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});


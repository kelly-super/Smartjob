const express = require('express');
const db = require('../database');
const router = express.Router();

// Update the GET route to include todo status
router.get('/', (req, res) => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    db.all(`
        SELECT 
            todo_id,
            todo_date,
            todo_title,
            todo_description,
            todo_status
        FROM todos 
        WHERE strftime('%m', todo_date) = ? 
        AND strftime('%Y', todo_date) = ?
        ORDER BY todo_date, todo_title
    `, [
        String(currentMonth + 1).padStart(2, '0'),
        currentYear
    ], (err, todos) => {
        if (err) {
            console.error('Error fetching todos:', err);
            req.flash('error_msg', 'Error loading todos');
            return res.redirect('/');
        }

        res.render('partials/layout', {
            title: 'To-do List',
            body: '../todos/index',
            todos: todos || [],
            currentMonth,
            currentYear
        });
    });
});

// Update the create route to return the new todo data
router.post('/create', async (req, res) => {
    const { todo_date, todo_title, todo_description } = req.body;
    
    if (!todo_date || !todo_title) {
        return res.status(400).json({
            success: false,
            message: 'Date and title are required'
        });
    }

    try {
        // Insert the new todo
        const todoId = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO todos (
                    todo_date,
                    todo_title,
                    todo_description,
                    todo_status,
                    create_date
                ) VALUES (?, ?, ?, 'Pending', datetime('now'))
            `, [todo_date, todo_title, todo_description], function(err) {
                if (err) reject(err);
                resolve(this.lastID);
            });
        });

        // Get the newly created todo
        const newTodo = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    todo_id,
                    todo_date,
                    todo_title,
                    todo_description,
                    todo_status,
                    create_date
                FROM todos 
                WHERE todo_id = ?
            `, [todoId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        res.json({
            success: true,
            message: 'Todo created successfully',
            todo: newTodo
        });
console.log('Todo created successfully ');

    } catch (err) {
        console.error('Error creating todo:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to create todo'
        });
    }
});

// Update todo status
router.post('/:id/update', (req, res) => {
    const { todo_status } = req.body;
    
    db.run(`
        UPDATE todos 
        SET todo_status = ?,
            update_date = CURRENT_TIMESTAMP
        WHERE todo_id = ?
    `, [todo_status, req.params.id], (err) => {
        if (err) {
            console.error('Error updating todo:', err);
            return res.json({ success: false, message: 'Error updating todo' });
        }
        res.json({ success: true });
    });
});

module.exports = router;
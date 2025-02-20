const fs = require('fs');
const {exec} = require('child_process');
//delete the existing database
if(fs.existsSync('./database.db')) {
    fs.unlinkSync('./database.db');
    console.log('Database deleted');
}

//Run the database.js file to recreate the databse and tabels
exec('node database.js', (error, stdout, stderr) => {
    if (error) {
        console.error(`Error running database.js:, ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`Stderr: ${stderr}`);
        return;
      }
      console.log(`Database recreated successfully:\n${stdout}`);

});
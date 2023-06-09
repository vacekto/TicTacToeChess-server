const fs = require("fs");
const path = require('path');

fs.cpSync(
    path.join(__dirname, 'client', 'build'),
    path.join(__dirname, '/../dist/client/build'),
    { recursive: true }
);


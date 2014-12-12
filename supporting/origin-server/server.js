var express = require('express');
var path = require('path');
var staticSigning = require('./middleware/static-signing.js');

var Server = function(port, privateKey, publicKey) {
    var app = express();
    var staticFilesPath = path.join(__dirname, 'static-resources');

    // For the DEMO
    app.use(function(req, res, next) {
        console.log('req.headers', req.headers);
        var role = req.headers['x-seedyn-role'] || '';
        if (role.toLowerCase() === 'b') {
            console.log('role is B', req.path);
            if (!(req.path === '/' || req.path === '/index.html' || req.path === '/public-key.txt')) {
                // For the demo, we want non-index pages to just hang
                console.log('non-whitelisted path');
                return;
            }
        }
        next();
    });
    // END DEMO

    app.use(staticSigning(staticFilesPath, privateKey, publicKey));

    app.listen(port);
    console.log('Server listening on port', port);
};

module.exports = Server;

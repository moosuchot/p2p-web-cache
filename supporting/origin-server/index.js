// Usage: sudo node index.js

var fs = require('fs');

var privateKey = fs.readFileSync('./keys/private.pem').toString();
var publicKey = fs.readFileSync('./keys/public.pem').toString();

var port = '5001';
// Optional first arg is port
if (process.argv.length >= 3) {
    port = process.argv[2];
}

var Server = require('./server.js');
new Server(port, privateKey, publicKey);

// We also need to host the public key over https
var https = require('https');

var https = require('https');
var express = require('express');
var app = express();
var sslOptions = {
    key: fs.readFileSync('./ssl/server.key'),
    cert: fs.readFileSync('./ssl/server.crt'),
    ca: fs.readFileSync('./ssl/ca.crt'),
    requestCert: true,
    rejectUnauthorized: false
};

// serving over HTTP, because XHR rejects our untrusted CA
app.get('/public-key.txt', function(req, res) {
    res.send(publicKey);
});

// var secureServer = https.createServer(sslOptions, app).listen('443', function(){
//     console.log("Secure Express server listening on port 443");
// });

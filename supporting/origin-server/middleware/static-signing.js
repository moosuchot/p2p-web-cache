var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var mime = require('mime');

module.exports = function staticSigning(pathRoot, privateKey, publicKey) {
    return function(req, res, next) {
        if (req.path === '/public-key.txt') {
            res.send(publicKey);
            return;
        };

        var filepath = path.join(pathRoot, req.path);

        if (filepath.indexOf(pathRoot) !== 0) {
            console.log('Malicious path detected', filepath);
            res.sendStatus(403);
            return;
        }


        if (filepath === pathRoot + '/') {
            filepath += 'index.html';
        }

        console.log('Request for filepath', filepath);

        fs.readFile(filepath, function(err, contents) {
            if (err) {
                console.log('500 for ' + filepath);
                // console.log('err', err);
                res.sendStatus(500);
                return;
            }

            var sign = crypto.createSign('RSA-SHA256');
            // var buf = new Buffer(contents);
            var buf = new Buffer(contents, 'utf8');
            sign.update(buf.toString('binary'));
            console.log('buf len:', buf.length);
            console.log('buf / mb:', buf.length / 1024 / 1024);
            console.log('contents / mb:', contents.length / 1024 / 1024);
            var signature = sign.sign(privateKey, 'base64');
            console.log('...signing filepath', filepath);
            res.setHeader('x-cache-signature', signature);
            res.setHeader('content-type', mime.lookup(filepath));
            // res.send(buf);
            res.send(contents);
            console.log('...sent filepath', filepath);
        });
    };
};

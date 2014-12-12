var Store = require('./dht/store.js');

exports['test GET'] = function (assert, done) {
  var store = new Store();
  store.put('key', 'value', function (err) {
    if (err) {
      throw err;
    }
    store.get('key', function (err, data) {
      if (err) {
        throw err;
      }
      assert.equal(data, 'value', 'returns the contents of a stored key');
      done();
    });
  });
};

exports['test GET missing key'] = function (assert, done) {
  var store = new Store();
  store.get('blargh', function (err, data) {
    assert.notEqual(err, null, 'returns non-null error');
    assert.equal(data, null, 'returns null data');
    done();
  });
};

exports['test PUT'] = function (assert, done) {
  var store = new Store();
  store.put('key', 'value', function (err) {
    if (err) {
      throw err;
    }
    store.put('key', 'blargh', function (err) {
      if (err) {
        throw err;
      }
      store.get('key', function (err, data) {
        if (err) {
          throw err;
        }
        assert.equal(data, 'blargh', 'overwrites old values if the key already exists');
        done();
      });
    });
  });
};

exports['test CLEAR'] = function (assert, done) {
  var store = new Store();
  store.put('key1', 'value1', function (err) {
    if (err) {
      throw err;
    }
    store.put('key2', 'value2', function (err) {
      if (err) {
        throw err;
      }
      store.clear();
      assert.equal(Object.keys(store._inMemory).length, 0, 'clears the in-memory map');
      done();
    });
  });
};

require("sdk/test").run(exports);
